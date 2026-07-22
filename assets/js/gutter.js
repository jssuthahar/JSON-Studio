/*
  gutter.js — line numbers beside every editor, and a way to reach the line an
  error is complaining about.

  The editors are plain textareas, deliberately: no editor library, no build
  step. That leaves line numbers as the one thing genuinely missing, so this
  draws them alongside and keeps them in sync.

  Three behaviours:
    · numbers track the content and scroll with it
    · when a tool reports "line 42", that number is highlighted and scrolled to
    · clicking a number puts the caret on that line

  The numbers are rendered as a single <pre> of newline-separated text rather
  than one element per line — a 50,000-line document stays cheap that way.
*/

(function () {
  const MAX_LINES = 60000; // past this, the gutter costs more than it gives

  const editors = [...document.querySelectorAll('.code-area')]
    .concat([...document.querySelectorAll('#editor')])
    .filter((el, i, all) => all.indexOf(el) === i);

  if (!editors.length) return;

  function attach(editor) {
    // Read-only output panes get numbers too — they are just as often the
    // thing you are reading an error against.
    const wrap = document.createElement('div');
    wrap.className = 'ca-wrap';
    editor.parentNode.insertBefore(wrap, editor);

    const gutter = document.createElement('pre');
    gutter.className = 'ca-gutter';
    gutter.setAttribute('aria-hidden', 'true');

    const mark = document.createElement('div');
    mark.className = 'ca-mark';
    mark.hidden = true;

    wrap.appendChild(gutter);
    wrap.appendChild(mark);
    wrap.appendChild(editor);

    let lineCount = 0;
    let off = false;

    function render() {
      const lines = editor.value.split('\n').length;
      if (lines > MAX_LINES) {
        if (!off) { off = true; wrap.classList.add('no-gutter'); }
        return;
      }
      if (off) { off = false; wrap.classList.remove('no-gutter'); }
      if (lines === lineCount) return;
      lineCount = lines;

      let text = '';
      for (let i = 1; i <= lines; i++) text += i + '\n';
      gutter.textContent = text;
      // Widen the gutter as the line count grows, so digits never clip.
      wrap.style.setProperty('--gutter-w', Math.max(2, String(lines).length) + 'ch');
    }

    const sync = () => {
      gutter.scrollTop = editor.scrollTop;
      if (!mark.hidden) positionMark();
    };

    function lineHeight() {
      const cs = getComputedStyle(editor);
      const lh = parseFloat(cs.lineHeight);
      return Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.6;
    }

    let markedLine = 0;

    function positionMark() {
      const pad = parseFloat(getComputedStyle(editor).paddingTop) || 0;
      const y = pad + (markedLine - 1) * lineHeight() - editor.scrollTop;
      mark.style.top = y + 'px';
      mark.style.height = lineHeight() + 'px';
      mark.hidden = y < -lineHeight() || y > editor.clientHeight;
    }

    /* Highlight the line a status message is complaining about. */
    function markLine(n) {
      if (!n || n < 1 || n > lineCount) { mark.hidden = true; markedLine = 0; return; }
      markedLine = n;
      mark.hidden = false;
      positionMark();
      // Bring it into view if the error is off-screen.
      const target = (n - 1) * lineHeight() - editor.clientHeight / 3;
      if (target < editor.scrollTop || target > editor.scrollTop + editor.clientHeight) {
        editor.scrollTop = Math.max(0, target);
        sync();
      }
    }

    function caretToLine(n) {
      const lines = editor.value.split('\n');
      let pos = 0;
      for (let i = 0; i < n - 1 && i < lines.length; i++) pos += lines[i].length + 1;
      editor.focus();
      editor.setSelectionRange(pos, pos + (lines[n - 1] || '').length);
    }

    gutter.addEventListener('click', (e) => {
      const n = Math.floor((e.offsetY + editor.scrollTop - (parseFloat(getComputedStyle(editor).paddingTop) || 0)) / lineHeight()) + 1;
      if (n >= 1 && n <= lineCount) caretToLine(n);
    });

    editor.addEventListener('input', () => { render(); sync(); });
    editor.addEventListener('scroll', sync);
    window.addEventListener('resize', () => { render(); sync(); });
    // Presentation mode changes the type size, which changes the line height.
    document.addEventListener('presentation-change', () => setTimeout(sync, 80));

    render();
    sync();
    return { markLine, wrap };
  }

  const attached = editors.map((el) => ({ el, api: attach(el) }));

  /* ---------------- link status messages to the gutter ---------------- */

  // Tools report problems in their status line ("… — line 12, column 5",
  // "invalid line(s): 2, 5"). Reading that keeps the wiring in one place
  // instead of asking every tool to report errors twice.
  function watchStatus(statusEl, editorEntry) {
    if (!statusEl || !editorEntry) return;
    const check = () => {
      const text = statusEl.textContent || '';
      const isError = statusEl.classList.contains('err') || /error|invalid|unexpected/i.test(text);
      const m = /line[s]?\D{0,3}(\d+)/i.exec(text);
      editorEntry.api.markLine(isError && m ? Number(m[1]) : 0);
    };
    new MutationObserver(check).observe(statusEl, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    check();
  }

  // The input editor is the one errors refer to.
  const inputEntry = attached.find((a) => a.el.id === 'input' || a.el.id === 'editor');
  watchStatus(document.getElementById('in-status') || document.getElementById('status'), inputEntry);
  watchStatus(document.getElementById('a-status'), attached.find((a) => a.el.id === 'input-a'));
  watchStatus(document.getElementById('schema-status'), attached.find((a) => a.el.id === 'input-schema'));

  window.JSONStudioGutter = { markLine: (n) => inputEntry && inputEntry.api.markLine(n) };
})();
