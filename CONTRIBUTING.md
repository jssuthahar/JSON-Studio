# Contributing to JSON Studio

Thanks for wanting to help build this out. This is a static, client-side-only
site (no build step, no backend, no framework) so it's easy to pick up —
here's how everything fits together and how to add to it.

## Folder structure

```text
json-studio/
├── index.html              Home page — hero, tool grid, FAQ, SEO tags
├── tools.html                All tools in one searchable page
├── presentation.html         Presentation mode — feature page
├── tool.html                 JSON → diagram
├── format.html               Formatter / validator / minifier
├── diff.html                 JSON diff
├── jsonpath.html             JSONPath tester
├── json-schema.html          JSON Schema generator
├── validate.html             JSON Schema validator
├── mock.html                 Mock data generator
├── code.html                 JSON → typed classes
├── csv.html                  JSON ⇄ CSV
├── yaml-json.html            YAML ⇄ JSON
├── xml.html                  JSON ⇄ XML
├── jsonl.html                JSONL ⇄ JSON
├── sql.html                  JSON → SQL
├── jwt.html                  JWT decoder
├── assets/
│   ├── css/
│   │   ├── styles.css        Shared design tokens, header, footer, cards
│   │   ├── tool.css           Styles for the diagram page
│   │   ├── convert.css        Shared two-pane input→output tool layout
│   │   ├── present.css        Presentation mode
│   │   └── workbench.css      Tool rail + collapsible panels
│   ├── js/
│   │   ├── site.js            Header/footer, nav, ⌘K palette, theme, PWA install
│   │   ├── tool-kit.js        Shared tool plumbing (window.TK)
│   │   ├── tools-hub.js       Search + filtering for tools.html
│   │   ├── present.js         Presentation mode (all tool pages)
│   │   ├── share.js           Share panel (link, email, WhatsApp, Teams, Slack…)
│   │   ├── workbench.js       Tool rail + collapsible panels
│   │   ├── infer.js           Type inference shared by the schema + code tools
│   │   ├── diagram.js         D3 tree rendering, search, collapse/expand
│   │   ├── export.js          PNG/SVG export
│   │   ├── ai-assist.js       Optional "explain with AI" panel (OpenAI API)
│   │   └── <tool>.js          One file per tool page
│   └── img/
│       ├── favicon.svg        Also the source for the PNG icons
│       └── icon-*.png         PWA + extension icons
├── manifest.webmanifest       PWA manifest
├── sw.js                      Service worker (offline precache)
├── extension/                 Manifest V3 browser extension
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
   the barrier to "clone and open index.html" as low as possible. Prefer no
   dependency at all where the format is small enough to handle directly —
   the CSV parser and the JSONPath evaluator are hand-written for exactly
   this reason, and the XML page uses the browser's own `DOMParser`.
   js-yaml, on the YAML page, is currently the only third-party runtime
   dependency on the site.
3. **Everything works offline.** Every page and asset is precached by `sw.js`.
   If you add a file, add it to `PRECACHE` and bump `CACHE` — otherwise
   installed copies keep serving the old version.
4. **Reuse the design system.** All shared visual tokens (colors, spacing,
   card styles, buttons, header/footer) live in `assets/css/styles.css`.
   New pages should link that file first, then a page-specific stylesheet
   for anything unique (see `tool.css` as the pattern to copy).
5. **Every page gets a header and footer.** Add `<div id="site-header">`
   and `<div id="site-footer"></div>` to the page, then include
   `assets/js/site.js` — it injects both automatically and keeps
   navigation links in sync across the whole site from one file.
6. **SEO isn't optional.** Every new page needs: a unique `<title>`, a
   `meta description`, a `canonical` link, and Open Graph tags. Add the
   page to `sitemap.xml` too. Pages also need the PWA head block (manifest
   link, theme-color, apple-touch-icon) and the pre-paint theme script — copy
   both from any existing page.

## Adding a new tool

Most tools are "paste something in, get something out", and that shape is
already built — reuse it instead of rewriting the plumbing.

1. Create `your-tool.html` at the project root, copying the `<head>` and
   two-pane body from an existing converter page (`csv.html` is a good
   template). Link `styles.css` then `convert.css`.
2. Use the standard element ids so the shared toolkit can wire itself up:
   `#input` `#output` `#in-status` `#out-status` `#btn-run` `#btn-copy`
   `#btn-download` `#btn-upload` `#btn-clear` `#btn-sample` `#file-input`.
   All of them are optional — whatever is present gets wired.
3. Include `assets/js/site.js`, then `assets/js/tool-kit.js`, then your own
   `assets/js/your-tool.js`.
4. In your file, call `TK.tool({ ... })` and supply just the transformation:

   ```js
   TK.tool({
     sample: '{"hello": "world"}',
     filename: 'output.txt',
     options: ['opt-something'],   // ids that re-run the tool when changed
     run(text) {
       const data = TK.parseJSON(text);       // throws a readable error
       return { output: transform(data), inMsg: 'Valid JSON', outMsg: 'Done' };
     }
   });
   ```

   Throwing an `Error` from `run()` shows its message against the input pane.
   Copy, download, upload, drag-and-drop, ⌘/Ctrl+Enter and the sample button
   are all handled for you. Tools with two inputs (see `diff.js`,
   `validate.js`) wire their own listeners but still use the `TK.*` helpers.
5. Add the page to the `TOOLS` array in `assets/js/site.js` — that one array
   feeds the nav dropdown, the mobile nav, the footer and the ⌘K palette.
6. Write its landing copy — the explainer, four feature cards, three how-to
   steps, three FAQs and three related tools that appear below the app shell.
   A tool page without that section will not rank for anything, and gives a
   first-time visitor nothing to read.
   Sharing needs no work: include `assets/js/share.js` and drop a
   `<div data-share></div>` where you want the buttons. Every link is built
   from the page's canonical URL — never include page content in a share link.
7. Add a card for it in `index.html` and `tools.html` (give the card a
   `data-keys` attribute with search synonyms — that is what makes searching
   "kubernetes" find the YAML tool), add it to `sitemap.xml`, add its page and
   script to `PRECACHE` in `sw.js`, and add it to the `TOOLS` list in
   `extension/popup.js`.
8. If the tool should accept text handed over by the extension, nothing extra
   is needed: `TK.tool()` already reads `#input=` from the URL fragment.
9. Presentation mode needs nothing either, as long as the page uses the
   standard structure. `present.js` finds `.pane` elements by itself, treats
   the last one as the result being demonstrated, and builds the Panels menu
   from their `.pane-title` text. Load `present.css` and `present.js` — see any
   existing tool page.

The workbench (icon rail, ⌘B panel collapsing) is automatic too — it reads the
tool list from `window.JSONStudioNav`, which `site.js` exports, and finds the
panes the same way. Load `workbench.css` and `workbench.js` after the
presentation ones.

A tool with its own canvas (like the diagram) can opt into the zoom, fit and
pan controls by exposing `fit`, `zoomBy`, `panBy` and `zoomLevel` on
`window.JSONStudio`, and re-fitting when the `presentation-change` event
fires — `assets/js/diagram.js` is the worked example. That same event fires
when a workbench panel is collapsed, so a canvas re-fits then as well.

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
   want clean relative paths. Check both light and dark mode, and check the
   page at a narrow width — the two-pane layout stacks below 900px.
3. Open a pull request describing what changed and why. Screenshots for
   anything visual are appreciated.

## Questions

Reach out via [msdevbuild.com/contact](https://www.msdevbuild.com/p/contact-suthahar-jegatheesan-js.html)
or open a GitHub issue.
