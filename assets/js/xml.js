/*
  xml.js
  JSON ⇄ XML. Parsing uses the browser's own DOMParser — no library, and no
  custom XML parser of mine to get subtly wrong.

  Mapping (the common "Badgerfish-lite" convention):
    attributes  -> "@name" keys
    text        -> "#text" (or the bare value when an element has no attributes)
    repeats     -> arrays
*/

(function () {
  const $ = TK.$;
  const dirPill = $('dir-pill');
  const inLabel = $('in-label');
  const outLabel = $('out-label');

  let direction = 'auto';
  let lastResolved = 'j2x';

  const SAMPLE_JSON = JSON.stringify({
    order: {
      '@id': 'A-1001',
      customer: { name: 'Ada Lovelace', email: 'ada@example.com' },
      items: { item: [{ '@sku': 'KB-113', qty: 1 }, { '@sku': 'CB-007', qty: 2 }] },
      total: 249.95,
      paid: true
    }
  }, null, 2);

  const SAMPLE_XML = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<order id="A-1001">',
    '  <customer>',
    '    <name>Ada Lovelace</name>',
    '    <email>ada@example.com</email>',
    '  </customer>',
    '  <items>',
    '    <item sku="KB-113"><qty>1</qty></item>',
    '    <item sku="CB-007"><qty>2</qty></item>',
    '  </items>',
    '  <total>249.95</total>',
    '</order>'
  ].join('\n');

  const pad = () => Number($('opt-indent').value);
  const escapeText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

  // XML element names can't start with a digit or contain spaces.
  const safeName = (name) => {
    const cleaned = String(name).replace(/[^\w.-]/g, '_');
    return /^[A-Za-z_]/.test(cleaned) ? cleaned : '_' + cleaned;
  };

  /* ---------------- JSON → XML ---------------- */

  function jsonToXML(text) {
    const data = TK.parseJSON(text);
    const indent = pad();
    const nl = indent ? '\n' : '';

    function renderValue(name, value, depth) {
      const sp = indent ? ' '.repeat(indent * depth) : '';

      if (Array.isArray(value)) {
        // An array becomes repeated sibling elements of the same name.
        return value.map((v) => renderValue(name, v, depth)).join(nl);
      }

      if (value === null || value === undefined) return sp + '<' + safeName(name) + ' />';

      if (typeof value !== 'object') {
        return sp + '<' + safeName(name) + '>' + escapeText(value) + '</' + safeName(name) + '>';
      }

      const attrs = [];
      const children = [];
      let textContent = null;

      Object.keys(value).forEach((k) => {
        if (k[0] === '@') attrs.push(' ' + safeName(k.slice(1)) + '="' + escapeAttr(value[k]) + '"');
        else if (k === '#text') textContent = value[k];
        else children.push(renderValue(k, value[k], depth + 1));
      });

      const open = '<' + safeName(name) + attrs.join('');
      if (textContent !== null && !children.length) {
        return sp + open + '>' + escapeText(textContent) + '</' + safeName(name) + '>';
      }
      if (!children.length) return sp + open + ' />';
      return sp + open + '>' + nl + children.join(nl) + nl + sp + '</' + safeName(name) + '>';
    }

    // A payload with a single top-level key already has its root; otherwise
    // wrap it, since XML has no concept of a document with two roots.
    const keys = data && typeof data === 'object' && !Array.isArray(data) ? Object.keys(data) : [];
    const single = keys.length === 1 && !keys[0].startsWith('@') && keys[0] !== '#text';
    const body = single
      ? renderValue(keys[0], data[keys[0]], 0)
      : renderValue($('opt-rootname').value.trim() || 'root', data, 0);

    const xml = ($('opt-decl').checked ? '<?xml version="1.0" encoding="UTF-8"?>' + (nl || '\n') : '') + body + '\n';
    return {
      output: xml,
      inMsg: 'Valid JSON · ' + text.length.toLocaleString() + ' chars',
      outMsg: 'XML · ' + TK.bytes(new Blob([xml]).size)
    };
  }

  /* ---------------- XML → JSON ---------------- */

  function xmlToJSON(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const failure = doc.querySelector('parsererror');
    if (failure) {
      throw new Error(failure.textContent.replace(/\s+/g, ' ').trim().slice(0, 220));
    }

    let elements = 0;

    function convert(node) {
      elements++;
      const obj = {};
      let hasChildren = false;

      for (const attr of node.attributes || []) obj['@' + attr.name] = attr.value;

      const texts = [];
      for (const child of node.childNodes) {
        if (child.nodeType === 3 || child.nodeType === 4) { // text / CDATA
          const t = child.nodeValue.trim();
          if (t) texts.push(t);
          continue;
        }
        if (child.nodeType !== 1) continue; // skip comments and PIs
        hasChildren = true;
        const name = child.nodeName;
        const value = convert(child);
        if (Object.prototype.hasOwnProperty.call(obj, name)) {
          if (!Array.isArray(obj[name])) obj[name] = [obj[name]];
          obj[name].push(value);
        } else {
          obj[name] = value;
        }
      }

      const text = texts.join(' ');
      if (!hasChildren && !Object.keys(obj).length) return text;  // plain leaf
      if (text) obj['#text'] = text;
      return obj;
    }

    const root = doc.documentElement;
    const json = JSON.stringify({ [root.nodeName]: convert(root) }, null, 2);
    return {
      output: json,
      inMsg: 'Valid XML · ' + elements.toLocaleString() + ' elements',
      outMsg: 'JSON · ' + TK.bytes(new Blob([json]).size)
    };
  }

  const api = TK.tool({
    filename: () => (lastResolved === 'j2x' ? 'converted.xml' : 'converted.json'),
    mime: 'text/plain',
    options: ['opt-rootname', 'opt-indent', 'opt-decl'],
    run(text) {
      const looksXML = text.trim().startsWith('<');
      const dir = direction === 'auto' ? (looksXML ? 'x2j' : 'j2x') : direction;
      lastResolved = dir;
      inLabel.textContent = dir === 'j2x' ? 'JSON input' : 'XML input';
      outLabel.textContent = dir === 'j2x' ? 'XML output' : 'JSON output';
      return dir === 'j2x' ? jsonToXML(text) : xmlToJSON(text);
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
      dirPill.querySelector('button[data-dir="' + (direction === 'j2x' ? 'x2j' : 'j2x') + '"]').click();
    } else {
      api.run(true);
    }
  });

  $('btn-sample-json').addEventListener('click', () => api.setInput(SAMPLE_JSON));
  $('btn-sample-xml').addEventListener('click', () => api.setInput(SAMPLE_XML));
})();
