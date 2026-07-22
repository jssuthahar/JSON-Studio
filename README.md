# JSON Studio

Free, client-side JSON tooling from [MSDEVBUILD](https://www.msdevbuild.com/).
Fourteen tools, no account, no backend — everything you paste stays in your
browser.

**Live site:** open `index.html` directly, or host this folder anywhere that
serves static files. `tools.html` is the launcher — every tool on one page,
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

## Deploying

This is a static site. Point any static host (Cloudflare Pages, Netlify,
Vercel, GitHub Pages, S3 + CloudFront, or a plain nginx box) at the project root
and it works as-is. Update `robots.txt` and `sitemap.xml` if you deploy under a
different domain than `json.msdevbuild.com`.

## Project structure & contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the folder layout, the shared
toolkit new tools build on, and the design system.

## License

MIT — see LICENSE.
