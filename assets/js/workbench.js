/*
  workbench.js — VS Code-style navigation and panel handling for tool pages.

  Two things, both borrowed from an editor because that is what these pages
  actually are:

    · an icon rail down the left edge that switches tools in one click, with
      the current tool marked — no menu, no trip back to the home page
    · collapsible panels, so the working area can take the whole window
      (⌘B / Ctrl+B, exactly like the editor sidebar people already know)

  Collapse state is remembered per tool, because whether you want the input
  pane visible depends on what the tool is for: on the diagram page you rarely
  do, on the diff page you always do.
*/

(function () {
  const nav = window.JSONStudioNav;
  if (!nav) return;

  const shell = document.querySelector('.convert-shell') || document.querySelector('.tool-shell');
  if (!shell) return; // not a tool page

  const isDiagram = !!document.querySelector('.tool-shell');
  const grid = document.querySelector('.convert-grid') || document.querySelector('.tool-shell');
  const panes = [...document.querySelectorAll('.convert-shell .pane')];

  // The "sidebar" is whatever holds the input: the editor column on the
  // diagram page, the first pane everywhere else.
  const sidebar = isDiagram ? document.querySelector('.tool-left') : panes[0];

  const currentFile = () => window.location.pathname.split('/').pop() || 'index.html';
  const STORE = 'json-studio-panels:' + currentFile();

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modLabel = isMac ? '⌘' : 'Ctrl';

  /* ---------------- panel state ---------------- */

  function paneKey(el, i) { return isDiagram ? 'sidebar' : 'pane-' + i; }

  const targets = isDiagram
    ? [{ key: 'sidebar', el: sidebar }]
    : panes.map((el, i) => ({ key: paneKey(el, i), el }));

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; }
  }
  function save(state) {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  let state = load();

  function visibleCount() {
    return targets.filter((t) => !t.el.classList.contains('wb-collapsed')).length;
  }

  function apply() {
    targets.forEach((t) => {
      const collapsed = !!state[t.key];
      t.el.classList.toggle('wb-collapsed', collapsed);
    });

    // With one panel left, drop the multi-column grid so it fills the width.
    // The diagram page only tracks its sidebar, so "one column" there means
    // the sidebar is hidden — counting visible targets would always say 1.
    const oneColumn = isDiagram ? !!state.sidebar : visibleCount() <= 1;
    if (grid) grid.classList.toggle('wb-one', oneColumn);

    const sidebarHidden = sidebar && sidebar.classList.contains('wb-collapsed');
    document.body.classList.toggle('wb-sidebar-hidden', !!sidebarHidden);

    const railBtn = document.getElementById('wb-sidebar-btn');
    if (railBtn) railBtn.classList.toggle('on', !sidebarHidden);

    syncPaneButtons();
    // Canvas tools need to re-fit when their share of the window changes.
    document.dispatchEvent(new CustomEvent('presentation-change', { detail: { source: 'workbench' } }));
  }

  function setCollapsed(key, collapsed) {
    // Never collapse the last visible panel — that would leave a blank page.
    if (collapsed && !isDiagram && visibleCount() <= 1 && !state[key]) return;
    state[key] = collapsed;
    save(state);
    apply();
  }

  const toggleKey = (key) => setCollapsed(key, !state[key]);
  const toggleSidebar = () => toggleKey(isDiagram ? 'sidebar' : 'pane-0');

  /* ---------------- collapse buttons in each pane header ---------------- */

  function addPaneButtons() {
    if (isDiagram) return; // the diagram's editor is toggled from the rail
    panes.forEach((pane, i) => {
      const head = pane.querySelector('.pane-head');
      if (!head) return;
      const btn = document.createElement('button');
      btn.className = 'pane-collapse';
      btn.type = 'button';
      btn.dataset.pane = paneKey(pane, i);
      btn.title = 'Hide this panel' + (i === 0 ? ' (' + modLabel + 'B)' : '');
      btn.setAttribute('aria-label', 'Hide this panel');
      btn.textContent = '⊟';
      head.appendChild(btn);
      btn.addEventListener('click', () => setCollapsed(btn.dataset.pane, true));
    });
  }

  function syncPaneButtons() {
    document.querySelectorAll('.pane-collapse').forEach((btn) => {
      const only = visibleCount() <= 1 && !state[btn.dataset.pane];
      btn.style.opacity = only ? '0.35' : '';
      btn.style.pointerEvents = only ? 'none' : '';
    });
  }

  /* ---------------- the rail ---------------- */

  function buildRail() {
    const here = currentFile();
    const rail = document.createElement('nav');
    rail.className = 'wb-rail';
    rail.setAttribute('aria-label', 'Tools');

    const groups = Object.keys(nav.GROUP_NAMES);
    const toolsHTML = groups.map((g, gi) => {
      const items = nav.TOOLS.filter((t) => t.group === g).map((t) => `
        <a class="wb-btn${t.href === here ? ' active' : ''}" href="${t.href}"
           data-label="${t.label}" aria-label="${t.label}"${t.href === here ? ' aria-current="page"' : ''}>${t.icon}</a>`).join('');
      return items + (gi < groups.length - 1 ? '<span class="wb-sep"></span>' : '');
    }).join('');

    rail.innerHTML = `
      <a class="wb-brand" href="index.html" data-label="JSON Studio home" aria-label="JSON Studio home">{ }</a>
      <button class="wb-btn" id="wb-sidebar-btn" type="button"
              data-label="Toggle side panel &nbsp;<kbd>${modLabel}B</kbd>" aria-label="Toggle side panel">◧</button>
      <span class="wb-sep"></span>
      ${toolsHTML}
      <span class="wb-spacer"></span>
      <span class="wb-sep"></span>
      <a class="wb-btn" href="tools.html" data-label="All tools" aria-label="All tools">⊞</a>
      <button class="wb-btn" id="wb-present-btn" type="button"
              data-label="Present &nbsp;<kbd>⇧P</kbd>" aria-label="Presentation mode">▶</button>
    `;
    document.body.appendChild(rail);
    document.body.classList.add('wb');

    document.getElementById('wb-sidebar-btn').addEventListener('click', toggleSidebar);
    document.getElementById('wb-present-btn').addEventListener('click', () => {
      if (window.JSONStudioPresent) window.JSONStudioPresent.toggle();
    });
  }

  /* One shared tooltip, positioned against the hovered button. Doing this in
     JS keeps it outside the rail's scroll box, which would otherwise clip it. */
  function buildTooltip() {
    const tip = document.createElement('div');
    tip.id = 'wb-tip';
    document.body.appendChild(tip);

    const show = (el) => {
      const label = el.dataset.label;
      if (!label) return;
      tip.innerHTML = label;
      const box = el.getBoundingClientRect();
      tip.style.left = (box.right + 10) + 'px';
      tip.style.top = (box.top + box.height / 2) + 'px';
      tip.style.transform = 'translateY(-50%)';
      tip.classList.add('show');
    };
    const hide = () => tip.classList.remove('show');

    document.querySelectorAll('.wb-rail [data-label]').forEach((el) => {
      el.addEventListener('mouseenter', () => show(el));
      el.addEventListener('focus', () => show(el));
      el.addEventListener('mouseleave', hide);
      el.addEventListener('blur', hide);
      el.addEventListener('click', hide);
    });
    document.querySelector('.wb-rail').addEventListener('scroll', hide);
  }

  /* A strip to bring the sidebar back once it is hidden. */
  function buildRestore() {
    const btn = document.createElement('button');
    btn.className = 'wb-restore';
    btn.type = 'button';
    btn.title = 'Show the side panel (' + modLabel + 'B)';
    btn.setAttribute('aria-label', 'Show the side panel');
    btn.textContent = '›';
    document.body.appendChild(btn);
    btn.addEventListener('click', toggleSidebar);
  }

  /* ---------------- keyboard ---------------- */

  document.addEventListener('keydown', (e) => {
    // ⌘B / Ctrl+B — the shortcut everyone already has in their fingers.
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'b' || e.key === 'B')) {
      e.preventDefault();
      toggleSidebar();
      return;
    }
    // Alt+1…9 jumps between tools without leaving the keyboard.
    if (e.altKey && !e.metaKey && !e.ctrlKey && /^[1-9]$/.test(e.key)) {
      const tool = nav.TOOLS[Number(e.key) - 1];
      if (tool) { e.preventDefault(); window.location.href = tool.href; }
    }
  });

  /* ---------------- go ---------------- */

  function init() {
    buildRail();
    buildTooltip();
    buildRestore();
    addPaneButtons();
    apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.JSONStudioWorkbench = { toggleSidebar, setCollapsed, state: () => state };
})();
