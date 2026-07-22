# JSON Studio

Free, client-side JSON tooling from [MSDEVBUILD](https://www.msdevbuild.com/).
Fourteen tools, no account, no backend — everything you paste stays in your
browser.

**Live site:** <https://jsonstudio.msdevbuild.com/> — or open `index.html`
directly, or host this folder anywhere that serves static files. `tools.html` is the launcher — every tool on one page,
with search — and <kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd> opens the same switcher
from anywhere on the site.

## Tools

| Page | What it does |
|---|---|
| `tool.html` | Interactive, collapsible JSON diagram with search and PNG/SVG export |
| `format.html` | Beautify, minify, sort, escape/unescape, validate |
| `diff.html` | Structural comparison, JSON Patch and Merge Patch output |
| `jsonpath.html` | JSONPath tester with filters, slices and recursive descent |
| `json-schema.html` | Infer a JSON Schema from a sample payload |
| `validate.html` | Validate a payload against a schema |
| `mock.html` | Generate seeded fake data from a schema |
| `code.html` | Generate C#, TypeScript, Dart, Kotlin, Java, Python or Go types |
| `csv.html` | JSON ⇄ CSV |
| `yaml-json.html` | YAML ⇄ JSON |
| `xml.html` | JSON ⇄ XML |
| `jsonl.html` | JSONL/NDJSON ⇄ JSON array |
| `sql.html` | CREATE TABLE + INSERT for Postgres, MySQL, SQL Server, SQLite |
| `jwt.html` | Decode a JWT and verify HS256 signatures locally |

Plus `tools.html` — all of them in one searchable page.

Every page: light and dark mode (following your OS until you choose),
drag-and-drop file input, copy and download, ⌘/Ctrl + Enter to re-run, and
⌘/Ctrl + K to jump to another tool.

## Design

The identity is violet (`--brand`) and teal (`--accent`) on faintly cool
paper, deliberately not the corporate blue every developer tool defaults to.
Colours live in three slots at the top of `assets/css/styles.css` — `--brand`,
`--accent`, `--ink` — and everything else derives from them, so re-theming the
whole site is a five-line edit. The `--blue*` names are kept as aliases.

Dark mode follows your OS until you pick a side, and is applied before first
paint so there is no white flash.

## The workbench

Tool pages are laid out like an editor, because that is what they are.

**An icon rail** down the left edge switches tools in one click — every tool,
grouped, with the current one marked and a tooltip on hover. No menu, no trip
back to the home page. <kbd>Alt</kbd>+<kbd>1…9</kbd> jumps by number.

**Collapsible panels.** <kbd>⌘B</kbd> / <kbd>Ctrl+B</kbd> hides the input side
and gives the result the whole window — the same shortcut and the same feel as
hiding an editor sidebar. Each pane also has a collapse button in its header,
and a slim chevron on the left edge brings a hidden panel back. The last
visible panel can't be collapsed, so you can never end up with a blank page.

Collapse state is remembered **per tool**, since what you want differs: on the
diagram page you rarely need the JSON pane, on the diff page you always do.

## Every tool has a home page

Below the app itself, each tool page carries a landing section: an
introduction, four feature cards, numbered usage instructions, three FAQs,
related tools and a share panel. Jump links in the tool's header ("What it
does · How to use it · FAQ · Share") get you there, and a button brings you
back up to the tool.

That section is what makes a tool page findable — a page with an app and no
prose ranks for nothing — and it doubles as the documentation for people who
land on the tool cold.

## Sharing

Every tool page and the home page carry a share panel: **copy link, email,
WhatsApp, Microsoft Teams, Slack, LinkedIn and X**, plus the native share sheet
on phones and tablets.

Slack has no public share URL — it requires an installed app — so that button
copies a formatted, paste-ready message rather than pretending to open
something. The clipboard buttons fall back to a selectable field when the
browser blocks clipboard access.

**Only the page address is shared.** Nothing you have pasted into a tool is
ever included in a share link, which is the same promise the rest of the site
makes. `assets/js/share.js` builds every link from the page's canonical URL and
title, so a new tool page gets working sharing with no configuration.

## Presentation mode

Every tool can be presented. Hit **Present** in the header (or <kbd>Shift</kbd>
+ <kbd>P</kbd>, or <kbd>F11</kbd>) and the page becomes a demo surface: header,
footer, page title and option bar disappear, the working area takes the whole
screen in real full screen, and editor type scales up so it reads from the back
of a room. On the diagram page the editor pane collapses and the canvas
auto-fits — roughly a third more width for the diagram.

A presenter toolbar sits at the bottom and fades out when you stop moving:

| Control | Keys | What it does |
|---|---|---|
| Zoom | <kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd> | Scales the diagram, or the editor type on other tools |
| Fit | <kbd>F</kbd> | Fits the diagram to the screen |
| Navigation | <kbd>←↑↓→</kbd> | Pans the canvas |
| Panels | — | Show or hide any individual pane, plus the option bar |
| Focus | <kbd>O</kbd> | Only the result — no headers, no chrome, edge to edge |
| Laser | <kbd>L</kbd> | Laser pointer with a fading trail; click for a ripple |
| Exit | <kbd>Esc</kbd> | Back to normal |

Diagrams stay crisp at any zoom because they are SVG, and re-fit automatically
when panels open or close or the window resizes.

## Install it

**As an app (PWA).** Click *Install app* in the header, or use your browser's
install option. It opens in its own window, launches from the dock or start
menu, and every tool is precached — the whole site works with no connection at
all. `manifest.webmanifest` and `sw.js` are the moving parts; bump `CACHE` in
`sw.js` whenever you change a cached file.

**As a browser extension.** `extension/` holds a Manifest V3 extension: a
toolbar launcher for all 14 tools, plus a right-click *Send to JSON Studio* menu
that pushes selected text straight into a tool. See
[extension/README.md](extension/README.md) for loading and publishing it.

Selected text reaches a tool through the URL fragment (`#input=…`), which
browsers never transmit to the server — so the extension keeps the same
no-upload guarantee as the site.

## Notes on a few of them

**JSON → diagram** — pan/zoom node graph, collapse and expand branches, search
across keys and values with auto-expand to matches, PNG/SVG export, and an
optional "explain with AI" panel that uses your own OpenAI key, called straight
from the browser.

**Schema generator and code generator** share one inference engine
(`assets/js/infer.js`). Array elements are inferred individually then merged, so
the result describes *every* element: the union of properties, with only the
always-present keys marked required. `integer` + `number` widens to `number`;
genuinely mixed types become `anyOf`.

**JSONPath** is hand-written rather than pulled from a library, specifically so
filter expressions are parsed rather than handed to `eval()` — a pasted
expression can't execute code.

**JWT decoder** never transmits the token. With a secret supplied it verifies
HS256/384/512 via WebCrypto in the page; RS/ES tokens are decoded but not
verified, since that needs a public key.

**Offline** is real, not aspirational: the service worker precaches every page
and asset, so an installed copy runs on a plane. It is verified end-to-end —
the test suite loads a tool with the network disabled and checks it still
produces output.

**Schema validator** covers the keywords that turn up in real schemas — types,
`required`, `enum`, `const`, numeric and string bounds, `items`/`prefixItems`,
`uniqueItems`, `contains`, `additionalProperties`, `patternProperties`,
`dependentRequired`, `anyOf`/`oneOf`/`allOf`/`not`, and `$ref` to local
pointers. It is not a complete draft implementation; dynamic refs and content
encoding are out of scope.

## Running locally

No build step required.

```bash
git clone <this-repo>
cd json-studio
python3 -m http.server 8080
# open http://localhost:8080
```

Or just double-click `index.html` — everything works from the local filesystem
too, since there's no backend to connect to. (Service workers need http, so the
PWA install and offline caching only kick in when it's served.) The only
external dependency is js-yaml (CDN, used by the YAML page); every other tool
is self-contained.

## SEO

The site is built to be found, since that is the only distribution a free tool
gets:

- **One page per tool**, each with a keyword-led `<title>`, a written
  description, and a content section below the app: what the tool does, three
  how-to steps, three FAQs, and links to related tools.
- **Structured data** on every page — `SoftwareApplication`, `BreadcrumbList`,
  `FAQPage` and `HowTo` per tool; `WebSite` with a `SearchAction`,
  `Organization` and `FAQPage` on the home page; `ItemList` on the hub.
- **Social cards** — `assets/img/og-cover.png` (1200×630) on every page, with
  matching `og:` and `twitter:` tags.
- **Internal linking** — every tool links to three related tools, the hub and
  the presentation page; the rail and footer link everything to everything.
- `sitemap.xml` lists all 17 pages; `robots.txt` points at it.

When adding a tool, add its copy to the SEO catalog too — a tool page without
that section will not rank for anything.

## Deploying

This is a static site. The repository includes a `CNAME` for
`jsonstudio.msdevbuild.com` (GitHub Pages); other hosts configure the domain
in their own dashboard. Point any static host (Cloudflare Pages, Netlify,
Vercel, GitHub Pages, S3 + CloudFront, or a plain nginx box) at the project root
and it works as-is. Update `robots.txt` and `sitemap.xml` if you deploy under a
different domain than `jsonstudio.msdevbuild.com`.

## Project structure & contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the folder layout, the shared
toolkit new tools build on, and the design system.

## License

MIT — see LICENSE.
