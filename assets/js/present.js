/*
  present.js — presentation mode for every tool page.

  One file serves all the tools because it works from the page's structure
  rather than from per-page configuration: it finds the panes, decides which
  one is the thing being demonstrated, and hides the rest on request. A tool
  page needs no changes to gain presentation mode beyond loading this file.

  Entering presentation mode:
    · hides the site header, footer, page title and option bar
    · gives the working surface the whole viewport, and asks for real
      full screen (best effort — it needs a user gesture, which the button
      press or key press provides)
    · scales editor type up so it is readable from across a room
    · shows a presenter toolbar: zoom, fit, panel toggles, focus, laser

  Keyboard (ignored while typing in a field):
    Shift+P / F11  enter or leave      Esc   leave
    F  fit          + −  zoom          0  reset zoom
    O  focus mode   L  laser pointer   ?  shortcuts
    arrows          pan the canvas
*/

(function () {
  const body = document.body;

  /* ---------------- what can this page present? ---------------- */

  const isDiagram = !!document.querySelector('.tool-shell');
  const isConverter = !!document.querySelector('.convert-shell');
  if (!isDiagram && !isConverter) return; // home, tools hub — nothing to present

  const panes = [...document.querySelectorAll('.convert-shell .pane')];

  // The surface people actually point at: the canvas on the diagram page,
  // otherwise the output pane (the last one) — that's the result being shown.
  const primaryPane = panes.length ? panes[panes.length - 1] : null;
  if (primaryPane) primaryPane.classList.add('present-primary');

  const canvasPage = isDiagram;
  const paneLabel = (pane, i) => {
    const t = pane.querySelector('.pane-title');
    const text = t ? t.textContent.trim() : '';
    return text || 'Panel ' + (i + 1);
  };

  let presenting = false;
  let focusMode = false;
  let laser = false;
  let scale = 1.35;     // text zoom multiplier for editor panes
  let wantedFullscreen = false;

  const setScale = (v) => {
    scale = Math.min(3.2, Math.max(0.7, v));
    document.documentElement.style.setProperty('--present-scale', scale.toFixed(2));
    updateZoomLabel();
  };

  /* ---------------- presenter toolbar ---------------- */

  const bar = document.createElement('div');
  bar.className = 'presenter-bar';
  bar.innerHTML = `
    <button class="exit" data-act="exit" title="Leave presentation mode (Esc)">✕ Exit</button>
    <span class="pb-sep"></span>
    <button data-act="zoom-out" title="Zoom out (−)">−</button>
    <span class="pb-zoom" id="pb-zoom">100%</span>
    <button data-act="zoom-in" title="Zoom in (+)">+</button>
    <button data-act="fit" title="Fit to screen (F)">Fit</button>
    ${canvasPage ? `
    <span class="pb-sep"></span>
    <span class="pb-nav">
      <button data-act="pan-left" title="Pan left (←)">◀</button>
      <button data-act="pan-up" title="Pan up (↑)">▲</button>
      <button data-act="pan-down" title="Pan down (↓)">▼</button>
      <button data-act="pan-right" title="Pan right (→)">▶</button>
    </span>` : ''}
    <span class="pb-sep"></span>
    <span class="pb-menu" id="pb-panels-menu">
      <button data-act="panels" title="Show or hide panels">Panels ▾</button>
      <span class="pb-pop" id="pb-panels"></span>
    </span>
    <button data-act="focus" title="Focus mode — show only the result (O)">Focus</button>
    <button data-act="laser" title="Laser pointer (L)">Laser</button>
    <span class="pb-sep"></span>
    <button data-act="help" title="Keyboard shortcuts (?)">?</button>
  `;
  document.body.appendChild(bar);

  const zoomLabel = bar.querySelector('#pb-zoom');
  const panelsMenu = bar.querySelector('#pb-panels-menu');
  const panelsPop = bar.querySelector('#pb-panels');

  /* Panel checkboxes: the page's own panes, plus the option bar. */
  const panels = [];
  if (canvasPage) {
    panels.push({ id: 'editor', label: 'JSON input', on: false, apply: (on) => body.classList.toggle('show-editor', on) });
  }
  panes.forEach((pane, i) => {
    panels.push({
      id: 'pane-' + i,
      label: paneLabel(pane, i),
      on: true,
      apply: (on) => pane.classList.toggle('present-hidden', !on)
    });
  });
  if (isConverter && document.querySelector('.opt-bar')) {
    panels.push({ id: 'options', label: 'Tool options', on: false, apply: (on) => body.classList.toggle('show-options', on) });
  }

  panelsPop.innerHTML = '<span class="pb-pop-head">Panels</span>' + panels.map((p) => `
    <label><input type="checkbox" data-panel="${p.id}"${p.on ? ' checked' : ''}> ${p.label}</label>`).join('');

  panelsPop.addEventListener('change', (e) => {
    const id = e.target.dataset.panel;
    const panel = panels.find((p) => p.id === id);
    if (!panel) return;
    panel.on = e.target.checked;
    panel.apply(panel.on);
    refit();
  });

  const applyPanels = () => panels.forEach((p) => p.apply(p.on));
  const syncPanelChecks = () => panels.forEach((p) => {
    const box = panelsPop.querySelector('[data-panel="' + p.id + '"]');
    if (box) box.checked = p.on;
  });

  /* ---------------- zoom ---------------- */

  function updateZoomLabel() {
    const pct = canvasPage && window.JSONStudio && window.JSONStudio.zoomLevel
      ? Math.round(window.JSONStudio.zoomLevel() * 100)
      : Math.round((scale / 1.35) * 100);
    zoomLabel.textContent = pct + '%';
  }

  function zoom(dir) {
    if (canvasPage && window.JSONStudio && window.JSONStudio.zoomBy) {
      window.JSONStudio.zoomBy(dir > 0 ? 1.25 : 0.8);
      setTimeout(updateZoomLabel, 220);
    } else {
      setScale(scale + dir * 0.15);
    }
  }

  function fit() {
    if (canvasPage && window.JSONStudio && window.JSONStudio.fit) {
      window.JSONStudio.fit();
      setTimeout(updateZoomLabel, 340);
    } else {
      setScale(1.35);
    }
  }

  function pan(dx, dy) {
    if (canvasPage && window.JSONStudio && window.JSONStudio.panBy) window.JSONStudio.panBy(dx, dy);
  }

  // Panels changing size means the canvas changed size.
  function refit() {
    document.dispatchEvent(new CustomEvent('presentation-change', { detail: { presenting } }));
  }

  /* ---------------- laser pointer ---------------- */

  const laserCanvas = document.createElement('canvas');
  laserCanvas.id = 'laser-layer';
  document.body.appendChild(laserCanvas);
  const ctx = laserCanvas.getContext('2d');
  let trail = [];
  let ripples = [];
  let rafId = null;

  function sizeLaser() {
    const dpr = window.devicePixelRatio || 1;
    laserCanvas.width = window.innerWidth * dpr;
    laserCanvas.height = window.innerHeight * dpr;
    laserCanvas.style.width = window.innerWidth + 'px';
    laserCanvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawLaser() {
    const now = performance.now();
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Fading tail behind the pointer.
    trail = trail.filter((p) => now - p.t < 420);
    trail.forEach((p) => {
      const age = (now - p.t) / 420;
      ctx.globalAlpha = (1 - age) * 0.5;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * (1 - age) + 1.5, 0, Math.PI * 2);
      ctx.fill();
    });

    const head = trail[trail.length - 1];
    if (head) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff453a';
      ctx.beginPath();
      ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(head.x - 1.5, head.y - 1.5, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Click ripples, for "look here".
    ripples = ripples.filter((r) => now - r.t < 600);
    ripples.forEach((r) => {
      const age = (now - r.t) / 600;
      ctx.globalAlpha = (1 - age) * 0.8;
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 2.5 * (1 - age) + 0.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + age * 46, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
    rafId = laser ? requestAnimationFrame(drawLaser) : null;
  }

  function setLaser(on) {
    laser = on;
    body.classList.toggle('laser-on', on);
    bar.querySelector('[data-act="laser"]').classList.toggle('on', on);
    if (on) {
      sizeLaser();
      if (!rafId) rafId = requestAnimationFrame(drawLaser);
    } else {
      trail = [];
      ripples = [];
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }
  }

  document.addEventListener('pointermove', (e) => {
    if (laser) trail.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });
  document.addEventListener('pointerdown', (e) => {
    if (laser) ripples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
  });

  /* ---------------- toolbar auto-hide ---------------- */

  let idleTimer = null;
  function wake() {
    bar.classList.remove('idle');
    clearTimeout(idleTimer);
    if (presenting) idleTimer = setTimeout(() => bar.classList.add('idle'), 3500);
  }
  ['pointermove', 'keydown', 'pointerdown'].forEach((evt) => document.addEventListener(evt, wake));

  /* ---------------- help ---------------- */

  const help = document.createElement('div');
  help.id = 'present-help';
  help.innerHTML = `
    <div class="help-card">
      <h3>Presentation shortcuts</h3>
      <p>Shortcuts work whenever you are not typing in a field.</p>
      <dl>
        <dt><kbd>Shift</kbd><kbd>P</kbd></dt><dd>Enter or leave presentation mode</dd>
        <dt><kbd>Esc</kbd></dt><dd>Leave</dd>
        <dt><kbd>F</kbd></dt><dd>Fit to screen</dd>
        <dt><kbd>+</kbd> <kbd>−</kbd></dt><dd>Zoom in and out</dd>
        <dt><kbd>0</kbd></dt><dd>Reset zoom (zero)</dd>
        <dt><kbd>O</kbd></dt><dd>Focus mode — only the result (letter O)</dd>
        <dt><kbd>L</kbd></dt><dd>Laser pointer (click to ripple)</dd>
        <dt><kbd>←↑↓→</kbd></dt><dd>Pan the canvas</dd>
        <dt><kbd>?</kbd></dt><dd>This card</dd>
      </dl>
      <p class="help-foot">Click anywhere to close.</p>
    </div>`;
  document.body.appendChild(help);
  help.addEventListener('click', () => help.classList.remove('open'));

  /* ---------------- enter / leave ---------------- */

  function enter() {
    if (presenting) return;
    presenting = true;
    body.classList.add('presenting');
    setScale(scale);
    applyPanels();
    syncPanelChecks();
    wake();

    // Real full screen if the browser allows it — this is called from a click
    // or keypress, which is the gesture it requires.
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      wantedFullscreen = true;
      el.requestFullscreen().catch(() => { wantedFullscreen = false; });
    }

    updatePresentButton();
    refit();
    setTimeout(fit, 120);
  }

  function leave() {
    if (!presenting) return;
    presenting = false;
    focusMode = false;
    body.classList.remove('presenting', 'focus-mode', 'show-editor', 'show-options');
    bar.querySelector('[data-act="focus"]').classList.remove('on');
    setLaser(false);
    help.classList.remove('open');
    panelsMenu.classList.remove('open');
    panes.forEach((p) => p.classList.remove('present-hidden'));
    panels.forEach((p) => { p.on = p.id.startsWith('pane-'); });
    document.documentElement.style.removeProperty('--present-scale');
    clearTimeout(idleTimer);

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    wantedFullscreen = false;

    updatePresentButton();
    refit();
  }

  const toggle = () => (presenting ? leave() : enter());

  function setFocus(on) {
    focusMode = on;
    body.classList.toggle('focus-mode', on);
    bar.querySelector('[data-act="focus"]').classList.toggle('on', on);
    refit();
  }

  // Leaving full screen (the Esc key does this before our handler sees it)
  // should leave presentation mode too, which is what people expect.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && presenting && wantedFullscreen) leave();
  });

  window.addEventListener('resize', () => {
    if (!presenting) return;
    if (laser) sizeLaser();
    clearTimeout(window.__presentResize);
    window.__presentResize = setTimeout(refit, 150);
  });

  /* ---------------- toolbar wiring ---------------- */

  const ACTIONS = {
    exit: leave,
    'zoom-in': () => zoom(1),
    'zoom-out': () => zoom(-1),
    fit,
    'pan-left': () => pan(140, 0),
    'pan-right': () => pan(-140, 0),
    'pan-up': () => pan(0, 140),
    'pan-down': () => pan(0, -140),
    panels: () => panelsMenu.classList.toggle('open'),
    focus: () => setFocus(!focusMode),
    laser: () => setLaser(!laser),
    help: () => help.classList.add('open')
  };

  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    e.stopPropagation();
    const act = ACTIONS[btn.dataset.act];
    if (act) act();
    if (btn.dataset.act !== 'panels') panelsMenu.classList.remove('open');
  });
  document.addEventListener('click', (e) => {
    if (!panelsMenu.contains(e.target)) panelsMenu.classList.remove('open');
  });

  /* ---------------- keyboard ---------------- */

  const typing = (el) => el && (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable);

  document.addEventListener('keydown', (e) => {
    // F11 and Shift+P work anywhere, including from inside the editor, because
    // they need a modifier or a dedicated key.
    if (e.key === 'F11') {
      // Chromium lets us take this over; Firefox keeps it for native full
      // screen, in which case the button and Shift+P still work.
      e.preventDefault();
      toggle();
      return;
    }
    if (e.shiftKey && (e.key === 'P' || e.key === 'p') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (typing(e.target) && !presenting) return; // don't hijack a capital P mid-paste
      e.preventDefault();
      toggle();
      return;
    }

    if (!presenting) return;

    if (e.key === 'Escape') {
      if (help.classList.contains('open')) { help.classList.remove('open'); return; }
      if (panelsMenu.classList.contains('open')) { panelsMenu.classList.remove('open'); return; }
      leave();
      return;
    }

    if (typing(e.target)) return; // single-letter keys must not fight the editor

    switch (e.key) {
      case 'f': case 'F': fit(); break;
      case '+': case '=': zoom(1); break;
      case '-': case '_': zoom(-1); break;
      case '0': if (canvasPage) fit(); else setScale(1.35); break;
      case 'o': case 'O': setFocus(!focusMode); break;
      case 'l': case 'L': setLaser(!laser); break;
      case '?': help.classList.toggle('open'); break;
      case 'ArrowLeft': e.preventDefault(); pan(140, 0); break;
      case 'ArrowRight': e.preventDefault(); pan(-140, 0); break;
      case 'ArrowUp': e.preventDefault(); pan(0, 140); break;
      case 'ArrowDown': e.preventDefault(); pan(0, -140); break;
      default: break;
    }
  });

  /* ---------------- the Present button ---------------- */

  let presentBtn = null;

  function updatePresentButton() {
    if (!presentBtn) return;
    presentBtn.textContent = presenting ? 'Exit present' : 'Present';
    presentBtn.setAttribute('aria-pressed', String(presenting));
  }

  function addPresentButton() {
    const actions = document.querySelector('.header-actions');
    if (!actions) return;
    presentBtn = document.createElement('button');
    presentBtn.className = 'ghost present-btn';
    presentBtn.id = 'present-btn';
    presentBtn.type = 'button';
    presentBtn.title = 'Presentation mode (Shift+P)';
    presentBtn.textContent = 'Present';
    actions.insertBefore(presentBtn, actions.firstChild);
    presentBtn.addEventListener('click', toggle);
  }

  // site.js builds the header on DOMContentLoaded; this file is loaded after
  // it, so its listener runs after the header exists.
  document.addEventListener('DOMContentLoaded', addPresentButton);
  if (document.readyState !== 'loading') addPresentButton();

  window.JSONStudioPresent = { enter, leave, toggle, isPresenting: () => presenting };
})();
