/*
  tool-kit.js
  Shared plumbing for the two-pane tools. Every tool page ends up needing the
  same things — read input, show a status, copy, download, upload, drag-drop,
  ⌘/Ctrl+Enter — so it lives here once and each tool file only has to supply
  the actual transformation.

  Pages opt in by using the standard element ids:
    #input #output #in-status #out-status
    #btn-run #btn-copy #btn-download #btn-upload #btn-clear #btn-sample #file-input
  Every one of them is optional; whatever is present gets wired.
*/

(function () {
  const $ = (id) => document.getElementById(id);

  function status(el, msg, kind) {
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'pane-status' + (kind ? ' ' + kind : '');
  }

  async function copy(text, statusEl, fallbackEl) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      status(statusEl, 'Copied to clipboard.', 'ok');
    } catch (e) {
      // Clipboard API needs a secure context; file:// pages fall back to select.
      if (fallbackEl) fallbackEl.select();
      status(statusEl, 'Press ⌘/Ctrl + C to copy the selected text.');
    }
  }

  function download(text, filename, mime) {
    if (!text) return;
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function readFile(file, onText, errStatusEl) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onText(String(reader.result));
    reader.onerror = () => status(errStatusEl, 'Could not read that file.', 'err');
    reader.readAsText(file);
  }

  function wireDrop(area, onText, errStatusEl) {
    if (!area) return;
    ['dragenter', 'dragover'].forEach((evt) =>
      area.addEventListener(evt, (e) => { e.preventDefault(); area.classList.add('drop-active'); }));
    ['dragleave', 'drop'].forEach((evt) =>
      area.addEventListener(evt, () => area.classList.remove('drop-active')));
    area.addEventListener('drop', (e) => {
      e.preventDefault();
      readFile(e.dataTransfer.files[0], onText, errStatusEl);
    });
  }

  // Recursively order object keys — used by several tools for stable output.
  function sortDeep(value) {
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === 'object') {
      const out = {};
      Object.keys(value).sort().forEach((k) => { out[k] = sortDeep(value[k]); });
      return out;
    }
    return value;
  }

  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  /*
    Content handed over in the URL fragment (#input=…), used by the browser
    extension's "send selection to JSON Studio" action. The fragment never
    leaves the browser — servers don't receive it — so this stays consistent
    with the no-upload promise. The value only ever reaches a textarea's
    .value, never innerHTML.
  */
  function hashInput() {
    const m = /[#&]input=([^&]*)/.exec(location.hash || '');
    if (!m) return null;
    try {
      return decodeURIComponent(m[1].replace(/\+/g, ' '));
    } catch (e) {
      return null;
    }
  }

  function parseJSON(text) {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(err.message);
    }
  }

  /*
    tool(cfg) wires a standard single-input / single-output page.

    cfg.run(text)  -> { output, inMsg, outMsg }   (throw an Error to report a
                                                   problem with the input)
    cfg.sample     -> string or () => string
    cfg.filename   -> string or () => string
    cfg.options    -> element ids that should re-run the tool when changed
    cfg.live       -> re-run on every keystroke (default true)
  */
  function tool(cfg) {
    const input = $('input');
    const output = $('output');
    const inStatus = $('in-status');
    const outStatus = $('out-status');

    function run(quiet) {
      const text = input.value;
      if (!text.trim()) {
        if (output) output.value = '';
        status(inStatus, 'Waiting for input.');
        status(outStatus, '');
        return;
      }
      try {
        const res = cfg.run(text) || {};
        if (output) output.value = res.output === undefined ? '' : res.output;
        status(inStatus, res.inMsg || 'Valid input.', res.inKind || 'ok');
        status(outStatus, res.outMsg || '', res.outKind || 'ok');
      } catch (err) {
        if (output) output.value = '';
        status(inStatus, (err && err.message) || String(err), 'err');
        status(outStatus, cfg.errHint || 'Nothing to show — fix the input first.', 'err');
        if (!quiet) input.focus();
      }
    }

    const setInput = (text) => { input.value = text; run(true); };

    if ($('btn-run')) $('btn-run').addEventListener('click', () => run());
    if (cfg.live !== false) input.addEventListener('input', () => run(true));

    (cfg.options || []).forEach((id) => {
      const el = $(id);
      if (!el) return;
      const evt = (el.tagName === 'INPUT' && el.type === 'text') ? 'input' : 'change';
      el.addEventListener(evt, () => { if (input.value.trim()) run(true); });
    });

    if ($('btn-sample')) $('btn-sample').addEventListener('click', () => {
      setInput(typeof cfg.sample === 'function' ? cfg.sample() : cfg.sample);
    });

    if ($('btn-clear')) $('btn-clear').addEventListener('click', () => {
      input.value = '';
      if (output) output.value = '';
      status(inStatus, 'Waiting for input.');
      status(outStatus, '');
      input.focus();
    });

    if ($('btn-copy')) $('btn-copy').addEventListener('click', () => copy(output.value, outStatus, output));

    if ($('btn-download')) $('btn-download').addEventListener('click', () => {
      const name = typeof cfg.filename === 'function' ? cfg.filename() : (cfg.filename || 'output.txt');
      download(output.value, name, cfg.mime);
    });

    if ($('btn-upload') && $('file-input')) {
      $('btn-upload').addEventListener('click', () => $('file-input').click());
      $('file-input').addEventListener('change', (e) => {
        readFile(e.target.files[0], setInput, inStatus);
        e.target.value = '';
      });
    }

    wireDrop(input, setInput, inStatus);

    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });

    // Content handed over in the fragment: either the extension's plain
    // #input=, or a compressed #data= link built by payload-link.js.
    function takeFromLink() {
      if (window.JSONStudioLink) {
        window.JSONStudioLink.readLink().then((text) => { if (text) setInput(text); });
      } else {
        const handed = hashInput();
        if (handed) setInput(handed);
      }
    }
    takeFromLink();
    // Opening a shared link while this tool is already open only changes the
    // fragment — the page never reloads, so the payload has to be picked up
    // here or it would be silently ignored.
    window.addEventListener('hashchange', takeFromLink);

    return { run, setInput, input, output, inStatus, outStatus };
  }

  window.TK = { $, status, copy, download, readFile, wireDrop, sortDeep, bytes, parseJSON, hashInput, tool };
})();
