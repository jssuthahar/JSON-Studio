/*
  validate.js
  A JSON Schema validator covering the keywords that show up in real schemas.
  Deliberately not a full draft implementation — see the note on the page — but
  every error it reports names the failing instance path and the keyword that
  rejected it, which is the part people actually need.
*/

(function () {
  const $ = TK.$;

  const SAMPLE_DATA = JSON.stringify({
    id: 'not-a-number',
    email: 'ada@example',
    age: 17,
    tags: ['a', 'a'],
    address: { city: 'London' }
  }, null, 2);

  const SAMPLE_SCHEMA = JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['id', 'email', 'age', 'address'],
    properties: {
      id: { type: 'integer' },
      email: { type: 'string', format: 'email' },
      age: { type: 'integer', minimum: 18 },
      tags: { type: 'array', items: { type: 'string' }, uniqueItems: true },
      address: {
        type: 'object',
        required: ['city', 'postcode'],
        properties: { city: { type: 'string' }, postcode: { type: 'string' } }
      }
    }
  }, null, 2);

  const FORMATS = {
    'date-time': /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    time: /^\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    email: /^[^\s@]+@[^\s@.]+\.[^\s@]+$/,
    ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
    uri: /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i,
    hostname: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i
  };

  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function matchesType(value, want) {
    const actual = typeOf(value);
    if (want === 'number') return actual === 'number' || actual === 'integer';
    return actual === want;
  }

  // Local "#/definitions/x" style pointers, resolved against the root schema.
  function resolveRef(ref, root) {
    if (ref === '#') return root;
    if (ref[0] !== '#') throw new Error('Only local $ref pointers are supported (got "' + ref + '").');
    let node = root;
    ref.slice(1).split('/').filter(Boolean).forEach((seg) => {
      const key = decodeURIComponent(seg).replace(/~1/g, '/').replace(/~0/g, '~');
      if (node === undefined) return;
      node = node[key];
    });
    if (node === undefined) throw new Error('$ref "' + ref + '" does not resolve.');
    return node;
  }

  function validate(value, schema, root, path, errors) {
    if (schema === true || schema === undefined) return errors;
    if (schema === false) { errors.push({ path, msg: 'schema is false — nothing is valid here' }); return errors; }
    if (schema.$ref) return validate(value, resolveRef(schema.$ref, root), root, path, errors);

    const add = (kw, msg) => errors.push({ path, kw, msg });

    /* type */
    if (schema.type !== undefined) {
      const wanted = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!wanted.some((t) => matchesType(value, t))) {
        add('type', 'expected ' + wanted.join(' or ') + ', got ' + typeOf(value));
        return errors; // further keywords would only produce noise
      }
    }

    /* generic */
    if (schema.enum && !schema.enum.some((e) => same(e, value))) {
      add('enum', 'value must be one of ' + JSON.stringify(schema.enum));
    }
    if (schema.const !== undefined && !same(schema.const, value)) {
      add('const', 'value must be ' + JSON.stringify(schema.const));
    }

    /* numbers */
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) add('minimum', value + ' is less than minimum ' + schema.minimum);
      if (schema.maximum !== undefined && value > schema.maximum) add('maximum', value + ' is greater than maximum ' + schema.maximum);
      if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) add('exclusiveMinimum', value + ' must be greater than ' + schema.exclusiveMinimum);
      if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) add('exclusiveMaximum', value + ' must be less than ' + schema.exclusiveMaximum);
      if (schema.multipleOf !== undefined) {
        const ratio = value / schema.multipleOf;
        if (Math.abs(ratio - Math.round(ratio)) > 1e-9) add('multipleOf', value + ' is not a multiple of ' + schema.multipleOf);
      }
    }

    /* strings */
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && [...value].length < schema.minLength) add('minLength', 'shorter than minLength ' + schema.minLength);
      if (schema.maxLength !== undefined && [...value].length > schema.maxLength) add('maxLength', 'longer than maxLength ' + schema.maxLength);
      if (schema.pattern) {
        let re;
        try { re = new RegExp(schema.pattern); } catch (e) { add('pattern', 'invalid regex in schema: ' + schema.pattern); }
        if (re && !re.test(value)) add('pattern', 'does not match pattern ' + schema.pattern);
      }
      if (schema.format && $('opt-formats').checked && FORMATS[schema.format] && !FORMATS[schema.format].test(value)) {
        add('format', '"' + (value.length > 40 ? value.slice(0, 37) + '…' : value) + '" is not a valid ' + schema.format);
      }
    }

    /* arrays */
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) add('minItems', value.length + ' items, minimum is ' + schema.minItems);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) add('maxItems', value.length + ' items, maximum is ' + schema.maxItems);
      if (schema.uniqueItems) {
        const seen = new Set();
        value.forEach((v, i) => {
          const key = JSON.stringify(v);
          if (seen.has(key)) add('uniqueItems', 'duplicate item at index ' + i);
          seen.add(key);
        });
      }
      if (Array.isArray(schema.prefixItems)) {
        schema.prefixItems.forEach((s, i) => { if (i < value.length) validate(value[i], s, root, path + '/' + i, errors); });
        if (schema.items) {
          value.slice(schema.prefixItems.length).forEach((v, i) => {
            validate(v, schema.items, root, path + '/' + (i + schema.prefixItems.length), errors);
          });
        }
      } else if (schema.items) {
        value.forEach((v, i) => validate(v, schema.items, root, path + '/' + i, errors));
      }
      if (schema.contains) {
        const ok = value.some((v) => validate(v, schema.contains, root, path, []).length === 0);
        if (!ok) add('contains', 'no item matches the "contains" schema');
      }
    }

    /* objects */
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const keys = Object.keys(value);

      (schema.required || []).forEach((k) => {
        if (!Object.prototype.hasOwnProperty.call(value, k)) add('required', 'missing required property "' + k + '"');
      });
      if (schema.minProperties !== undefined && keys.length < schema.minProperties) add('minProperties', keys.length + ' properties, minimum is ' + schema.minProperties);
      if (schema.maxProperties !== undefined && keys.length > schema.maxProperties) add('maxProperties', keys.length + ' properties, maximum is ' + schema.maxProperties);

      const matched = new Set();
      Object.keys(schema.properties || {}).forEach((k) => {
        if (Object.prototype.hasOwnProperty.call(value, k)) {
          matched.add(k);
          validate(value[k], schema.properties[k], root, path + '/' + k, errors);
        }
      });
      Object.keys(schema.patternProperties || {}).forEach((p) => {
        let re;
        try { re = new RegExp(p); } catch (e) { return; }
        keys.filter((k) => re.test(k)).forEach((k) => {
          matched.add(k);
          validate(value[k], schema.patternProperties[p], root, path + '/' + k, errors);
        });
      });

      if (schema.additionalProperties !== undefined) {
        keys.filter((k) => !matched.has(k)).forEach((k) => {
          if (schema.additionalProperties === false) errors.push({ path: path + '/' + k, kw: 'additionalProperties', msg: 'property "' + k + '" is not allowed' });
          else validate(value[k], schema.additionalProperties, root, path + '/' + k, errors);
        });
      }
      if (schema.dependentRequired) {
        Object.keys(schema.dependentRequired).forEach((k) => {
          if (!(k in value)) return;
          schema.dependentRequired[k].forEach((dep) => {
            if (!(dep in value)) add('dependentRequired', '"' + k + '" requires "' + dep + '" to also be present');
          });
        });
      }
    }

    /* combinators */
    if (schema.allOf) schema.allOf.forEach((s) => validate(value, s, root, path, errors));
    if (schema.anyOf && !schema.anyOf.some((s) => validate(value, s, root, path, []).length === 0)) {
      add('anyOf', 'value does not match any of the ' + schema.anyOf.length + ' anyOf schemas');
    }
    if (schema.oneOf) {
      const hits = schema.oneOf.filter((s) => validate(value, s, root, path, []).length === 0).length;
      if (hits !== 1) add('oneOf', hits === 0 ? 'value matches none of the oneOf schemas' : 'value matches ' + hits + ' oneOf schemas, expected exactly 1');
    }
    if (schema.not && validate(value, schema.not, root, path, []).length === 0) add('not', 'value must not match the "not" schema');

    return errors;
  }

  /* ---------------- wiring (two inputs) ---------------- */

  const input = $('input');
  const schemaInput = $('input-schema');
  const output = $('output');
  const inStatus = $('in-status');
  const schemaStatus = $('schema-status');
  const outStatus = $('out-status');

  function parsePane(text, statusEl, label) {
    if (!text.trim()) { TK.status(statusEl, 'Waiting for input.'); return { empty: true }; }
    try {
      const value = JSON.parse(text);
      TK.status(statusEl, 'Valid JSON · ' + text.length.toLocaleString() + ' chars', 'ok');
      return { value };
    } catch (err) {
      TK.status(statusEl, label + ': ' + err.message, 'err');
      return { error: true };
    }
  }

  function run() {
    const data = parsePane(input.value, inStatus, 'Data');
    const schema = parsePane(schemaInput.value, schemaStatus, 'Schema');

    if (data.empty || schema.empty) {
      output.value = '';
      TK.status(outStatus, 'Paste a payload and a schema to validate.');
      return;
    }
    if (data.error || schema.error) {
      output.value = '';
      TK.status(outStatus, 'Fix the invalid JSON first.', 'err');
      return;
    }

    let errors;
    try {
      errors = validate(data.value, schema.value, schema.value, '', []);
    } catch (err) {
      output.value = '';
      TK.status(outStatus, err.message, 'err');
      return;
    }

    if (!$('opt-all').checked) errors = errors.slice(0, 1);

    if (!errors.length) {
      output.value = '✓ Valid.\n\nThe document satisfies every keyword in the schema.';
      TK.status(outStatus, 'Valid — 0 errors.', 'ok');
      return;
    }

    output.value = errors.map((e, i) =>
      (i + 1) + '. ' + (e.path || '(root)') + '\n   ' + (e.kw ? '[' + e.kw + '] ' : '') + e.msg
    ).join('\n\n');
    TK.status(outStatus, errors.length + ' error' + (errors.length === 1 ? '' : 's') + ' found.', 'err');
  }

  [input, schemaInput].forEach((el) => el.addEventListener('input', run));
  ['opt-formats', 'opt-all'].forEach((id) => $(id).addEventListener('change', run));
  $('btn-run').addEventListener('click', run);
  $('btn-copy').addEventListener('click', () => TK.copy(output.value, outStatus, output));

  $('btn-sample').addEventListener('click', () => {
    input.value = SAMPLE_DATA;
    schemaInput.value = SAMPLE_SCHEMA;
    run();
  });
  $('btn-clear').addEventListener('click', () => {
    input.value = '';
    schemaInput.value = '';
    output.value = '';
    TK.status(inStatus, 'Waiting for input.');
    TK.status(schemaStatus, '');
    TK.status(outStatus, '');
  });

  // The upload button sits on the schema pane — that's the file people have.
  $('btn-upload').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (e) => {
    TK.readFile(e.target.files[0], (t) => { schemaInput.value = t; run(); }, schemaStatus);
    e.target.value = '';
  });

  TK.wireDrop(input, (t) => { input.value = t; run(); }, inStatus);
  TK.wireDrop(schemaInput, (t) => { schemaInput.value = t; run(); }, schemaStatus);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });
})();
