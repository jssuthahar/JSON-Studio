/*
  history.js — nothing you paste should disappear because you hit reload.

  Two related things, both entirely local:

    · a draft of whatever is currently in the tool, restored when you come
      back to the page
    · a short history of previous documents, reachable from a Recent menu

  Everything lives in this browser's localStorage under keys scoped to the
  tool, and is never sent anywhere. A Clear button empties both, because a tool
  that quietly remembers payloads needs an obvious way to forget them.
*/

(function () {
  const editor = document.getElementById('input') || document.getElementById('editor');
  if (!editor) return;

  const file = window.location.pathname.split('/').pop() || 'index.html';
  const DRAFT = 'json-studio-draft:' + file;
  const HIST = 'json-studio-history:' + file;

  const MAX_ENTRIES = 10;
  const MAX_CHARS = 200000;   // don't let one giant payload fill the quota
  const MIN_CHARS = 12;       // not worth remembering a few characters

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (e) { return fallback; }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // Quota exceeded: drop the oldest history and try once more.
      try {
        const trimmed = read(HIST, []).slice(0, 3);
        localStorage.setItem(HIST, JSON.stringify(trimmed));
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e2) {
        return false;
      }
    }
  };

  /* ---------------- draft ---------------- */

  let saveTimer = null;

  function saveDraft() {
    const text = editor.value;
    if (!text.trim()) { localStorage.removeItem(DRAFT); return; }
    if (text.length > MAX_CHARS) return; // too big to keep; the tool still works
    write(DRAFT, { text, t: Date.now() });
  }

  function restoreDraft() {
    // A link carrying a payload, or content already on the page, wins over
    // whatever was here last time.
    if (editor.value.trim()) return false;
    if (/[#&](data|input)=/.test(location.hash)) return false;
    const draft = read(DRAFT, null);
    if (!draft || !draft.text) return false;
    editor.value = draft.text;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }

  /* ---------------- history ---------------- */

  function remember() {
    const text = editor.value.trim();
    if (text.length < MIN_CHARS || text.length > MAX_CHARS) return;
    const list = read(HIST, []);
    if (list.length && list[0].text === text) return;          // no duplicate in a row
    const next = [{ text, t: Date.now() }]
      .concat(list.filter((e) => e.text !== text))
      .slice(0, MAX_ENTRIES);
    write(HIST, next);
    renderMenu();
  }

  function ago(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    return Math.round(s / 86400) + 'd ago';
  }

  const preview = (text) => {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > 46 ? flat.slice(0, 45) + '…' : flat;
  };

  const size = (n) => (n < 1024 ? n + ' B' : (n / 1024).toFixed(1) + ' KB');

  /* ---------------- the Recent menu ---------------- */

  let wrap = null;
  let menu = null;

  function buildMenu() {
    // Sits with the other buttons above the input: the pane header on a
    // converter, the button strip on the diagram page.
    const host = document.querySelector('.pane .pane-head') || document.querySelector('.tool-controls');
    if (!host) return;

    wrap = document.createElement('span');
    wrap.className = 'hist-menu';
    wrap.innerHTML = `
      <button type="button" id="btn-recent" title="Documents you had open before, kept in this browser">Recent ▾</button>
      <span class="hist-pop" id="hist-pop"></span>`;

    const anchor = host.querySelector('#btn-sample') || host.querySelector('button');
    if (anchor && anchor.parentNode === host) host.insertBefore(wrap, anchor.nextSibling);
    else host.appendChild(wrap);

    menu = wrap.querySelector('#hist-pop');

    wrap.querySelector('#btn-recent').addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) wrap.classList.remove('open'); });

    menu.addEventListener('click', (e) => {
      const entry = e.target.closest('[data-i]');
      if (entry) {
        const item = read(HIST, [])[Number(entry.dataset.i)];
        if (item) {
          editor.value = item.text;
          editor.dispatchEvent(new Event('input', { bubbles: true }));
          editor.focus();
        }
        wrap.classList.remove('open');
        return;
      }
      if (e.target.closest('#hist-clear')) {
        // A save may already be queued from the last keystroke; cancel it, or
        // it would quietly write the draft back a moment after clearing.
        clearTimeout(saveTimer);
        localStorage.removeItem(HIST);
        localStorage.removeItem(DRAFT);
        renderMenu();
        wrap.classList.remove('open');
      }
    });

    renderMenu();
  }

  function renderMenu() {
    if (!menu) return;
    const list = read(HIST, []);
    wrap.classList.toggle('has-items', list.length > 0);

    menu.innerHTML = list.length
      ? '<span class="hist-head">Recent in this browser</span>' +
        list.map((e, i) => `
          <button type="button" class="hist-row" data-i="${i}">
            <span class="hist-prev">${preview(e.text).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</span>
            <span class="hist-meta">${size(e.text.length)} · ${ago(e.t)}</span>
          </button>`).join('') +
        '<button type="button" class="hist-clear" id="hist-clear">Clear history</button>'
      : '<span class="hist-empty">Nothing yet. Documents you work on are remembered here — in this browser only.</span>';
  }

  /* ---------------- wiring ---------------- */

  editor.addEventListener('input', () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 700);
  });

  // A run is the signal that a document mattered, so that is when it enters
  // history — rather than on every keystroke.
  const runBtn = document.getElementById('btn-run') || document.getElementById('btn-render');
  if (runBtn) runBtn.addEventListener('click', () => setTimeout(remember, 60));
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') setTimeout(remember, 60);
  });
  // Also on the way out, so a session that never pressed Run is not lost.
  window.addEventListener('pagehide', () => { saveDraft(); remember(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveDraft(); remember(); } });

  function init() {
    buildMenu();
    const restored = restoreDraft();
    if (restored) {
      const status = document.getElementById('in-status') || document.getElementById('status');
      if (status && window.TK) TK.status(status, 'Restored what you had here last time. Recent ▾ has earlier documents.', 'ok');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.JSONStudioHistory = {
    remember,
    saveDraft,
    clear: () => {
      clearTimeout(saveTimer);
      localStorage.removeItem(HIST);
      localStorage.removeItem(DRAFT);
      renderMenu();
    }
  };
})();
