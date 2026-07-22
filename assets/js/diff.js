/*
  diff.js
  Structural comparison of two JSON documents. Structural, not textual: key
  order is irrelevant, so a reordered object reads as identical — which is the
  whole reason to use this instead of a text diff on two payloads.

  Three output shapes: a readable change list, RFC 6902 JSON Patch (what you
  send to a PATCH endpoint), and RFC 7386 JSON Merge Patch.
*/

(function () {
  const $ = TK.$;

  const SAMPLE_A = JSON.stringify({
    id: 'A-1001',
    status: 'pending',
    total: 249.95,
    customer: { name: 'Ada Lovelace', tier: 'gold' },
    items: [{ sku: 'KB-113', qty: 1 }, { sku: 'CB-007', qty: 2 }],
    coupon: 'SPRING10'
  }, null, 2);

  const SAMPLE_B = JSON.stringify({
    status: 'shipped',
    id: 'A-1001',
    total: 239.95,
    customer: { name: 'Ada Lovelace', tier: 'platinum', since: 2019 },
    items: [{ sku: 'KB-113', qty: 2 }, { sku: 'CB-007', qty: 2 }],
    shippedAt: '2026-03-15T11:02:00Z'
  }, null, 2);

  const typeOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  const isContainer = (v) => v !== null && typeof v === 'object';

  // RFC 6901 pointer escaping: ~ and / are special inside a path segment.
  const ptr = (path) => (path.length ? '/' + path.map((p) => String(p).replace(/~/g, '~0').replace(/\//g, '~1')).join('/') : '');
  const dotted = (path) => (path.length ? '$.' + path.map((p) => (typeof p === 'number' ? '[' + p + ']' : p)).join('.').replace(/\.\[/g, '[') : '$');

  const preview = (v) => {
    const s = JSON.stringify(v);
    if (s === undefined) return 'undefined';
    return s.length > 60 ? s.slice(0, 57) + '…' : s;
  };

  /* ---------------- the diff itself ---------------- */

  function diff(a, b, path, out) {
    if (a === b) return out;

    const ta = typeOf(a);
    const tb = typeOf(b);

    if (ta !== tb) {
      out.push({ op: 'replace', path, from: a, to: b, note: ta + ' → ' + tb });
      return out;
    }

    if (ta === 'object') {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      [...keys].sort().forEach((k) => {
        const inA = Object.prototype.hasOwnProperty.call(a, k);
        const inB = Object.prototype.hasOwnProperty.call(b, k);
        if (inA && !inB) out.push({ op: 'remove', path: path.concat(k), from: a[k] });
        else if (!inA && inB) out.push({ op: 'add', path: path.concat(k), to: b[k] });
        else diff(a[k], b[k], path.concat(k), out);
      });
      return out;
    }

    if (ta === 'array') {
      if ($('opt-arr-index').checked) {
        const len = Math.max(a.length, b.length);
        for (let i = 0; i < len; i++) {
          if (i >= a.length) out.push({ op: 'add', path: path.concat(i), to: b[i] });
          else if (i >= b.length) out.push({ op: 'remove', path: path.concat(i), from: a[i] });
          else diff(a[i], b[i], path.concat(i), out);
        }
      } else {
        // Set-ish comparison: treat the arrays as bags of values, so a reordered
        // list is unchanged and only genuinely new/absent entries show up.
        const bag = b.map((v) => JSON.stringify(v));
        const seen = new Array(bag.length).fill(false);
        a.forEach((v, i) => {
          const key = JSON.stringify(v);
          const at = bag.findIndex((x, j) => !seen[j] && x === key);
          if (at === -1) out.push({ op: 'remove', path: path.concat(i), from: v });
          else seen[at] = true;
        });
        bag.forEach((x, j) => { if (!seen[j]) out.push({ op: 'add', path: path.concat(j), to: b[j] }); });
      }
      return out;
    }

    out.push({ op: 'replace', path, from: a, to: b });
    return out;
  }

  /* ---------------- output shapes ---------------- */

  function asChangeList(changes) {
    if (!changes.length) return 'No differences. The two documents are structurally identical.';
    const sign = { add: '+', remove: '−', replace: '~' };
    return changes.map((c) => {
      const head = sign[c.op] + ' ' + dotted(c.path);
      if (c.op === 'add') return head + '\n    added:   ' + preview(c.to);
      if (c.op === 'remove') return head + '\n    removed: ' + preview(c.from);
      return head + '\n    from:    ' + preview(c.from) + '\n    to:      ' + preview(c.to) + (c.note ? '   (' + c.note + ')' : '');
    }).join('\n\n');
  }

  function asJSONPatch(changes) {
    const ops = changes.map((c) => {
      if (c.op === 'add') return { op: 'add', path: ptr(c.path), value: c.to };
      if (c.op === 'remove') return { op: 'remove', path: ptr(c.path) };
      return { op: 'replace', path: ptr(c.path), value: c.to };
    });
    return JSON.stringify(ops, null, 2);
  }

  // RFC 7386 is defined over objects only: null means "delete this key", and
  // arrays are replaced wholesale rather than patched element by element.
  function asMergePatch(a, b) {
    function build(x, y) {
      if (!isContainer(x) || !isContainer(y) || Array.isArray(x) || Array.isArray(y)) return y;
      const patch = {};
      Object.keys(x).forEach((k) => { if (!(k in y)) patch[k] = null; });
      Object.keys(y).forEach((k) => {
        if (!(k in x)) patch[k] = y[k];
        else if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) patch[k] = build(x[k], y[k]);
      });
      return patch;
    }
    return JSON.stringify(build(a, b), null, 2);
  }

  /* ---------------- wiring (two inputs, so not TK.tool) ---------------- */

  const inputA = $('input-a');
  const inputB = $('input-b');
  const output = $('output');
  const aStatus = $('a-status');
  const bStatus = $('b-status');
  const outStatus = $('out-status');

  function parseInto(text, statusEl, label) {
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
    const a = parseInto(inputA.value, aStatus, 'A');
    const b = parseInto(inputB.value, bStatus, 'B');

    if (a.empty || b.empty) {
      output.value = '';
      TK.status(outStatus, 'Paste JSON into both panes to compare.');
      return;
    }
    if (a.error || b.error) {
      output.value = '';
      TK.status(outStatus, 'Fix the invalid document first.', 'err');
      return;
    }

    const changes = diff(a.value, b.value, [], []);
    const view = $('opt-view').value;

    if (view === 'patch') output.value = asJSONPatch(changes);
    else if (view === 'merge') output.value = asMergePatch(a.value, b.value);
    else output.value = asChangeList(changes);

    const counts = changes.reduce((acc, c) => { acc[c.op]++; return acc; }, { add: 0, remove: 0, replace: 0 });
    TK.status(
      outStatus,
      changes.length
        ? counts.add + ' added · ' + counts.remove + ' removed · ' + counts.replace + ' changed'
        : 'Identical — no differences found.',
      changes.length ? 'err' : 'ok'
    );
  }

  [inputA, inputB].forEach((el) => el.addEventListener('input', run));
  ['opt-view', 'opt-arr-index', 'opt-hide-same'].forEach((id) => $(id).addEventListener('change', run));
  $('btn-run').addEventListener('click', run);

  $('btn-swap').addEventListener('click', () => {
    const tmp = inputA.value;
    inputA.value = inputB.value;
    inputB.value = tmp;
    run();
  });

  $('btn-sample').addEventListener('click', () => { inputA.value = SAMPLE_A; inputB.value = SAMPLE_B; run(); });
  $('btn-clear').addEventListener('click', () => {
    inputA.value = '';
    inputB.value = '';
    output.value = '';
    TK.status(aStatus, 'Waiting for input.');
    TK.status(bStatus, '');
    TK.status(outStatus, '');
  });

  $('btn-copy').addEventListener('click', () => TK.copy(output.value, outStatus, output));
  $('btn-download').addEventListener('click', () => {
    const view = $('opt-view').value;
    TK.download(output.value, view === 'paths' ? 'diff.txt' : 'patch.json', 'text/plain');
  });

  TK.wireDrop(inputA, (t) => { inputA.value = t; run(); }, aStatus);
  TK.wireDrop(inputB, (t) => { inputB.value = t; run(); }, bStatus);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });
})();
