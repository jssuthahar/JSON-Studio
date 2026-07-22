/*
  popup.js — the toolbar launcher.

  Anything typed into the paste box is handed to the tool through the URL
  fragment, which the browser never transmits; the tool page reads it locally.
*/

const BASE = 'https://json.msdevbuild.com/';

const TOOLS = [
  { href: 'format.html', label: 'Formatter & validator', group: 'Inspect', keys: 'format beautify pretty minify validate escape' },
  { href: 'tool.html', label: 'JSON to diagram', group: 'Inspect', keys: 'diagram graph tree visualise visualize png svg' },
  { href: 'diff.html', label: 'JSON diff', group: 'Inspect', keys: 'diff compare patch' },
  { href: 'jsonpath.html', label: 'JSONPath tester', group: 'Inspect', keys: 'jsonpath query filter path' },
  { href: 'jwt.html', label: 'JWT decoder', group: 'Inspect', keys: 'jwt token claims bearer auth' },
  { href: 'json-schema.html', label: 'Schema generator', group: 'Schema', keys: 'schema infer draft' },
  { href: 'validate.html', label: 'Schema validator', group: 'Schema', keys: 'validate check errors' },
  { href: 'mock.html', label: 'Mock data generator', group: 'Schema', keys: 'mock fake test data seed' },
  { href: 'code.html', label: 'JSON to code', group: 'Convert', keys: 'code csharp c# typescript dart kotlin java python go class' },
  { href: 'csv.html', label: 'JSON ⇄ CSV', group: 'Convert', keys: 'csv excel spreadsheet' },
  { href: 'yaml-json.html', label: 'YAML ⇄ JSON', group: 'Convert', keys: 'yaml yml kubernetes' },
  { href: 'xml.html', label: 'JSON ⇄ XML', group: 'Convert', keys: 'xml soap' },
  { href: 'jsonl.html', label: 'JSONL ⇄ JSON', group: 'Convert', keys: 'jsonl ndjson logs dataset' },
  { href: 'sql.html', label: 'JSON to SQL', group: 'Convert', keys: 'sql insert create table postgres mysql sqlite' }
];

const list = document.getElementById('list');
const q = document.getElementById('q');
const paste = document.getElementById('paste');

let matches = TOOLS;
let cursor = 0;

function open(tool) {
  const text = paste.value.trim();
  const url = BASE + tool.href + (text ? '#input=' + encodeURIComponent(text) : '');
  chrome.tabs.create({ url });
  window.close();
}

function render() {
  const query = q.value.trim().toLowerCase();
  matches = query
    ? TOOLS.filter((t) => (t.label + ' ' + t.keys + ' ' + t.group).toLowerCase().includes(query))
    : TOOLS;
  cursor = 0;

  if (!matches.length) {
    list.innerHTML = '<div class="empty">No tool matches that.</div>';
    return;
  }

  let html = '';
  let lastGroup = '';
  matches.forEach((t, i) => {
    if (t.group !== lastGroup && !query) {
      html += '<div class="group">' + t.group + '</div>';
      lastGroup = t.group;
    }
    html += '<button class="row' + (i === 0 ? ' on' : '') + '" data-i="' + i + '">' +
      '<span class="label">' + t.label + '</span><span class="go">→</span></button>';
  });
  list.innerHTML = html;
}

function highlight() {
  [...list.querySelectorAll('.row')].forEach((r) => {
    const on = Number(r.dataset.i) === cursor;
    r.classList.toggle('on', on);
    if (on) r.scrollIntoView({ block: 'nearest' });
  });
}

list.addEventListener('click', (e) => {
  const row = e.target.closest('.row');
  if (row) open(matches[Number(row.dataset.i)]);
});

q.addEventListener('input', render);

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); cursor = (cursor + 1) % matches.length; highlight(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = (cursor - 1 + matches.length) % matches.length; highlight(); }
  else if (e.key === 'Enter' && document.activeElement !== paste && matches[cursor]) { e.preventDefault(); open(matches[cursor]); }
  else if (e.key === 'Escape') window.close();
});

// If the clipboard holds something JSON-shaped, offer it without a paste step.
navigator.clipboard.readText()
  .then((text) => {
    const t = (text || '').trim();
    if (t && /^[[{]/.test(t) && t.length < 200000) {
      paste.value = t;
      paste.classList.add('prefilled');
    }
  })
  .catch(() => { /* clipboard permission denied — the manual paste box still works */ });

render();
