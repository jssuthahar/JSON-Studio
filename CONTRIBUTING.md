# Contributing to JSON Studio

Thanks for wanting to help build this out. This is a static, client-side-only
site (no build step, no backend, no framework) so it's easy to pick up —
here's how everything fits together and how to add to it.

## Folder structure

```
json-studio/
├── index.html              Home page — hero, tool grid, SEO tags
├── tool.html                 The JSON → diagram tool page
├── yaml-json.html            YAML ⇄ JSON converter
├── json-schema.html          JSON Schema generator
├── assets/
│   ├── css/
│   │   ├── styles.css        Shared design tokens, header, footer, cards
│   │   ├── tool.css           Styles specific to the diagram tool page
│   │   └── convert.css        Shared two-pane input→output tool layout
│   ├── js/
│   │   ├── site.js            Injects header/footer, handles theme + mobile nav
│   │   ├── diagram.js         D3 tree rendering, search, collapse/expand
│   │   ├── export.js          PNG/SVG export
│   │   ├── ai-assist.js       Optional "explain with AI" panel (OpenAI API)
│   │   ├── yaml-json.js       YAML ⇄ JSON conversion (js-yaml from CDN)
│   │   └── json-schema.js     Schema inference from a sample payload
│   └── img/
│       └── favicon.svg
├── robots.txt
├── sitemap.xml
├── CONTRIBUTING.md            You are here
└── README.md
```

## Ground rules

1. **No backend.** Every tool here runs entirely in the browser. Data the
   user pastes or uploads never gets sent anywhere except, optionally, to
   a third-party API the user explicitly opts into (like OpenAI, using
   their own key). Don't add anything that phones data home to a server
   we control — the "nothing leaves your browser" promise is the whole
   point of this project.
2. **No build step, on purpose.** Plain HTML/CSS/JS, loaded via `<script>`
   and `<link>` tags. If a tool genuinely needs a library, load it from a
   CDN (cdnjs, jsdelivr, unpkg) rather than adding an npm toolchain. Keep
   the barrier to "clone and open index.html" as low as possible.
3. **Reuse the design system.** All shared visual tokens (colors, spacing,
   card styles, buttons, header/footer) live in `assets/css/styles.css`.
   New pages should link that file first, then a page-specific stylesheet
   for anything unique (see `tool.css` as the pattern to copy).
4. **Every page gets a header and footer.** Add `<div id="site-header">`
   and `<div id="site-footer"></div>` to the page, then include
   `assets/js/site.js` — it injects both automatically and keeps
   navigation links in sync across the whole site from one file.
5. **SEO isn't optional.** Every new page needs: a unique `<title>`, a
   `meta description`, a `canonical` link, and Open Graph tags. Add the
   page to `sitemap.xml` too.

## Adding a new tool

1. Create `your-tool.html` at the project root, copying the `<head>`
   pattern from `tool.html` (meta tags, `styles.css`, your own
   `your-tool.css` if needed).
2. Include `assets/js/site.js` for the shared header/footer.
3. Add a card for it in `index.html`'s tool grid — flip its badge from
   `Planned` to `Live` once it's working.
4. Add the page to `sitemap.xml`.
5. If it needs its own JS logic, keep it in `assets/js/your-tool.js` —
   one file per concern, same pattern as `diagram.js` / `export.js`.

## Design tokens quick reference

Colors, spacing, and component classes are all defined as CSS custom
properties at the top of `styles.css` (e.g. `--blue`, `--panel`,
`--radius-md`). Reuse those instead of hardcoding new hex values or pixel
sizes — that's what keeps light/dark mode and the overall look consistent
across every page and every tool.

## Code style

- Plain, readable JS. No transpilation, no JSX, no TypeScript — keep it
  something anyone can open in a text editor and understand immediately.
- Wrap each file's logic in an IIFE (`(function () { ... })()`) so
  variables don't leak into the global scope across script files.
- Prefer small, focused functions over long ones.
- Comment the *why*, not the *what*, when something isn't obvious.

## Submitting changes

1. Fork the repo, create a branch named for what you're doing
   (`add-yaml-tool`, `fix-mobile-nav`, etc).
2. Test by opening `index.html` directly in a browser — no server needed,
   though `python3 -m http.server` in the project root works too if you
   want clean relative paths.
3. Open a pull request describing what changed and why. Screenshots for
   anything visual are appreciated.

## Questions

Reach out via [msdevbuild.com/contact](https://www.msdevbuild.com/p/contact-suthahar-jegatheesan-js.html)
or open a GitHub issue.
