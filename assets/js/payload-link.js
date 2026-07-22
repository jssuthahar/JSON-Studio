/*
  payload-link.js — links that carry the payload with them.

  A tool page can already be handed content through the URL fragment
  (#input=… , used by the browser extension). This adds the other half: turning
  what is currently in a tool into a link you can send to someone.

  Two things make that workable:

    · The payload lives in the fragment, which browsers never transmit to a
      server. The link is resolved entirely in the recipient's browser, so the
      no-upload promise still holds.
    · It is deflate-compressed before encoding (via the browser's own
      CompressionStream), because raw percent-encoded JSON produces absurd
      URLs. Typical payloads shrink by 70-85%.

  What it does NOT do is hide anything: the data is *in* the link, so anyone
  who has the link has the payload. Callers are expected to say so — see the
  warning in the share panel.
*/

(function () {
  const SUPPORTED = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  // Anything past this and the link stops being usable: chat clients, mail
  // gateways and some servers truncate long URLs.
  const SOFT_LIMIT = 8000;
  const HARD_LIMIT = 60000;

  function bytesToBase64url(bytes) {
    let bin = '';
    // Chunked so a large payload doesn't blow the argument limit.
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function base64urlToBytes(text) {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  async function squeeze(text) {
    const raw = new TextEncoder().encode(text);
    if (!SUPPORTED) return { encoded: bytesToBase64url(raw), compressed: false };
    const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const packed = new Uint8Array(await new Response(stream).arrayBuffer());
    return { encoded: bytesToBase64url(packed), compressed: true };
  }

  async function expand(encoded, compressed) {
    const bytes = base64urlToBytes(encoded);
    if (!compressed) return new TextDecoder().decode(bytes);
    if (!SUPPORTED) throw new Error('This browser cannot read compressed links.');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }

  /* Build a shareable link for the given text, or explain why not. */
  async function buildLink(text) {
    const base = (document.querySelector('link[rel="canonical"]') || {}).href || location.href.split('#')[0];
    if (!text || !text.trim()) return { error: 'Nothing to share yet — put something in the tool first.' };

    const { encoded, compressed } = await squeeze(text);
    const url = base + '#' + (compressed ? 'data' : 'input') + '=' + encoded;

    if (url.length > HARD_LIMIT) {
      return { error: 'Too large to put in a link (' + Math.round(text.length / 1024) + ' KB). Share the file instead.' };
    }
    return {
      url,
      long: url.length > SOFT_LIMIT,
      saved: compressed ? Math.max(0, Math.round((1 - encoded.length / text.length) * 100)) : 0
    };
  }

  /* Read a payload handed over in the fragment, if there is one. */
  async function readLink() {
    const hash = location.hash || '';
    const data = /[#&]data=([^&]*)/.exec(hash);
    if (data) {
      try {
        return await expand(data[1], true);
      } catch (e) {
        return null;
      }
    }
    const plain = /[#&]input=([^&]*)/.exec(hash);
    if (plain) {
      try {
        return decodeURIComponent(plain[1].replace(/\+/g, ' '));
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  window.JSONStudioLink = { buildLink, readLink, supported: SUPPORTED };
})();
