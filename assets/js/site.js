/*
  site.js
  Injects the shared header and footer into any page that includes
  <div id="site-header"></div> and <div id="site-footer"></div>.
  Keeping header/footer here means every page updates from one file
  instead of copy-pasted markup drifting out of sync.

  TOOLS is the single source of truth for the tool list: the nav dropdown,
  the mobile nav and the footer all read from it. Add a tool here once.
*/

(function () {
  const TOOLS = [
    { href: 'tool.html', label: 'JSON to diagram' },
    { href: 'format.html', label: 'Formatter & validator' },
    { href: 'diff.html', label: 'JSON diff' },
    { href: 'jsonpath.html', label: 'JSONPath tester' },
    { href: 'json-schema.html', label: 'Schema generator' },
    { href: 'validate.html', label: 'Schema validator' },
    { href: 'mock.html', label: 'Mock data generator' },
    { href: 'code.html', label: 'JSON to code' },
    { href: 'csv.html', label: 'JSON ⇄ CSV' },
    { href: 'yaml-json.html', label: 'YAML ⇄ JSON' },
    { href: 'xml.html', label: 'JSON ⇄ XML' },
    { href: 'jsonl.html', label: 'JSONL ⇄ JSON' },
    { href: 'sql.html', label: 'JSON to SQL' },
    { href: 'jwt.html', label: 'JWT decoder' }
  ];

  const NAV_LINKS = [
    { href: 'index.html', label: 'Home' },
    { label: 'Tools', children: TOOLS },
    { href: 'https://www.msdevbuild.com/', label: 'MSDEVBUILD Blog', external: true },
    { href: 'https://github.com/jssuthahar', label: 'GitHub', external: true }
  ];

  function currentFile() {
    const path = window.location.pathname.split('/').pop();
    return path || 'index.html';
  }

  function linkHTML(link, extraClass) {
    const active = !link.external && link.href === currentFile() ? ' active' : '';
    const target = link.external ? ' target="_blank" rel="noopener"' : '';
    return `<a class="${extraClass || ''}${active}" href="${link.href}"${target}>${link.label}</a>`;
  }

  function navItemHTML(link) {
    if (!link.children) return linkHTML(link);
    // Mark the parent active when any tool page underneath it is open.
    const onTool = link.children.some((c) => c.href === currentFile());
    return `
      <div class="nav-dd">
        <button type="button" class="nav-dd-toggle${onTool ? ' active' : ''}" aria-expanded="false">${link.label} <span aria-hidden="true">▾</span></button>
        <div class="nav-dd-menu">
          ${link.children.map((c) => linkHTML(c)).join('')}
        </div>
      </div>`;
  }

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
            <button class="ghost" id="theme-toggle" type="button">Dark mode</button>
            <button class="nav-toggle ghost" id="nav-toggle" type="button" aria-label="Open menu">Menu</button>
          </div>
        </div>
        <div id="mobile-nav">
          <a href="index.html">Home</a>
          <div class="mobile-nav-head">Tools</div>
          ${TOOLS.map((t) => linkHTML(t)).join('')}
          <div class="mobile-nav-head">Elsewhere</div>
          <a href="https://www.msdevbuild.com/" target="_blank" rel="noopener">MSDEVBUILD Blog</a>
          <a href="https://github.com/jssuthahar" target="_blank" rel="noopener">GitHub</a>
        </div>
      </header>
    `;

    const navToggle = document.getElementById('nav-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    navToggle.addEventListener('click', () => mobileNav.classList.toggle('open'));

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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') dropdowns.forEach((dd) => dd.classList.remove('open'));
    });

    const themeToggle = document.getElementById('theme-toggle');
    const applyThemeLabel = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      themeToggle.textContent = isDark ? 'Light mode' : 'Dark mode';
    };
    const saved = localStorage.getItem('json-studio-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
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

  function renderFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const year = new Date().getFullYear();
    const half = Math.ceil(TOOLS.length / 2);
    const col = (list) => list.map((t) => `<li><a href="${t.href}">${t.label}</a></li>`).join('');
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
          <div class="footer-col">
            <h4>Tools</h4>
            <ul>${col(TOOLS.slice(0, half))}</ul>
          </div>
          <div class="footer-col">
            <h4>More tools</h4>
            <ul>${col(TOOLS.slice(half))}</ul>
          </div>
          <div class="footer-col">
            <h4>Project</h4>
            <ul>
              <li><a href="index.html">Home</a></li>
              <li><a href="CONTRIBUTING.md">Contributing guide</a></li>
              <li><a href="https://github.com/jssuthahar" target="_blank" rel="noopener">Source on GitHub</a></li>
              <li><a href="https://www.msdevbuild.com/" target="_blank" rel="noopener">MSDEVBUILD Blog</a></li>
              <li><a href="https://www.msdevbuild.com/p/about-me.html" target="_blank" rel="noopener">About Suthahar</a></li>
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
    const saved = localStorage.getItem('json-studio-theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  });
})();
