/*
  background.js — MV3 service worker for the JSON Studio extension.

  Two jobs: build the right-click menu, and open the chosen tool with the
  selected text handed over in the URL fragment.

  The fragment matters: browsers never send the part after "#" to the server,
  so selected text stays on the machine even though the tool page is loaded
  over the network. That keeps the extension consistent with the site's
  "nothing is uploaded" promise. It also means no host permissions are needed
  — the extension never reads page content itself, it only receives whatever
  the browser reports as the current selection.
*/

const BASE = 'https://json.msdevbuild.com/';

const TARGETS = [
  { id: 'format', title: 'Format & validate', page: 'format.html' },
  { id: 'diagram', title: 'View as diagram', page: 'tool.html' },
  { id: 'jsonpath', title: 'Query with JSONPath', page: 'jsonpath.html' },
  { id: 'schema', title: 'Generate a JSON Schema', page: 'json-schema.html' },
  { id: 'code', title: 'Generate code (C#, TS, …)', page: 'code.html' },
  { id: 'jwt', title: 'Decode as JWT', page: 'jwt.html' }
];

// Chrome truncates a context-menu selection at 8k anyway; keep the URL sane.
const MAX = 200000;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'json-studio',
      title: 'Send to JSON Studio',
      contexts: ['selection']
    });
    TARGETS.forEach((t) => {
      chrome.contextMenus.create({
        id: 'json-studio-' + t.id,
        parentId: 'json-studio',
        title: t.title,
        contexts: ['selection']
      });
    });
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const target = TARGETS.find((t) => 'json-studio-' + t.id === info.menuItemId);
  if (!target) return;

  const text = (info.selectionText || '').slice(0, MAX);
  const url = BASE + target.page + (text ? '#input=' + encodeURIComponent(text) : '');
  chrome.tabs.create({ url });
});
