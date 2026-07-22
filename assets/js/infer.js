/*
  infer.js
  Shared type inference over a sample JSON payload. Two tools consume it:
  the JSON Schema generator and the code generator — both need the same
  answer ("what shape is this data?"), just rendered differently.

  The interesting part is array handling: every element is inferred and then
  merged, so a list of slightly different objects produces one type with the
  union of properties, and only the always-present keys treated as required —
  rather than a type that only matches element zero.

  Nodes carry a few `__`-prefixed bookkeeping fields (observation count, seen
  string values, first example). finalizeSchema() strips them; consumers that
  read the raw model should ignore anything starting with `__`.
*/

(function () {
  /* ---------------- format detection ---------------- */

  const FORMATS = [
    ['date-time', /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/],
    ['date', /^\d{4}-\d{2}-\d{2}$/],
    ['time', /^\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?$/],
    ['uuid', /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i],
    ['email', /^[^\s@]+@[^\s@.]+\.[^\s@]+$/],
    ['ipv4', /^(\d{1,3}\.){3}\d{1,3}$/],
    ['uri', /^[a-z][a-z0-9+.-]*:\/\/[^\s]+$/i]
  ];

  function detectFormat(str) {
    for (const [name, re] of FORMATS) if (re.test(str)) return name;
    return undefined;
  }

  /* ---------------- inference ---------------- */

  function infer(value) {
    if (value === null) return { type: 'null', __n: 1 };

    const t = typeof value;
    if (t === 'boolean') return { type: 'boolean', __n: 1, __ex: value };
    if (t === 'number') {
      return { type: Number.isInteger(value) ? 'integer' : 'number', __n: 1, __ex: value };
    }
    if (t === 'string') {
      const node = { type: 'string', __n: 1, __ex: value, __vals: new Set([value]) };
      const fmt = detectFormat(value);
      if (fmt) node.format = fmt;
      return node;
    }

    if (Array.isArray(value)) {
      const node = { type: 'array', __n: 1, __len: value.length };
      if (value.length) node.items = value.map(infer).reduce(mergeTwo);
      return node;
    }

    const node = { type: 'object', __n: 1, properties: {}, required: [] };
    Object.keys(value).forEach((k) => {
      node.properties[k] = infer(value[k]);
      node.required.push(k);
    });
    return node;
  }

  /* ---------------- merging ---------------- */

  // Integers and floats share a bucket so [1, 2.5] widens to "number"
  // instead of producing anyOf[integer, number].
  function bucket(node) {
    return (node.type === 'integer' || node.type === 'number') ? 'num' : node.type;
  }

  function mergeTwo(a, b) {
    if (!a) return b;
    if (!b) return a;
    return fromVariants((a.anyOf || [a]).concat(b.anyOf || [b]));
  }

  function fromVariants(list) {
    const groups = new Map();
    list.forEach((node) => {
      const key = bucket(node);
      groups.set(key, groups.has(key) ? mergeSame(groups.get(key), node) : node);
    });
    const merged = [...groups.values()];
    return merged.length === 1 ? merged[0] : { anyOf: merged, __n: 1 };
  }

  function mergeSame(a, b) {
    const n = (a.__n || 1) + (b.__n || 1);

    if (a.type === 'object') {
      const properties = {};
      Object.keys(a.properties).forEach((k) => { properties[k] = a.properties[k]; });
      Object.keys(b.properties).forEach((k) => {
        properties[k] = properties[k] ? mergeTwo(properties[k], b.properties[k]) : b.properties[k];
      });
      // Required only survives if the key was present in every sample seen.
      const bReq = new Set(b.required || []);
      return {
        type: 'object',
        properties,
        required: (a.required || []).filter((k) => bReq.has(k)),
        __n: n
      };
    }

    if (a.type === 'array') {
      return { type: 'array', items: mergeTwo(a.items, b.items), __n: n };
    }

    if (a.type === 'string') {
      const node = { type: 'string', __n: n, __ex: a.__ex !== undefined ? a.__ex : b.__ex };
      if (a.format && a.format === b.format) node.format = a.format;
      node.__vals = new Set([...(a.__vals || []), ...(b.__vals || [])]);
      return node;
    }

    if (bucket(a) === 'num') {
      const type = (a.type === 'integer' && b.type === 'integer') ? 'integer' : 'number';
      return { type, __n: n, __ex: a.__ex !== undefined ? a.__ex : b.__ex };
    }

    return { type: a.type, __n: n, __ex: a.__ex !== undefined ? a.__ex : b.__ex };
  }

  /* ---------------- schema output ---------------- */

  const ENUM_MAX = 12; // beyond this it's data, not a closed set

  function looksEnum(node, cfg) {
    if (!cfg.enums || node.type !== 'string' || node.format || !node.__vals) return false;
    const distinct = node.__vals.size;
    // Needs repetition to be evidence of a closed set: 3 reds and 3 blues is a
    // signal, 6 unique free-text strings is not.
    return distinct > 0 && distinct <= ENUM_MAX && node.__n >= 3 && node.__n >= distinct * 2;
  }

  function finalizeSchema(node, cfg) {
    cfg = cfg || {};
    if (node.anyOf) return { anyOf: node.anyOf.map((v) => finalizeSchema(v, cfg)) };

    const out = { type: node.type };

    if (node.type === 'string') {
      if (node.format && cfg.formats) out.format = node.format;
      if (looksEnum(node, cfg)) out.enum = [...node.__vals].sort();
    }

    if (node.type === 'object') {
      out.properties = {};
      Object.keys(node.properties || {}).sort().forEach((k) => {
        out.properties[k] = finalizeSchema(node.properties[k], cfg);
      });
      if (cfg.required && node.required && node.required.length) {
        out.required = [...node.required].sort();
      }
      if (cfg.noadd) out.additionalProperties = false;
    }

    if (node.type === 'array' && node.items) out.items = finalizeSchema(node.items, cfg);

    if (cfg.examples && node.__ex !== undefined && !out.enum) out.examples = [node.__ex];

    return out;
  }

  function countNodes(schema) {
    let n = 1;
    if (schema.properties) Object.values(schema.properties).forEach((s) => { n += countNodes(s); });
    if (schema.items) n += countNodes(schema.items);
    if (schema.anyOf) schema.anyOf.forEach((s) => { n += countNodes(s); });
    return n;
  }

  window.JStudioInfer = { infer, mergeTwo, finalizeSchema, detectFormat, countNodes };
})();
