# JSON Studio browser extension

A toolbar launcher for [JSON Studio](https://jsonstudio.msdevbuild.com/): open any of
the 14 tools in one click, or right-click selected text anywhere and send it
straight into the formatter, diagram, JSONPath tester, schema generator, code
generator or JWT decoder.

Manifest V3. Works in Chrome, Edge, Brave, Opera and any other Chromium
browser. See [Firefox](#firefox) below.

## Install for development

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this `extension/` folder.
4. Pin the icon to your toolbar. `Alt+Shift+J` opens the launcher.

## How selected text reaches a tool

The extension opens `https://jsonstudio.msdevbuild.com/<tool>.html#input=<your text>`.

Everything after `#` is a URL *fragment*, and browsers never transmit fragments
to the server — so the selected text is handed to the page locally, and the
page's JavaScript reads it in your browser. Nothing is uploaded, which is the
same promise the site itself makes.

That design is also why the extension asks for so little:

| Permission | Why |
|---|---|
| `contextMenus` | Adds the "Send to JSON Studio" right-click menu |
| `storage` | Reserved for remembering your preferred tool |

There are **no host permissions** — the extension never reads or injects
anything into the pages you visit. It only receives the text the browser
already reports as your current selection, and only when you choose a menu
item. The popup optionally reads your clipboard to pre-fill the paste box; deny
that prompt and everything else still works.

## Publishing

1. Bump `version` in `manifest.json`.
2. Zip the contents of this folder (the folder's *contents*, not the folder):
   `cd extension && zip -r ../json-studio-extension.zip . -x '.*'`
3. Upload at the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole)
   (one-off $5 registration fee) or [Edge Add-ons](https://partner.microsoft.com/dashboard/microsoftedge)
   (free).
4. Store listing needs: 128×128 icon (included), at least one 1280×800 or
   640×400 screenshot, a short description and a privacy justification. For the
   privacy section: the extension collects no user data, and the justification
   for `contextMenus` is the right-click menu.

## Firefox

Firefox supports MV3 but wants `background.scripts` rather than
`background.service_worker`, and needs a `browser_specific_settings.gecko.id`.
To port it, change the background key to:

```json
"background": { "scripts": ["background.js"] }
```

and add:

```json
"browser_specific_settings": { "gecko": { "id": "json-studio@msdevbuild.com" } }
```

The rest of the code uses the `chrome.*` namespace, which Firefox aliases.

## Files

```text
extension/
├── manifest.json     MV3 manifest
├── background.js     Context menu + tab opening
├── popup.html        Toolbar launcher markup
├── popup.css         Styling, light and dark
├── popup.js          Search, keyboard nav, paste hand-off
└── icons/            16 / 32 / 48 / 128 px
```
