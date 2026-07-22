# JSON Studio

Free, client-side JSON tooling from [MSDEVBUILD](https://www.msdevbuild.com/).
Paste or upload JSON and get an interactive, collapsible diagram — no
account, no backend, nothing leaves your browser.

**Live tools:** `tool.html` (diagram), `yaml-json.html` (YAML ⇄ JSON),
`json-schema.html` (schema generator) — open directly in a browser, or
host this folder anywhere that serves static files.

## JSON → diagram (`tool.html`)

- Interactive pan/zoom node diagram of any JSON document
- Collapse/expand branches, expand-all / collapse-all
- Search across keys and values, with auto-expand to reveal matches
- Format & validate JSON
- Upload a `.json` file or paste directly
- Export the diagram as **PNG** or **SVG**
- Optional **AI explain** panel — uses your own OpenAI API key, called
  directly from the browser (see the privacy note on the tool page)
- Light and dark mode

## YAML ⇄ JSON (`yaml-json.html`)

- Converts both directions, with the direction auto-detected from the
  input (JSON is valid YAML, so JSON parsing is tried first)
- Live conversion as you type, with parse errors reported by line/column
- Multi-document YAML (`---` separated) round-trips to a JSON array
- 2/4-space or tab indentation, optional recursive key sorting
- Upload or drag in a `.yaml` / `.yml` / `.json` file; copy or download
  the result
- Uses [js-yaml](https://github.com/nodeca/js-yaml) from a CDN, safe
  schema only — no arbitrary tag execution

## JSON Schema generator (`json-schema.html`)

- Infers a schema from one sample payload: types, nested objects and
  arrays
- Array elements are merged rather than sampled — the `items` schema is
  the union of every element's properties, and only keys present in
  *all* of them are marked `required`
- Mixed types collapse sensibly: `integer` + `number` → `number`,
  anything else → `anyOf`
- Optional `format` detection (date-time, date, time, uuid, email,
  ipv4, uri), `enum` detection for repeated small string sets,
  `examples`, and `additionalProperties: false`
- Draft 2020-12 or draft-07 output; copy or download as `schema.json`

## Running locally

No build step required.

```bash
git clone <this-repo>
cd json-studio
python3 -m http.server 8080
# open http://localhost:8080
```

Or just double-click `index.html` — everything works from the local
filesystem too, since there's no backend to connect to.

## Deploying

This is a static site. Point any static host (Cloudflare Pages, Netlify,
Vercel, GitHub Pages, S3 + CloudFront, or a plain nginx box) at the
project root and it works as-is. Update `robots.txt` and `sitemap.xml`
if you deploy under a different domain than `json.msdevbuild.com`.

## Project structure & contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the folder layout, design
system, and guidelines for adding new tools.

## License

MIT — see LICENSE (add one matching your preference; not included by
default in this scaffold).
