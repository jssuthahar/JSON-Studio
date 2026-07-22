/*
  jsonpath.js
  A JSONPath evaluator covering the syntax people actually type: root, child
  access, bracket notation, wildcards, array indices and slices, recursive
  descent, and filter expressions.

  Written by hand rather than pulled from a CDN for one specific reason: most
  JSONPath libraries implement filters by handing the expression to eval() or
  new Function(). This one parses comparisons instead, so a pasted expression
  can never execute code.
*/

(function () {
  const $ = TK.$;

  const SAMPLE = JSON.stringify({
    store: {
      book: [
        { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
        { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
        { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
        { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 }
      ],
      bicycle: { color: 'red', price: 19.95 }
    },
    expensive: 10
  }, null, 2);

  /* ---------------- path tokenizer ---------------- */

  function tokenize(path) {
    const src = path.trim();
    if (!src) throw new Error('Enter a path — start with $.');
    if (src[0] !== '$') throw new Error('A JSONPath must start with $.');

    const tokens = [];
    let i = 1;

    while (i < src.length) {
      const c = src[i];

      if (c === '.') {
        if (src[i + 1] === '.') {
          // "$..author" is descend-then-name: the name follows the dots directly
          // rather than after another separator, so read it here.
          tokens.push({ t: 'descend' });
          i += 2;
          if (src[i] === '*') { tokens.push({ t: 'wild' }); i++; }
          else if (src[i] && /[^.[\]]/.test(src[i])) {
            let name = '';
            while (i < src.length && /[^.[\]]/.test(src[i])) name += src[i++];
            tokens.push({ t: 'key', v: name });
          }
          continue;
        }
        i++;
        if (src[i] === '*') { tokens.push({ t: 'wild' }); i++; continue; }
        let name = '';
        while (i < src.length && /[^.[\]]/.test(src[i])) name += src[i++];
        if (!name) throw new Error('Expected a property name after "." at position ' + i + '.');
        tokens.push({ t: 'key', v: name });
        continue;
      }

      if (c === '[') {
        const close = matchBracket(src, i);
        const body = src.slice(i + 1, close).trim();
        tokens.push(parseBracket(body));
        i = close + 1;
        continue;
      }

      if (/\s/.test(c)) { i++; continue; }
      throw new Error('Unexpected "' + c + '" at position ' + i + '.');
    }

    return tokens;
  }

  function matchBracket(src, open) {
    let depth = 0;
    let quote = '';
    for (let i = open; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '[') depth++;
      if (c === ']') { depth--; if (!depth) return i; }
    }
    throw new Error('Unclosed "[" in the path.');
  }

  function parseBracket(body) {
    if (body === '*') return { t: 'wild' };
    if (body[0] === '?') return { t: 'filter', v: parseFilter(body.slice(1).replace(/^\(/, '').replace(/\)$/, '')) };
    if ((body[0] === "'" && body.endsWith("'")) || (body[0] === '"' && body.endsWith('"'))) {
      return { t: 'key', v: body.slice(1, -1) };
    }
    if (/^-?\d+$/.test(body)) return { t: 'index', v: Number(body) };
    if (body.includes(':')) {
      const [from, to, step] = body.split(':').map((s) => (s.trim() === '' ? undefined : Number(s)));
      return { t: 'slice', from, to, step };
    }
    if (body.includes(',')) return { t: 'union', v: body.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')) };
    return { t: 'key', v: body };
  }

  /* ---------------- filter expressions ---------------- */

  const OPS = ['>=', '<=', '==', '!=', '=~', '>', '<'];

  function parseFilter(expr) {
    // Split on || first so && binds tighter, matching normal precedence.
    const ors = splitTop(expr, '||');
    return {
      or: ors.map((chunk) => ({ and: splitTop(chunk, '&&').map(parseComparison) }))
    };
  }

  function splitTop(expr, sep) {
    const parts = [];
    let depth = 0;
    let quote = '';
    let cur = '';
    for (let i = 0; i < expr.length; i++) {
      const c = expr[i];
      if (quote) { cur += c; if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; cur += c; continue; }
      if (c === '(' || c === '[') depth++;
      if (c === ')' || c === ']') depth--;
      if (!depth && expr.startsWith(sep, i)) { parts.push(cur); cur = ''; i += sep.length - 1; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts.map((s) => s.trim()).filter(Boolean);
  }

  function parseComparison(text) {
    const t = text.trim().replace(/^\(|\)$/g, '').trim();
    for (const op of OPS) {
      const at = findOp(t, op);
      if (at > 0) {
        return { left: t.slice(0, at).trim(), op, right: parseLiteral(t.slice(at + op.length).trim()) };
      }
    }
    return { left: t, op: 'exists' }; // bare @.key — truthy / present test
  }

  function findOp(text, op) {
    let quote = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quote) { if (c === quote) quote = ''; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (text.startsWith(op, i)) {
        // "=" of "==" must not match the ">=" already handled, and "<"/">" must
        // not steal the first char of "<="/">=".
        if ((op === '<' || op === '>') && text[i + 1] === '=') continue;
        return i;
      }
    }
    return -1;
  }

  function parseLiteral(raw) {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    if ((raw[0] === "'" && raw.endsWith("'")) || (raw[0] === '"' && raw.endsWith('"'))) return raw.slice(1, -1);
    return raw;
  }

  // "@.a.b" / "@['a']" / "@" relative to the candidate value.
  function resolveRelative(value, ref) {
    let cur = value;
    const path = ref.trim().replace(/^@/, '');
    const parts = path.match(/\.[^.[\]]+|\['[^']*'\]|\["[^"]*"\]|\[\d+\]/g) || [];
    for (const part of parts) {
      if (cur === null || cur === undefined) return undefined;
      const key = part.startsWith('.') ? part.slice(1) : part.slice(1, -1).replace(/^['"]|['"]$/g, '');
      cur = cur[key];
    }
    return cur;
  }

  function testFilter(node, value) {
    return node.or.some((clause) => clause.and.every((cmp) => testComparison(cmp, value)));
  }

  function testComparison(cmp, value) {
    const left = cmp.left.startsWith('@') ? resolveRelative(value, cmp.left) : parseLiteral(cmp.left);
    switch (cmp.op) {
      case 'exists': return left !== undefined && left !== null && left !== false;
      case '==': return left === cmp.right;
      case '!=': return left !== cmp.right;
      case '>': return left > cmp.right;
      case '<': return left < cmp.right;
      case '>=': return left >= cmp.right;
      case '<=': return left <= cmp.right;
      case '=~': {
        const m = /^\/(.*)\/([a-z]*)$/.exec(String(cmp.right));
        try {
          return m ? new RegExp(m[1], m[2]).test(String(left)) : new RegExp(String(cmp.right)).test(String(left));
        } catch (e) { return false; }
      }
      default: return false;
    }
  }

  /* ---------------- evaluation ---------------- */

  function evaluate(data, tokens) {
    let current = [{ value: data, path: ['$'] }];

    tokens.forEach((tok) => {
      const next = [];

      const pushChild = (parent, key) => {
        const v = parent.value[key];
        if (v !== undefined) next.push({ value: v, path: parent.path.concat(typeof key === 'number' ? '[' + key + ']' : key) });
      };

      current.forEach((node) => {
        const v = node.value;
        const isObj = v !== null && typeof v === 'object';

        switch (tok.t) {
          case 'key':
            if (isObj && !Array.isArray(v)) pushChild(node, tok.v);
            else if (Array.isArray(v) && Object.prototype.hasOwnProperty.call(v, tok.v)) pushChild(node, tok.v);
            break;
          case 'index':
            if (Array.isArray(v)) pushChild(node, tok.v < 0 ? v.length + tok.v : tok.v);
            break;
          case 'wild':
            if (Array.isArray(v)) v.forEach((_, i) => pushChild(node, i));
            else if (isObj) Object.keys(v).forEach((k) => pushChild(node, k));
            break;
          case 'slice': {
            if (!Array.isArray(v)) break;
            const step = tok.step || 1;
            let from = tok.from === undefined ? 0 : (tok.from < 0 ? v.length + tok.from : tok.from);
            let to = tok.to === undefined ? v.length : (tok.to < 0 ? v.length + tok.to : tok.to);
            for (let i = from; i < to; i += step) if (i >= 0 && i < v.length) pushChild(node, i);
            break;
          }
          case 'union':
            tok.v.forEach((k) => {
              if (Array.isArray(v) && /^-?\d+$/.test(k)) pushChild(node, Number(k));
              else if (isObj) pushChild(node, k);
            });
            break;
          case 'filter':
            if (Array.isArray(v)) v.forEach((item, i) => { if (testFilter(tok.v, item)) pushChild(node, i); });
            else if (isObj) Object.keys(v).forEach((k) => { if (testFilter(tok.v, v[k])) pushChild(node, k); });
            break;
          case 'descend': {
            // Recursive descent yields the node itself plus every descendant;
            // the following token then filters that set.
            (function walk(n) {
              next.push(n);
              const val = n.value;
              if (Array.isArray(val)) val.forEach((x, i) => walk({ value: x, path: n.path.concat('[' + i + ']') }));
              else if (val !== null && typeof val === 'object') {
                Object.keys(val).forEach((k) => walk({ value: val[k], path: n.path.concat(k) }));
              }
            })(node);
            break;
          }
          default: break;
        }
      });

      current = next;
    });

    return current;
  }

  const pathString = (parts) => parts.reduce((acc, p) => (p.startsWith('[') ? acc + p : acc + (acc ? '.' : '') + p), '');

  TK.tool({
    sample: SAMPLE,
    filename: 'matches.json',
    mime: 'application/json',
    options: ['opt-path', 'opt-paths', 'opt-first'],
    run(text) {
      const data = TK.parseJSON(text);
      const tokens = tokenize($('opt-path').value);
      let matches = evaluate(data, tokens);
      if ($('opt-first').checked) matches = matches.slice(0, 1);

      const out = $('opt-paths').checked
        ? matches.map((m) => ({ path: pathString(m.path), value: m.value }))
        : matches.map((m) => m.value);

      return {
        output: JSON.stringify(out, null, 2),
        inMsg: 'Valid JSON · ' + text.length.toLocaleString() + ' chars',
        outMsg: matches.length ? matches.length.toLocaleString() + ' match' + (matches.length === 1 ? '' : 'es') : 'No matches for this path.',
        outKind: matches.length ? 'ok' : 'err'
      };
    }
  });
})();
