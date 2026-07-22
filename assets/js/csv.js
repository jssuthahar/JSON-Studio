/*
  csv.js
  JSON ⇄ CSV. The CSV parser is hand-written rather than pulled from a CDN:
  RFC 4180 is small enough that a dependency costs more than it saves, and it
  keeps the page working offline.
*/

(function () {
  const $ = TK.$;
  const dirPill = $('dir-pill');
  const inLabel = $('in-label');
  const outLabel = $('out-label');

  let direction = 'auto';
  let lastResolved = 'j2c';

  const SAMPLE_JSON = JSON.stringify([
    { id: 1, name: 'Ada Lovelace', email: 'ada@example.com', address: { city: 'London', zip: 'NW1' }, active: true },
    { id: 2, name: 'Grace Hopper', email: 'grace@example.com', address: { city: 'New York', zip: '10001' }, active: false, note: 'VIP, "priority" account' }
  ], null, 2);

  const SAMPLE_CSV = 'id,name,email,address.city,active\n1,Ada Lovelace,ada@example.com,London,true\n2,"Hopper, Grace",grace@example.com,New York,false\n';

  const delim = () => ($('opt-delim').value === '\\t' ? '\t' : $('opt-delim').value);

  /* ---------------- CSV parsing (RFC 4180) ---------------- */

  function parseCSV(text, sep) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let i = 0;

    // Strip a UTF-8 BOM if Excel put one there.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    while (i < text.length) {
      const c = text[i];

      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
          quoted = false; i++; continue;
        }
        field += c; i++; continue;
      }

      if (c === '"' && field === '') { quoted = true; i++; continue; }
      if (c === sep) { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function quoteField(value, sep) {
    const s = value === null || value === undefined ? '' : String(value);
    return /["\n\r]|^\s|\s$/.test(s) || s.includes(sep) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /* ---------------- shaping ---------------- */

  function flatten(obj, prefix, out) {
    out = out || {};
    Object.keys(obj).forEach((k) => {
      const key = prefix ? prefix + '.' + k : k;
      const v = obj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
      else if (Array.isArray(v)) out[key] = JSON.stringify(v);
      else out[key] = v;
    });
    return out;
  }

  // "address.city" -> nested object, so CSV → JSON round-trips what we exported.
  function unflatten(row) {
    const out = {};
    Object.keys(row).forEach((key) => {
      const parts = key.split('.');
      let node = out;
      parts.forEach((p, idx) => {
        if (idx === parts.length - 1) node[p] = row[key];
        else node = (node[p] && typeof node[p] === 'object') ? node[p] : (node[p] = {});
      });
    });
    return out;
  }

  function coerce(value) {
    if (value === '') return null;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) {
      const n = Number(value);
      if (String(n) === value || Number.isFinite(n)) return n;
    }
    return value;
  }

  function looksLikeJSON(text) {
    const t = text.trim();
    if (!/^[[{]/.test(t)) return false;
    try { JSON.parse(t); return true; } catch (e) { return false; }
  }

  /* ---------------- conversion ---------------- */

  function jsonToCSV(text) {
    const data = TK.parseJSON(text);
    const rows = Array.isArray(data) ? data : [data];
    if (!rows.length) throw new Error('The array is empty — nothing to convert.');
    rows.forEach((r, i) => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) {
        throw new Error('Row ' + (i + 1) + ' is not an object. CSV needs an array of objects.');
      }
    });

    const shaped = $('opt-flatten').checked ? rows.map((r) => flatten(r)) : rows;

    // Header is the union of every row's keys, in first-seen order — otherwise
    // rows that gained a field later would silently lose it.
    const header = [];
    const seen = new Set();
    shaped.forEach((r) => Object.keys(r).forEach((k) => { if (!seen.has(k)) { seen.add(k); header.push(k); } }));

    const sep = delim();
    const lines = [header.map((h) => quoteField(h, sep)).join(sep)];
    shaped.forEach((r) => {
      lines.push(header.map((h) => {
        const v = r[h];
        return quoteField(v && typeof v === 'object' ? JSON.stringify(v) : v, sep);
      }).join(sep));
    });

    const csv = ($('opt-bom').checked ? '﻿' : '') + lines.join('\n') + '\n';
    return {
      output: csv,
      inMsg: 'Valid JSON · ' + rows.length.toLocaleString() + ' rows',
      outMsg: 'CSV · ' + header.length + ' columns · ' + TK.bytes(new Blob([csv]).size)
    };
  }

  function csvToJSON(text) {
    const rows = parseCSV(text, delim());
    if (!rows.length) throw new Error('No rows found.');
    const header = rows[0];
    const body = rows.slice(1).filter((r) => r.length && !(r.length === 1 && r[0] === ''));
    const typed = $('opt-typed').checked;

    const objects = body.map((cells) => {
      const flat = {};
      header.forEach((h, i) => {
        const raw = cells[i] === undefined ? '' : cells[i];
        flat[h] = typed ? coerce(raw) : raw;
      });
      return $('opt-flatten').checked ? unflatten(flat) : flat;
    });

    const json = JSON.stringify(objects, null, 2);
    return {
      output: json,
      inMsg: 'CSV parsed · ' + header.length + ' columns · ' + body.length.toLocaleString() + ' rows',
      outMsg: 'JSON · ' + TK.bytes(new Blob([json]).size)
    };
  }

  const api = TK.tool({
    filename: () => (lastResolved === 'j2c' ? 'data.csv' : 'data.json'),
    mime: 'text/plain',
    options: ['opt-delim', 'opt-flatten', 'opt-typed', 'opt-bom'],
    run(text) {
      const dir = direction === 'auto' ? (looksLikeJSON(text) ? 'j2c' : 'c2j') : direction;
      lastResolved = dir;
      inLabel.textContent = dir === 'j2c' ? 'JSON input' : 'CSV input';
      outLabel.textContent = dir === 'j2c' ? 'CSV output' : 'JSON output';
      return dir === 'j2c' ? jsonToCSV(text) : csvToJSON(text);
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
      dirPill.querySelector('button[data-dir="' + (direction === 'j2c' ? 'c2j' : 'j2c') + '"]').click();
    } else {
      api.run(true);
    }
  });

  $('btn-sample-json').addEventListener('click', () => api.setInput(SAMPLE_JSON));
  $('btn-sample-csv').addEventListener('click', () => api.setInput(SAMPLE_CSV));
})();
