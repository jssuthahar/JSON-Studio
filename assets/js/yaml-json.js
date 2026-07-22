/*
  yaml-json.js
  Two-way YAML ⇄ JSON conversion, entirely client-side (js-yaml from CDN).

  Direction can be pinned, but "Auto" is the default: most people paste one
  blob and just want the other format back, and JSON is a subset of YAML so we
  can decide by trying to parse as JSON first.
*/

(function () {
  const $ = TK.$;
  const dirPill = $('dir-pill');
  const inLabel = $('in-label');
  const outLabel = $('out-label');

  let direction = 'auto';   // auto | y2j | j2y
  let lastResolved = 'y2j'; // what auto-detect settled on last run

  const SAMPLE_YAML = [
    '# Sample deployment config',
    'name: order-service',
    'version: 2.4.0',
    'replicas: 3',
    'enabled: true',
    'resources:',
    '  limits:',
    '    cpu: 500m',
    '    memory: 512Mi',
    'env:',
    '  - name: ASPNETCORE_ENVIRONMENT',
    '    value: Production',
    '  - name: FEATURE_FLAGS',
    '    value: "checkout-v2,fast-ship"',
    'tags: [azure, dotnet, api]',
    'owner:',
    '  team: platform',
    '  contact: platform@example.com',
    ''
  ].join('\n');

  const SAMPLE_JSON = JSON.stringify({
    name: 'order-service',
    version: '2.4.0',
    replicas: 3,
    enabled: true,
    resources: { limits: { cpu: '500m', memory: '512Mi' } },
    env: [
      { name: 'ASPNETCORE_ENVIRONMENT', value: 'Production' },
      { name: 'FEATURE_FLAGS', value: 'checkout-v2,fast-ship' }
    ],
    tags: ['azure', 'dotnet', 'api'],
    owner: { team: 'platform', contact: 'platform@example.com' }
  }, null, 2);

  const jsonIndent = () => ($('opt-indent').value === 'tab' ? '\t' : Number($('opt-indent').value));
  // YAML has no tab indentation, so fall back to 2 when tabs are picked.
  const yamlIndent = () => ($('opt-indent').value === 'tab' ? 2 : Number($('opt-indent').value));

  function looksLikeJSON(text) {
    const t = text.trim();
    if (!/^[[{]/.test(t)) return false;
    try { JSON.parse(t); return true; } catch (e) { return false; }
  }

  function updateLabels(dir) {
    inLabel.textContent = dir === 'j2y' ? 'JSON input' : 'YAML input';
    outLabel.textContent = dir === 'j2y' ? 'YAML output' : 'JSON output';
  }

  const api = TK.tool({
    live: false, // handled below so we can respect the "Live convert" checkbox
    filename: () => (lastResolved === 'j2y' ? 'converted.yaml' : 'converted.json'),
    mime: 'text/plain',
    options: ['opt-indent', 'opt-sort'],
    run(text) {
      const dir = direction === 'auto' ? (looksLikeJSON(text) ? 'j2y' : 'y2j') : direction;
      lastResolved = dir;
      updateLabels(dir);

      let data;
      let result;
      try {
        if (dir === 'j2y') {
          data = JSON.parse(text);
          if ($('opt-sort').checked) data = TK.sortDeep(data);
          result = jsyaml.dump(data, {
            indent: yamlIndent(),
            lineWidth: 100,
            noRefs: true, // inline repeated objects instead of emitting &anchors
            quotingType: '"'
          });
        } else {
          // loadAll so multi-document YAML (--- separated) round-trips to an array.
          const docs = jsyaml.loadAll(text);
          data = docs.length === 1 ? docs[0] : docs;
          if (data === undefined) data = null;
          if ($('opt-sort').checked) data = TK.sortDeep(data);
          result = JSON.stringify(data, null, jsonIndent());
        }
      } catch (err) {
        const where = err && err.mark && typeof err.mark.line === 'number'
          ? ' (line ' + (err.mark.line + 1) + ', column ' + (err.mark.column + 1) + ')'
          : '';
        throw new Error((err && err.message ? err.message : String(err)) + where);
      }

      return {
        output: result,
        inMsg: (dir === 'j2y' ? 'Valid JSON' : 'Valid YAML') + ' · ' + text.length.toLocaleString() + ' chars in',
        outMsg: (dir === 'j2y' ? 'YAML' : 'JSON') + ' generated · ' + TK.bytes(new Blob([result]).size) + ' out'
      };
    }
  });

  dirPill.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-dir]');
    if (!btn) return;
    direction = btn.dataset.dir;
    [...dirPill.querySelectorAll('button')].forEach((b) => b.classList.toggle('on', b === btn));
    if (direction !== 'auto') updateLabels(direction);
    if (api.input.value.trim()) api.run(true);
  });

  $('btn-swap').addEventListener('click', () => {
    if (!api.output.value) return;
    api.input.value = api.output.value;
    // After a swap the content is the opposite format; when the user has pinned
    // a direction, flip it so the swap actually does something useful.
    if (direction !== 'auto') {
      dirPill.querySelector('button[data-dir="' + (direction === 'j2y' ? 'y2j' : 'j2y') + '"]').click();
    } else {
      api.run(true);
    }
  });

  $('btn-sample-yaml').addEventListener('click', () => api.setInput(SAMPLE_YAML));
  $('btn-sample-json').addEventListener('click', () => api.setInput(SAMPLE_JSON));

  api.input.addEventListener('input', () => { if ($('opt-live').checked) api.run(true); });
  $('opt-live').addEventListener('change', () => { if ($('opt-live').checked) api.run(true); });
})();
