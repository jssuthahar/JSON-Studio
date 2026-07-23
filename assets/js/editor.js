/*
  editor.js — makes the plain textareas read like a code editor.

  The editors stay textareas on purpose: no editor library, no build step, no
  20,000 lines of someone else's code between a paste and a result. What was
  missing was everything you actually look at — colour, the line you are on,
  and where the caret is. All three are painted around the textarea rather
  than inside it:

    · a <pre> highlight layer sits behind the textarea, which is made
      transparent; the two are kept in exact alignment by copying the
      textarea's own computed metrics onto the layer
    · a band marks the caret's line
    · the pane header gains a "Ln 4, Col 12 · 128 lines · 2.4 KB" readout

  Highlighting picks a mode from the content (JSON, XML, SQL, YAML or a
  generic fallback), so a pane that shows generated SQL colours as SQL
  without any page needing to declare it.

  Runs after gutter.js and reuses the .ca-wrap it builds.
*/

(function () {
  const MAX_HL = 300000;   // past this, colour costs more than it gives
  const DEBOUNCE = 60;

  /* ---------------- tokenisers ---------------- */

  const esc = (s) => s.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));

  // Each mode is a list of [pattern, class]. They are joined into one
  // alternation and run in a single pass, so the cost is linear in the text.
  const MODES = {
    json: [
      [/"(?:\\.|[^"\\])*"(?=\s*:)/, 'k'],                 // key
      [/"(?:\\.|[^"\\])*"/, 's'],                          // string
      [/\b(?:true|false)\b/, 'b'],
      [/\bnull\b/, 'z'],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'n'],
      [/[{}[\],:]/, 'p']
    ],
    xml: [
      [/<!--[\s\S]*?-->/, 'c'],
      [/<[?!/]?[\w:.-]+/, 't'],
      [/[\w:.-]+(?==)/, 'a'],
      [/"[^"]*"|'[^']*'/, 's'],
      [/\/?>/, 't']
    ],
    sql: [
      [/--[^\n]*/, 'c'],
      [/\/\*[\s\S]*?\*\//, 'c'],
      [/'(?:''|[^'])*'/, 's'],
      [/"[^"]*"|`[^`]*`/, 'k'],
      [/\b(?:SELECT|INSERT|INTO|VALUES|CREATE|TABLE|PRIMARY|KEY|NOT|NULL|DEFAULT|FOREIGN|REFERENCES|UNIQUE|INDEX|ALTER|ADD|DROP|UPDATE|SET|DELETE|FROM|WHERE|AND|OR|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP|ORDER|BY|LIMIT|AS|IF|EXISTS|BEGIN|COMMIT)\b/i, 'b'],
      [/\b(?:INTEGER|INT|BIGINT|SMALLINT|SERIAL|TEXT|VARCHAR|CHAR|BOOLEAN|BOOL|REAL|DOUBLE|DECIMAL|NUMERIC|DATE|TIMESTAMP|TIMESTAMPTZ|JSON|JSONB|BLOB|UUID)\b/i, 't'],
      [/\b\d+(?:\.\d+)?\b/, 'n']
    ],
    yaml: [
      [/#[^\n]*/, 'c'],
      [/^\s*-\s/m, 'p'],
      [/^[ \t]*[\w.$-]+(?=\s*:)/m, 'k'],
      [/"(?:\\.|[^"\\])*"|'(?:''|[^'])*'/, 's'],
      [/\b(?:true|false|yes|no|on|off)\b/i, 'b'],
      [/\bnull\b|~/, 'z'],
      [/\b-?\d+(?:\.\d+)?\b/, 'n']
    ],
    code: [
      [/\/\/[^\n]*|#[^\n]*/, 'c'],
      [/\/\*[\s\S]*?\*\//, 'c'],
      [/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/, 's'],
      [/\b(?:public|private|protected|internal|class|struct|interface|record|enum|abstract|final|static|const|val|var|let|def|func|fn|function|import|package|from|type|extends|implements|override|get|set|new|return|namespace|data)\b/, 'b'],
      [/\b(?:string|String|int|Int|long|double|float|bool|boolean|Boolean|byte|char|object|Object|void|List|Map|Dict|Array|number|any|dynamic|Optional)\b/, 't'],
      [/\b-?\d+(?:\.\d+)?\b/, 'n']
    ]
  };

  const COMPILED = {};
  function compiled(mode) {
    if (COMPILED[mode]) return COMPILED[mode];
    const rules = MODES[mode];
    const src = rules.map((r) => '(' + r[0].source + ')').join('|');
    const flags = 'g' + (rules.some((r) => r[0].flags.includes('m')) ? 'm' : '') +
                        (rules.some((r) => r[0].flags.includes('i')) ? 'i' : '');
    return (COMPILED[mode] = { re: new RegExp(src, flags), classes: rules.map((r) => r[1]) });
  }

  function detect(text) {
    const t = text.slice(0, 2000).trim();
    if (!t) return 'json';
    if (t[0] === '{' || t[0] === '[' || /^"[^"]*"\s*:/.test(t)) return 'json';
    if (t[0] === '<') return 'xml';
    if (/^(--|\/\*|\s*(SELECT|CREATE|INSERT|UPDATE|DELETE|ALTER|DROP)\b)/i.test(t)) return 'sql';
    if (/^(package|import|using|public|private|class|struct|interface|def |func |from |type |export |const |@)/m.test(t)) return 'code';
    if (/^[\w.$-]+\s*:(\s|$)/m.test(t) || /^\s*-\s+/m.test(t)) return 'yaml';
    return 'code';
  }

  function paint(text, mode) {
    const { re, classes } = compiled(mode);
    let out = '';
    let last = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out += esc(text.slice(last, m.index));
      let cls = '';
      for (let i = 1; i < m.length; i++) { if (m[i] !== undefined) { cls = classes[i - 1]; break; } }
      out += '<i class="t-' + cls + '">' + esc(m[0]) + '</i>';
      last = m.index + m[0].length;
      if (m[0] === '') re.lastIndex++;         // never spin on a zero-width match
    }
    out += esc(text.slice(last));
    // A trailing newline is not rendered by <pre>; keep the layer as tall as
    // the textarea's content so the last line still lines up.
    return out + '\n';
  }

  /* ---------------- per-editor wiring ---------------- */

  const editors = [...document.querySelectorAll('.code-area, #editor')]
    .filter((el, i, all) => all.indexOf(el) === i);
  if (!editors.length) return;

  const bytes = (n) => (n < 1024 ? n + ' B' : n < 1024 * 1024 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB');

  function enhance(ta) {
    const wrap = ta.closest('.ca-wrap');
    if (!wrap) return;                          // gutter.js opted out of this one

    wrap.classList.add('hl-on');

    const hl = document.createElement('pre');
    hl.className = 'ca-hl';
    hl.setAttribute('aria-hidden', 'true');
    const caretLine = document.createElement('div');
    caretLine.className = 'ca-line';
    caretLine.hidden = true;
    wrap.insertBefore(hl, ta);
    wrap.insertBefore(caretLine, ta);

    // The readout sits at the right-hand end of the pane's status row — where
    // an editor puts it. It is a separate element rather than appended text,
    // because tools rewrite the status line's textContent wholesale.
    const pane = ta.closest('.pane');
    let meta = null;
    if (pane && !pane.querySelector('.ed-meta')) {
      meta = document.createElement('span');
      meta.className = 'ed-meta';
      pane.appendChild(meta);
    }

    /* Alignment: rather than duplicating the textarea's CSS (which changes in
       presentation mode, and per page), read it back and copy it over. */
    function measure() {
      const cs = getComputedStyle(ta);
      hl.style.font = cs.font;
      hl.style.letterSpacing = cs.letterSpacing;
      hl.style.lineHeight = cs.lineHeight;
      hl.style.padding = cs.padding;
      hl.style.tabSize = cs.tabSize;
      hl.style.left = ta.offsetLeft + 'px';
      hl.style.top = ta.offsetTop + 'px';
      hl.style.width = ta.offsetWidth + 'px';
      hl.style.height = ta.offsetHeight + 'px';
      caretLine.style.left = ta.offsetLeft + 'px';
      caretLine.style.width = ta.offsetWidth + 'px';
    }

    let mode = 'json';
    let timer = 0;

    function render() {
      const text = ta.value;
      if (text.length > MAX_HL) { wrap.classList.remove('hl-on'); hl.innerHTML = ''; return; }
      wrap.classList.add('hl-on');
      mode = detect(text);
      hl.innerHTML = paint(text, mode);
      sync();
    }

    function sync() {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
      if (!caretLine.hidden) placeCaretLine();
    }

    function lineHeight() {
      const cs = getComputedStyle(ta);
      const lh = parseFloat(cs.lineHeight);
      return Number.isFinite(lh) ? lh : parseFloat(cs.fontSize) * 1.6;
    }

    function caretPos() {
      const upto = ta.value.slice(0, ta.selectionStart);
      const nl = upto.lastIndexOf('\n');
      return { line: upto.split('\n').length, col: upto.length - nl };
    }

    function placeCaretLine() {
      const { line } = caretPos();
      const pad = parseFloat(getComputedStyle(ta).paddingTop) || 0;
      const y = pad + (line - 1) * lineHeight() - ta.scrollTop;
      caretLine.style.top = ta.offsetTop + y + 'px';
      caretLine.style.height = lineHeight() + 'px';
      caretLine.hidden = y < 0 || y > ta.clientHeight - lineHeight() / 2;
    }

    function readout() {
      if (!meta) return;
      const v = ta.value;
      const lines = v ? v.split('\n').length : 0;
      const size = new Blob([v]).size;
      const focused = document.activeElement === ta;
      let label = '';
      if (v) {
        if (focused) { const c = caretPos(); label = 'Ln ' + c.line + ', Col ' + c.col; }
        else label = lines + (lines === 1 ? ' line' : ' lines') + ' · ' + bytes(size);
      }
      meta.textContent = label;
      meta.dataset.mode = v ? mode : '';
    }

    const queue = () => { clearTimeout(timer); timer = setTimeout(() => { render(); readout(); }, DEBOUNCE); };

    ta.addEventListener('input', queue);
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keyup', () => { placeCaretLine(); readout(); });
    ta.addEventListener('click', () => { placeCaretLine(); readout(); });
    ta.addEventListener('focus', () => { caretLine.hidden = false; placeCaretLine(); readout(); });
    ta.addEventListener('blur', () => { caretLine.hidden = true; readout(); });

    // Tools write results straight into .value, which fires no event.
    const desc = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    Object.defineProperty(ta, 'value', {
      get() { return desc.get.call(this); },
      set(v) { desc.set.call(this, v); queue(); }
    });

    if (window.ResizeObserver) new ResizeObserver(() => { measure(); sync(); }).observe(ta);
    window.addEventListener('resize', () => { measure(); sync(); });
    document.addEventListener('presentation-change', () => setTimeout(() => { measure(); sync(); }, 90));

    measure();
    render();
    readout();
  }

  editors.forEach(enhance);
})();
