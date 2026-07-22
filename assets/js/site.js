/*
  site.js
  Injects the shared header and footer into any page that includes
  <div id="site-header"></div> and <div id="site-footer"></div>.
  Keeping header/footer here means every page updates from one file
  instead of copy-pasted markup drifting out of sync.
*/

(function () {
  const NAV_LINKS = [
    { href: 'index.html', label: 'Home' },
    { href: 'tool.html', label: 'JSON Diagram' },
    { href: 'yaml-json.html', label: 'YAML ⇄ JSON' },
    { href: 'json-schema.html', label: 'JSON Schema' },
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
            ${NAV_LINKS.map(l => linkHTML(l)).join('')}
          </nav>
          <div class="header-spacer"></div>
          <div class="header-actions">
            <button class="ghost" id="theme-toggle" type="button">Dark mode</button>
            <button class="nav-toggle ghost" id="nav-toggle" type="button" aria-label="Open menu">Menu</button>
          </div>
        </div>
        <div id="mobile-nav">
          ${NAV_LINKS.map(l => linkHTML(l)).join('')}
        </div>
      </header>
    `;

    const navToggle = document.getElementById('nav-toggle');
    const mobileNav = document.getElementById('mobile-nav');
    navToggle.addEventListener('click', () => mobileNav.classList.toggle('open'));

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
            <h4>Navigate</h4>
            <ul>
              <li><a href="index.html">Home</a></li>
              <li><a href="tool.html">JSON Diagram tool</a></li>
              <li><a href="yaml-json.html">YAML ⇄ JSON converter</a></li>
              <li><a href="json-schema.html">JSON Schema generator</a></li>
              <li><a href="CONTRIBUTING.md">Contributing guide</a></li>
              <li><a href="https://www.msdevbuild.com/" target="_blank" rel="noopener">MSDEVBUILD Blog</a></li>
            </ul>
          </div>
          <div class="footer-col">
            <h4>Project</h4>
            <ul>
              <li><a href="https://github.com/jssuthahar" target="_blank" rel="noopener">Source on GitHub</a></li>
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
