/*
  site.js
  Injects the shared header and footer into any page that includes
  <div id="site-header"></div> and <div id="site-footer"></div>, and provides
  the three things every page shares beyond that: the ⌘K tool switcher, the
  theme toggle, and the PWA install/service-worker plumbing.

  TOOLS is the single source of truth for the tool list — nav dropdown, mobile
  nav, footer and the command palette all read from it.
*/

(function () {
  const TOOLS = [
    /* TOOLS:start */
    { href: 'format.html', label: 'Formatter & validator', group: 'inspect', icon: '⌗' },
    { href: 'tool.html', label: 'JSON to diagram', group: 'inspect', icon: '{ }' },
    { href: 'diff.html', label: 'JSON diff', group: 'inspect', icon: 'A|B' },
    { href: 'jsonpath.html', label: 'JSONPath tester', group: 'inspect', icon: '$..' },
    { href: 'jwt.html', label: 'JWT decoder', group: 'inspect', icon: 'JWT' },
    { href: 'json-schema.html', label: 'Schema generator', group: 'schema', icon: 'Sχ' },
    { href: 'validate.html', label: 'Schema validator', group: 'schema', icon: '✓' },
    { href: 'mock.html', label: 'Mock data generator', group: 'schema', icon: '⁂' },
    { href: 'code.html', label: 'JSON to code', group: 'convert', icon: '</>' },
    { href: 'csv.html', label: 'JSON ⇄ CSV', group: 'convert', icon: 'J↔C' },
    { href: 'yaml-json.html', label: 'YAML ⇄ JSON', group: 'convert', icon: 'Y↔J' },
    { href: 'xml.html', label: 'JSON ⇄ XML', group: 'convert', icon: 'X↔J' },
    { href: 'jsonl.html', label: 'JSONL ⇄ JSON', group: 'convert', icon: '≡' },
    { href: 'sql.html', label: 'JSON to SQL', group: 'convert', icon: 'SQL' }
    /* TOOLS:end */
  ];

  const GROUP_NAMES = { inspect: 'Inspect & debug', schema: 'Schema & test data', convert: 'Convert & export' };

  // Presentation mode is the feature worth pointing at, so it gets a mark of
  // its own — a screen with a play head — reused by the nav, the mobile menu,
  // the tool rail and the Present button on every tool page.
  const PRESENT_ICON =
    '<svg class="nav-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v3M9.5 20h5"/>' +
    '<path d="m10.6 8.8 4 2.7-4 2.7z" fill="currentColor" stroke="none"/></svg>';

  // Shared with workbench.js (the tool rail) so the tool list is defined once.
  window.JSONStudioNav = { TOOLS, GROUP_NAMES, PRESENT_ICON };

  const NAV_LINKS = [
    { href: 'index.html', label: 'Home' },
    { label: 'Tools', children: TOOLS, allHref: 'tools.html' },
    { href: 'presentation.html', label: 'Presentation', navIcon: PRESENT_ICON, highlight: true },
    { href: 'https://www.msdevbuild.com/', label: 'MSDEVBUILD Blog', external: true },
    { href: 'https://github.com/jssuthahar', label: 'GitHub', external: true }
  ];

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function currentFile() {
    const path = window.location.pathname.split('/').pop();
    return path || 'index.html';
  }

  function linkHTML(link, extraClass) {
    const active = !link.external && link.href === currentFile() ? ' active' : '';
    const target = link.external ? ' target="_blank" rel="noopener"' : '';
    const cls = [extraClass || '', link.highlight ? 'nav-highlight' : '', active.trim()].filter(Boolean).join(' ');
    return `<a class="${cls}" href="${link.href}"${target}>${link.navIcon || ''}${link.label}</a>`;
  }

  function navItemHTML(link) {
    if (!link.children) return linkHTML(link);
    // Mark the parent active when any tool page underneath it is open.
    const onTool = link.children.some((c) => c.href === currentFile()) || currentFile() === link.allHref;
    const cols = Object.keys(GROUP_NAMES).map((g) => `
            <div class="dd-col">
              <div class="dd-head">${GROUP_NAMES[g]}</div>
              ${link.children.filter((c) => c.group === g).map((c) => linkHTML(c)).join('')}
            </div>`).join('');
    return `
      <div class="nav-dd">
        <button type="button" class="nav-dd-toggle${onTool ? ' active' : ''}" aria-expanded="false">${link.label} <span aria-hidden="true">▾</span></button>
        <div class="nav-dd-menu">
          <div class="dd-cols">${cols}</div>
          <a class="dd-all" href="${link.allHref}">All tools in one place →</a>
        </div>
      </div>`;
  }

  /* ---------------- header ---------------- */

  function renderHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;
    el.innerHTML = `
      <header class="site-header">
        <div class="container bar">
          <a class="brandmark" href="index.html" style="text-decoration:none;">
            <div class="dot">{ }</div>
            <div class="word">JSON <span>Studio</span></div>
          </a>
          <nav class="site-nav">
            ${NAV_LINKS.map(navItemHTML).join('')}
          </nav>
          <div class="header-spacer"></div>
          <div class="header-actions">
            <button class="kbd-hint" id="palette-open" type="button" aria-label="Search tools">
              <span>Jump to tool</span><kbd>${isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
            </button>
            <button class="ghost install-btn" id="install-btn" type="button" hidden>Install app</button>
            <button class="ghost" id="theme-toggle" type="button">Dark mode</button>
            <button class="nav-toggle ghost" id="nav-toggle" type="button" aria-label="Open menu">Menu</button>
          </div>
        </div>
        <div id="mobile-nav">
          <a href="index.html">Home</a>
          <a href="tools.html">All tools</a>
          <a class="nav-highlight" href="presentation.html">${PRESENT_ICON}Presentation mode</a>
          ${Object.keys(GROUP_NAMES).map((g) => `
            <div class="mobile-nav-head">${GROUP_NAMES[g]}</div>
            ${TOOLS.filter((t) => t.group === g).map((t) => linkHTML(t)).join('')}`).join('')}
          <div class="mobile-nav-head">Elsewhere</div>
          <a href="https://www.msdevbuild.com/" target="_blank" rel="noopener">MSDEVBUILD Blog</a>
          <a href="https://github.com/jssuthahar" target="_blank" rel="noopener">GitHub</a>
        </div>
      </header>
    `;

    const mobileNav = document.getElementById('mobile-nav');
    document.getElementById('nav-toggle').addEventListener('click', () => mobileNav.classList.toggle('open'));

    // Dropdowns open on click as well as hover, so they work on touch devices
    // that never fire a hover state.
    const dropdowns = [...el.querySelectorAll('.nav-dd')];
    dropdowns.forEach((dd) => {
      const toggle = dd.querySelector('.nav-dd-toggle');
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = dd.classList.toggle('open');
        toggle.setAttribute('aria-expanded', String(open));
        dropdowns.filter((o) => o !== dd).forEach((o) => o.classList.remove('open'));
      });
    });
    document.addEventListener('click', () => dropdowns.forEach((dd) => dd.classList.remove('open')));

    document.getElementById('palette-open').addEventListener('click', openPalette);

    const themeToggle = document.getElementById('theme-toggle');
    const applyThemeLabel = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeToggle.textContent = isDark ? 'Light mode' : 'Dark mode';
    };
    applyThemeLabel();
    themeToggle.addEventListener('click', () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('json-studio-theme', next);
      applyThemeLabel();
      document.dispatchEvent(new CustomEvent('theme-changed', { detail: next }));
    });
  }

  /* ---------------- command palette ---------------- */

  let paletteEl = null;
  let matches = [];
  let cursor = 0;

  function buildPalette() {
    const wrap = document.createElement('div');
    wrap.id = 'palette';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="palette-backdrop" data-close="1"></div>
      <div class="palette-box" role="dialog" aria-modal="true" aria-label="Jump to tool">
        <input type="text" id="palette-input" placeholder="Jump to a tool…" autocomplete="off" spellcheck="false">
        <div class="palette-list" id="palette-list"></div>
        <div class="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span><span><kbd>esc</kbd> to close</span></div>
      </div>`;
    document.body.appendChild(wrap);

    const input = wrap.querySelector('#palette-input');
    input.addEventListener('input', () => renderPalette(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (matches[cursor]) window.location.href = matches[cursor].href; }
      else if (e.key === 'Escape') closePalette();
    });
    wrap.addEventListener('click', (e) => { if (e.target.dataset.close) closePalette(); });
    return wrap;
  }

  function move(delta) {
    if (!matches.length) return;
    cursor = (cursor + delta + matches.length) % matches.length;
    highlight();
  }

  function highlight() {
    const rows = paletteEl.querySelectorAll('.palette-row');
    rows.forEach((r, i) => r.classList.toggle('on', i === cursor));
    const active = rows[cursor];
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function renderPalette(query) {
    const q = (query || '').trim().toLowerCase();
    const entries = TOOLS.concat([{ href: 'tools.html', label: 'All tools', group: 'site' }, { href: 'index.html', label: 'Home', group: 'site' }]);
    matches = q
      ? entries.filter((t) => (t.label + ' ' + t.href + ' ' + (GROUP_NAMES[t.group] || '')).toLowerCase().includes(q))
      : entries;
    cursor = 0;
    const list = paletteEl.querySelector('#palette-list');
    list.innerHTML = matches.length
      ? matches.map((t, i) => `<a class="palette-row${i === 0 ? ' on' : ''}" href="${t.href}">
           <span class="pr-label">${t.label}</span>
           <span class="pr-group">${GROUP_NAMES[t.group] || ''}</span>
         </a>`).join('')
      : '<div class="palette-empty">No tool matches that.</div>';
  }

  function openPalette() {
    if (!paletteEl) paletteEl = buildPalette();
    paletteEl.hidden = false;
    document.body.classList.add('palette-open');
    renderPalette('');
    const input = paletteEl.querySelector('#palette-input');
    input.value = '';
    input.focus();
  }

  function closePalette() {
    if (!paletteEl) return;
    paletteEl.hidden = true;
    document.body.classList.remove('palette-open');
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); }
    else if (e.key === 'Escape') closePalette();
  });

  /* ---------------- install (PWA) ---------------- */

  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function wireInstall() {
    const btn = document.getElementById('install-btn');
    const cta = document.getElementById('install-cta');
    const hint = document.getElementById('install-hint');
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    const show = () => {
      if (btn) btn.hidden = false;
      if (hint) hint.hidden = true;
    };

    // iOS Safari never fires beforeinstallprompt, so the button explains the
    // manual route instead of pretending it can do it for you.
    if (iOS && !isStandalone()) {
      if (hint) hint.hidden = false;
      if (cta) cta.textContent = 'How to install on iOS';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      show();
    });

    const doInstall = async () => {
      if (!deferredPrompt) {
        if (hint) { hint.hidden = false; hint.classList.add('flash'); }
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (btn) btn.hidden = true;
    };

    if (btn) btn.addEventListener('click', doInstall);
    if (cta) cta.addEventListener('click', doInstall);

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      if (btn) btn.hidden = true;
    });

    if (isStandalone() && cta) cta.textContent = 'Already installed ✓';
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // file:// pages can't host a service worker, and there's no point on one.
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
    });
  }

  /* ---------------- footer ---------------- */

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const year = new Date().getFullYear();
    const col = (group) => TOOLS.filter((t) => t.group === group)
      .map((t) => `<li><a href="${t.href}">${t.label}</a></li>`).join('');
    el.innerHTML = `
      <footer class="site-footer">
        <div class="container footer-top">
          <div class="about">
            <div class="brandmark">
              <div class="dot">{ }</div>
              <div class="word">JSON <span>Studio</span></div>
            </div>
            <p>Free, client-side JSON tooling from MSDEVBUILD — built by Suthahar Jegatheesan, Senior Solutions Architect focused on Azure, AI and mobile architecture.</p>
            <div class="socials">
              <a href="https://my.linkedin.com/in/jssuthahar" target="_blank" rel="noopener">LinkedIn</a>
              <a href="https://github.com/jssuthahar" target="_blank" rel="noopener">GitHub</a>
              <a href="https://www.youtube.com/@MSDEVBUILD" target="_blank" rel="noopener">YouTube</a>
            </div>
          </div>
          <div class="footer-col"><h4>${GROUP_NAMES.inspect}</h4><ul>${col('inspect')}</ul></div>
          <div class="footer-col"><h4>${GROUP_NAMES.schema}</h4><ul>${col('schema')}</ul></div>
          <div class="footer-col"><h4>${GROUP_NAMES.convert}</h4><ul>${col('convert')}</ul></div>
          <div class="footer-col">
            <h4>Project</h4>
            <ul>
              <li><a href="tools.html">All tools</a></li>
              <li><a class="foot-highlight" href="presentation.html">${PRESENT_ICON}Presentation mode</a></li>
              <li><a href="index.html#install">Install the app</a></li>
              <li><a href="CONTRIBUTING.md">Contributing guide</a></li>
              <li><a href="https://github.com/jssuthahar" target="_blank" rel="noopener">Source on GitHub</a></li>
              <li><a href="https://www.msdevbuild.com/" target="_blank" rel="noopener">MSDEVBUILD Blog</a></li>
              <li><a href="https://www.msdevbuild.com/p/contact-suthahar-jegatheesan-js.html" target="_blank" rel="noopener">Contact</a></li>
            </ul>
          </div>
        </div>
        <div class="container footer-bottom">
          <span>&copy; ${year} MSDEVBUILD &middot; Suthahar Jegatheesan. All rights reserved.</span>
          <span>Built as a free, open, client-side tool. No data leaves your browser.</span>
        </div>
      </footer>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    renderFooter();
    wireInstall();
    registerServiceWorker();
  });
})();
