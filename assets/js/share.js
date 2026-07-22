/*
  share.js — "send this tool to someone".

  Renders into any <div data-share> on the page. The link shared is the page's
  canonical URL, and the message is built from the page title, so every tool
  shares itself with no per-page configuration.

  Only the page address is ever shared. Nothing you have pasted into a tool is
  included — that would defeat the point of a site that never uploads anything.

  Slack has no public share URL the way the others do (it needs an installed
  app), so that button copies a ready-to-paste message instead of pretending
  to open something.
*/

(function () {
  const targets = [...document.querySelectorAll('[data-share]')];
  if (!targets.length) return;

  function canonical() {
    const link = document.querySelector('link[rel="canonical"]');
    if (link && link.href) return link.href;
    return location.href.split('#')[0];
  }

  function pageTitle() {
    const el = document.querySelector('[data-share][data-share-title]');
    if (el) return el.dataset.shareTitle;
    // "JSON Formatter & Validator — free, online | JSON Studio" → the useful half
    return document.title.split('|')[0].split('—')[0].trim();
  }

  const URL_ = canonical();
  const TITLE = pageTitle();
  const BLURB = TITLE + ' — a free JSON tool that runs entirely in your browser. No signup, nothing uploaded.';

  const enc = encodeURIComponent;

  const ICONS = {
    link: '<path d="M9.5 12.5a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1"/><path d="M14.5 11.5a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    chat: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 1 1 21 12Z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    hash: '<path d="M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16"/>',
    badge: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7.5v.01M12.5 17v-4a2 2 0 0 1 4 0v4"/>',
    x: '<path d="m5 5 14 14M19 5 5 19"/>',
    dots: '<circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/>'
  };

  const icon = (name) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICONS[name] + '</svg>';

  /* Each entry either opens a URL or runs an action. */
  const CHANNELS = [
    { id: 'copy', label: 'Copy link', icon: 'link', action: copyLink },
    { id: 'email', label: 'Email', icon: 'mail', href: 'mailto:?subject=' + enc(TITLE) + '&body=' + enc(BLURB + '\n\n' + URL_) },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'chat', href: 'https://wa.me/?text=' + enc(BLURB + ' ' + URL_) },
    { id: 'teams', label: 'Teams', icon: 'grid', href: 'https://teams.microsoft.com/share?href=' + enc(URL_) + '&msgText=' + enc(BLURB) },
    { id: 'slack', label: 'Slack', icon: 'hash', action: copyForSlack, note: 'copies a message' },
    { id: 'linkedin', label: 'LinkedIn', icon: 'badge', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(URL_) },
    { id: 'x', label: 'X', icon: 'x', href: 'https://twitter.com/intent/tweet?text=' + enc(BLURB) + '&url=' + enc(URL_) }
  ];

  function flash(root, message, kind) {
    const status = root.querySelector('.share-status');
    if (!status) return;
    status.textContent = message;
    status.className = 'share-status' + (kind ? ' ' + kind : '');
    clearTimeout(status.__t);
    status.__t = setTimeout(() => { status.textContent = ''; status.className = 'share-status'; }, 3200);
  }

  async function toClipboard(text, root, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
      flash(root, okMessage, 'ok');
    } catch (e) {
      // Clipboard access needs a secure context; fall back to a selectable field.
      const box = root.querySelector('.share-fallback');
      if (box) {
        box.hidden = false;
        box.value = text;
        box.focus();
        box.select();
      }
      flash(root, 'Press ⌘/Ctrl + C to copy.');
    }
  }

  function copyLink(root) {
    toClipboard(URL_, root, 'Link copied.');
  }

  function copyForSlack(root) {
    toClipboard('*' + TITLE + '*\n' + BLURB + '\n' + URL_, root, 'Message copied — paste it into Slack.');
  }

  function render(root) {
    const channels = CHANNELS.slice();

    // Phones and tablets have a real share sheet; offer it rather than
    // duplicating what the operating system already does better.
    if (navigator.share) {
      channels.push({
        id: 'native', label: 'More…', icon: 'dots',
        action: (r) => navigator.share({ title: TITLE, text: BLURB, url: URL_ }).catch(() => {})
      });
    }

    root.innerHTML = `
      <div class="share-row">
        ${channels.map((c) => c.href
          ? `<a class="share-btn" data-id="${c.id}" href="${c.href}" target="_blank" rel="noopener"
               title="Share by ${c.label}">${icon(c.icon)}<span>${c.label}</span></a>`
          : `<button class="share-btn" type="button" data-id="${c.id}"
               title="${c.label}${c.note ? ' — ' + c.note : ''}">${icon(c.icon)}<span>${c.label}</span></button>`
        ).join('')}
      </div>
      <input class="share-fallback" type="text" readonly hidden aria-label="Link to copy">
      <p class="share-status" role="status" aria-live="polite"></p>`;

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button.share-btn');
      if (!btn) return;
      const channel = channels.find((c) => c.id === btn.dataset.id);
      if (channel && channel.action) channel.action(root);
    });
  }

  targets.forEach(render);
})();
