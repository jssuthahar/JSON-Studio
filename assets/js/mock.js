/*
  mock.js
  JSON Schema -> plausible fake data.

  Randomness is seeded (mulberry32) rather than Math.random, so the same schema
  and seed always produce the same payload — which is what makes the output
  usable in a committed test fixture instead of just a demo.
*/

(function () {
  const $ = TK.$;

  const SAMPLE = JSON.stringify({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['id', 'name', 'email', 'createdAt', 'status'],
    properties: {
      id: { type: 'integer', minimum: 1000, maximum: 9999 },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      createdAt: { type: 'string', format: 'date-time' },
      status: { type: 'string', enum: ['active', 'pending', 'closed'] },
      score: { type: 'number', minimum: 0, maximum: 100 },
      verified: { type: 'boolean' },
      tags: { type: 'array', items: { type: 'string' } },
      address: {
        type: 'object',
        required: ['city', 'country'],
        properties: { city: { type: 'string' }, country: { type: 'string' }, postcode: { type: 'string' } }
      }
    }
  }, null, 2);

  /* ---------------- seeded randomness ---------------- */

  function makeRandom(seedText) {
    let h = 1779033703 ^ String(seedText).length;
    for (let i = 0; i < String(seedText).length; i++) {
      h = Math.imul(h ^ String(seedText).charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function random() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const FIRST = ['Ada', 'Grace', 'Alan', 'Katherine', 'Linus', 'Radia', 'Barbara', 'Tim', 'Margaret', 'Dennis'];
  const LAST = ['Lovelace', 'Hopper', 'Turing', 'Johnson', 'Torvalds', 'Perlman', 'Liskov', 'Berners-Lee', 'Hamilton', 'Ritchie'];
  const CITIES = ['London', 'Chennai', 'Seattle', 'Berlin', 'Toronto', 'Sydney', 'Dublin', 'Singapore'];
  const COUNTRIES = ['United Kingdom', 'India', 'United States', 'Germany', 'Canada', 'Australia', 'Ireland', 'Singapore'];
  const WORDS = ['alpha', 'beta', 'gamma', 'delta', 'priority', 'archived', 'internal', 'beta-test', 'legacy', 'preview'];

  /* ---------------- generation ---------------- */

  function generator(rootSchema, rand) {
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const between = (lo, hi) => lo + rand() * (hi - lo);
    const intBetween = (lo, hi) => Math.floor(between(lo, hi + 1));

    function resolve(schema) {
      if (schema && schema.$ref) {
        if (schema.$ref === '#') return rootSchema;
        if (schema.$ref[0] !== '#') throw new Error('Only local $ref pointers are supported (got "' + schema.$ref + '").');
        let node = rootSchema;
        schema.$ref.slice(1).split('/').filter(Boolean).forEach((seg) => {
          const key = decodeURIComponent(seg).replace(/~1/g, '/').replace(/~0/g, '~');
          node = node === undefined ? undefined : node[key];
        });
        if (node === undefined) throw new Error('$ref "' + schema.$ref + '" does not resolve.');
        return node;
      }
      return schema;
    }

    // Field names carry more signal than the type does — "email" should look
    // like an email even when the schema says only "string".
    function stringFor(key, schema) {
      const fmt = schema.format;
      const name = String(key || '').toLowerCase();
      const person = () => pick(FIRST) + ' ' + pick(LAST);

      if (fmt === 'email' || name.includes('email')) {
        return pick(FIRST).toLowerCase() + '.' + pick(LAST).toLowerCase().replace(/[^a-z]/g, '') + '@example.com';
      }
      if (fmt === 'uuid' || name.endsWith('uuid') || name === 'guid') {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.floor(rand() * 16);
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
      }
      if (fmt === 'date-time' || /at$|date|time/.test(name)) {
        const d = new Date(Date.UTC(2026, intBetween(0, 11), intBetween(1, 28), intBetween(0, 23), intBetween(0, 59), intBetween(0, 59)));
        return fmt === 'date' ? d.toISOString().slice(0, 10) : d.toISOString().replace(/\.\d+Z$/, 'Z');
      }
      if (fmt === 'date') return '2026-' + String(intBetween(1, 12)).padStart(2, '0') + '-' + String(intBetween(1, 28)).padStart(2, '0');
      if (fmt === 'time') return String(intBetween(0, 23)).padStart(2, '0') + ':' + String(intBetween(0, 59)).padStart(2, '0') + ':00Z';
      if (fmt === 'uri' || name.includes('url') || name.includes('website')) return 'https://example.com/' + pick(WORDS);
      if (fmt === 'ipv4') return [intBetween(10, 250), intBetween(0, 255), intBetween(0, 255), intBetween(1, 254)].join('.');
      if (fmt === 'hostname') return pick(WORDS) + '.example.com';
      if (name.includes('city')) return pick(CITIES);
      if (name.includes('country')) return pick(COUNTRIES);
      if (name.includes('postcode') || name.includes('zip')) return String(intBetween(10000, 99999));
      if (name.includes('phone')) return '+44 20 ' + intBetween(1000, 9999) + ' ' + intBetween(1000, 9999);
      if (name.includes('name')) return name.includes('first') ? pick(FIRST) : name.includes('last') ? pick(LAST) : person();
      if (name.includes('sku') || name.includes('code')) return pick(['KB', 'CB', 'MN', 'HD']) + '-' + intBetween(100, 999);
      if (name.includes('desc') || name.includes('note') || name.includes('message')) {
        return pick(['Generated sample text', 'Placeholder description', 'Example note for testing']);
      }

      let s = pick(WORDS);
      if (schema.minLength) while (s.length < schema.minLength) s += '-' + pick(WORDS);
      if (schema.maxLength) s = s.slice(0, schema.maxLength);
      return s;
    }

    function gen(rawSchema, key, depth) {
      const schema = resolve(rawSchema);
      if (!schema || schema === true) return pick(WORDS);
      if (depth > 8) return null; // guard against recursive $ref chains

      if (schema.const !== undefined) return schema.const;
      if (schema.enum) return pick(schema.enum);
      if (schema.examples && schema.examples.length) return schema.examples[0];
      if (schema.default !== undefined) return schema.default;

      if (schema.anyOf) return gen(schema.anyOf[Math.floor(rand() * schema.anyOf.length)], key, depth + 1);
      if (schema.oneOf) return gen(schema.oneOf[Math.floor(rand() * schema.oneOf.length)], key, depth + 1);
      if (schema.allOf) {
        return schema.allOf.reduce((acc, s) => Object.assign(acc, gen(s, key, depth + 1)), {});
      }

      const type = Array.isArray(schema.type) ? schema.type.find((t) => t !== 'null') || 'null' : schema.type;

      switch (type) {
        case 'null': return null;
        case 'boolean': return rand() > 0.35;
        case 'integer': {
          const lo = schema.minimum !== undefined ? schema.minimum : (schema.exclusiveMinimum !== undefined ? schema.exclusiveMinimum + 1 : 1);
          const hi = schema.maximum !== undefined ? schema.maximum : (schema.exclusiveMaximum !== undefined ? schema.exclusiveMaximum - 1 : lo + 1000);
          const v = intBetween(lo, Math.max(lo, hi));
          return schema.multipleOf ? Math.round(v / schema.multipleOf) * schema.multipleOf : v;
        }
        case 'number': {
          const lo = schema.minimum !== undefined ? schema.minimum : 0;
          const hi = schema.maximum !== undefined ? schema.maximum : lo + 1000;
          return Math.round(between(lo, hi) * 100) / 100;
        }
        case 'string': return stringFor(key, schema);
        case 'array': {
          const want = Number($('opt-arr').value);
          const min = schema.minItems !== undefined ? schema.minItems : want;
          const max = schema.maxItems !== undefined ? schema.maxItems : Math.max(min, want);
          const count = Math.max(0, Math.min(max, min === max ? min : intBetween(min, max)));
          const items = [];
          for (let i = 0; i < count; i++) items.push(gen(schema.items || { type: 'string' }, key, depth + 1));
          if (schema.uniqueItems) return [...new Set(items.map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x));
          return items;
        }
        case 'object':
        default: {
          if (!schema.properties && !schema.type) return pick(WORDS);
          const required = new Set(schema.required || []);
          const includeOptional = $('opt-optional').checked;
          const obj = {};
          Object.keys(schema.properties || {}).forEach((k) => {
            if (!required.has(k) && !includeOptional) return;
            obj[k] = gen(schema.properties[k], k, depth + 1);
          });
          return obj;
        }
      }
    }

    return gen;
  }

  TK.tool({
    sample: SAMPLE,
    filename: 'mock-data.json',
    mime: 'application/json',
    options: ['opt-count', 'opt-seed', 'opt-arr', 'opt-optional'],
    errHint: 'Nothing to show — fix the schema first.',
    run(text) {
      const schema = TK.parseJSON(text);
      const count = Number($('opt-count').value);
      const gen = generator(schema, makeRandom($('opt-seed').value || 'seed'));

      const records = [];
      for (let i = 0; i < count; i++) records.push(gen(schema, '', 0));

      const out = JSON.stringify(count === 1 ? records[0] : records, null, 2);
      return {
        output: out,
        inMsg: 'Valid schema · ' + Object.keys(schema.properties || {}).length + ' top-level properties',
        outMsg: count.toLocaleString() + ' record' + (count === 1 ? '' : 's') + ' · ' + TK.bytes(new Blob([out]).size) + ' · seed "' + ($('opt-seed').value || 'seed') + '"'
      };
    }
  });
})();
