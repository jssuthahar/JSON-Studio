/*
  jsonl.js
  JSONL / NDJSON ⇄ JSON array. The value here is the error reporting: a 50k-line
  export with one bad record is the normal case, so invalid lines are named by
  line number and can optionally be skipped instead of failing the whole file.
*/

(function () {
  const $ = TK.$;
  const dirPill = $('dir-pill');
  const inLabel = $('in-label');
  const outLabel = $('out-label');

  let direction = 'auto';
  let lastResolved = 'l2j';

  const SAMPLE_JSONL = [
    '{"ts":"2026-03-14T09:21:00Z","level":"info","msg":"order placed","orderId":"A-1001"}',
    '{"ts":"2026-03-14T09:21:04Z","level":"warn","msg":"payment retry","orderId":"A-1001","attempt":2}',
    '{"ts":"2026-03-14T09:21:09Z","level":"error","msg":"gateway timeout","orderId":"A-1001"}'
  ].join('\n');

  const SAMPLE_JSON = JSON.stringify([
    { prompt: 'Summarise this payload', completion: 'A short summary.' },
    { prompt: 'Explain JSON Schema', completion: 'It describes the shape of JSON.' }
  ], null, 2);

  // A JSON array spans many lines; JSONL is one document per line. Deciding by
  // "does the whole thing parse as JSON" is the reliable test.
  function looksLikeArray(text) {
    const t = text.trim();
    if (!/^[[{]/.test(t)) return false;
    try { JSON.parse(t); return true; } catch (e) { return false; }
  }

  function jsonlToArray(text) {
    const lines = text.split('\n');
    const records = [];
    const bad = [];

    lines.forEach((line, i) => {
      const t = line.trim();
      if (!t) return;
      try {
        records.push(JSON.parse(t));
      } catch (err) {
        bad.push(i + 1);
      }
    });

    if (bad.length && !$('opt-skip').checked) {
      const shown = bad.slice(0, 5).join(', ') + (bad.length > 5 ? ', …' : '');
      throw new Error(bad.length + ' invalid line(s): ' + shown + '. Tick "Skip invalid lines" to ignore them.');
    }

    const out = $('opt-pretty').checked ? JSON.stringify(records, null, 2) : JSON.stringify(records);
    return {
      output: out,
      inMsg: records.length.toLocaleString() + ' records parsed' + (bad.length ? ' · ' + bad.length + ' skipped' : ''),
      inKind: bad.length ? 'err' : 'ok',
      outMsg: 'JSON array · ' + TK.bytes(new Blob([out]).size)
    };
  }

  function arrayToJSONL(text) {
    const data = TK.parseJSON(text);
    const rows = Array.isArray(data) ? data : [data];
    const out = rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
    return {
      output: out,
      inMsg: 'Valid JSON · ' + rows.length.toLocaleString() + ' records',
      outMsg: 'JSONL · ' + rows.length.toLocaleString() + ' lines · ' + TK.bytes(new Blob([out]).size)
    };
  }

  const api = TK.tool({
    filename: () => (lastResolved === 'l2j' ? 'records.json' : 'records.jsonl'),
    mime: 'application/json',
    options: ['opt-pretty', 'opt-skip'],
    run(text) {
      const dir = direction === 'auto' ? (looksLikeArray(text) ? 'j2l' : 'l2j') : direction;
      lastResolved = dir;
      inLabel.textContent = dir === 'j2l' ? 'JSON array input' : 'JSONL input';
      outLabel.textContent = dir === 'j2l' ? 'JSONL output' : 'JSON array output';
      return dir === 'j2l' ? arrayToJSONL(text) : jsonlToArray(text);
    }
  });

  dirPill.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dir]');
    if (!btn) return;
    direction = btn.dataset.dir;
    [...dirPill.querySelectorAll('button')].forEach((b) => b.classList.toggle('on', b === btn));
    if (api.input.value.trim()) api.run(true);
  });

  $('btn-swap').addEventListener('click', () => {
    if (!api.output.value) return;
    api.input.value = api.output.value;
    if (direction !== 'auto') {
      dirPill.querySelector('button[data-dir="' + (direction === 'j2l' ? 'l2j' : 'j2l') + '"]').click();
    } else {
      api.run(true);
    }
  });

  $('btn-sample-jsonl').addEventListener('click', () => api.setInput(SAMPLE_JSONL));
  $('btn-sample-json').addEventListener('click', () => api.setInput(SAMPLE_JSON));
})();
