/*
  format.js
  Beautify / minify / sort / escape / unescape, plus validation with a useful
  error message. JSON.parse's message alone is nearly useless on a big payload
  ("Unexpected token }"), so we translate its character position into a line
  and column and quote the offending line.
*/

(function () {
  const $ = TK.$;

  const SAMPLE = '{"orderId":"A-1001","placedAt":"2026-03-14T09:21:00Z","customer":{"name":"Ada Lovelace","email":"ada@example.com"},"items":[{"sku":"KB-113","qty":1,"price":189},{"sku":"CB-007","qty":2,"price":30.48}],"total":249.95,"paid":true,"notes":null}';

  const indent = () => ($('opt-indent').value === 'tab' ? '\t' : Number($('opt-indent').value));

  /* Turn a parse failure into something you can act on. */
  function describeError(err, text) {
    const m = /position (\d+)/.exec(err.message);
    if (!m) return err.message;
    const pos = Number(m[1]);
    const before = text.slice(0, pos);
    const line = before.split('\n').length;
    const col = pos - before.lastIndexOf('\n');
    const src = text.split('\n')[line - 1] || '';
    const snippet = src.length > 80 ? src.slice(0, 77) + '…' : src;
    return err.message.replace(/ in JSON at position \d+.*/, '') +
      ' — line ' + line + ', column ' + col + '\n  ' + snippet.trim();
  }

  /*
    Relaxed mode: config files, JS object literals and hand-edited payloads
    routinely have comments, trailing commas, single quotes or bare keys.
    We strip those into strict JSON rather than shipping a whole JSON5 parser.
  */
  function relax(text) {
    let out = '';
    let inStr = false;
    let quote = '';
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inStr) {
        if (escaped) { escaped = false; out += c; continue; }
        if (c === '\\') { escaped = true; out += c; continue; }
        if (c === quote) {
          inStr = false;
          out += '"';           // normalise single-quoted strings
          continue;
        }
        if (c === '"' && quote === "'") { out += '\\"'; continue; }
        out += c;
        continue;
      }

      if (c === '"' || c === "'") { inStr = true; quote = c; out += '"'; continue; }
      if (c === '/' && next === '/') { while (i < text.length && text[i] !== '\n') i++; out += '\n'; continue; }
      if (c === '/' && next === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i++; continue; }
      out += c;
    }

    // Quote bare keys, then drop trailing commas. Both run outside strings only,
    // which is why they come after the scan above.
    out = out.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '$1"$2"$3');
    out = out.replace(/,(\s*[}\]])/g, '$1');
    return out;
  }

  function stats(data, text) {
    let keys = 0;
    let depth = 0;
    let nodes = 0;
    (function walk(v, d) {
      nodes++;
      if (d > depth) depth = d;
      if (Array.isArray(v)) v.forEach((x) => walk(x, d + 1));
      else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { keys++; walk(v[k], d + 1); });
    })(data, 1);
    return nodes + ' nodes · ' + keys + ' keys · depth ' + depth + ' · ' + TK.bytes(new Blob([text]).size);
  }

  TK.tool({
    sample: SAMPLE,
    filename: () => ($('opt-mode').value === 'minify' ? 'minified.json' : 'formatted.json'),
    mime: 'application/json',
    options: ['opt-mode', 'opt-indent', 'opt-sort', 'opt-relaxed'],
    errHint: 'Invalid JSON — see the error on the left.',
    run(text) {
      const mode = $('opt-mode').value;

      // Unescape takes a JSON *string literal* as input, so it parses differently.
      if (mode === 'unescape') {
        const src = text.trim();
        let inner;
        try {
          inner = JSON.parse(src[0] === '"' ? src : '"' + src.replace(/"/g, '\\"') + '"');
        } catch (err) {
          throw new Error('Not a valid escaped string: ' + err.message);
        }
        let pretty = inner;
        try { pretty = JSON.stringify(JSON.parse(inner), null, indent()); } catch (e) { /* leave as-is */ }
        return { output: pretty, inMsg: 'Unescaped ' + text.length.toLocaleString() + ' chars', outMsg: 'Unescaped output ready.' };
      }

      const source = $('opt-relaxed').checked ? relax(text) : text;
      let data;
      try {
        data = JSON.parse(source);
      } catch (err) {
        throw new Error(describeError(err, source));
      }

      if ($('opt-sort').checked) data = TK.sortDeep(data);

      let out;
      if (mode === 'minify') out = JSON.stringify(data);
      else if (mode === 'escape') out = JSON.stringify(JSON.stringify(data));
      else out = JSON.stringify(data, null, indent());

      const saved = mode === 'minify'
        ? ' · ' + Math.max(0, Math.round((1 - out.length / text.length) * 100)) + '% smaller'
        : '';

      return {
        output: out,
        inMsg: 'Valid JSON · ' + stats(data, text),
        outMsg: TK.bytes(new Blob([out]).size) + ' out' + saved
      };
    }
  });
})();
