/*
  jwt.js
  Decodes a JWT into its header and claims, and — if you supply the secret —
  actually verifies HS256/384/512 signatures using WebCrypto.

  Everything stays in the page. That promise matters more here than on any
  other tool on this site: a JWT is usually a live credential, and pasting one
  into a server-side decoder is handing someone a session.
*/

(function () {
  const $ = TK.$;

  const SAMPLE = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFkYSBMb3ZlbGFjZSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc3MzQ5NzY2MCwiZXhwIjoxNzczNTA0ODYwLCJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJhdWQiOiJhcGkuZXhhbXBsZS5jb20ifQ',
    'wF7HcQ0nJhZ1mFXvHqXqzq6iZBhVBhKq7GkYQnLmVXg'
  ].join('.');

  const input = $('input');
  const outHeader = $('output-header');
  const output = $('output');
  const inStatus = $('in-status');
  const headerStatus = $('header-status');
  const outStatus = $('out-status');

  /* base64url -> text, without assuming padding is present */
  function b64urlDecode(part) {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    const bin = atob(b64);
    // Decode as UTF-8 so non-ASCII claims (names, scopes) survive.
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  function b64urlToBytes(part) {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((part.length + 3) % 4);
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  const TIME_CLAIMS = { exp: 'expires', iat: 'issued', nbf: 'not before', auth_time: 'authenticated' };

  function human(seconds) {
    const delta = seconds * 1000 - Date.now();
    const abs = Math.abs(delta);
    const units = [['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000]];
    for (const [name, ms] of units) {
      // 0.95 rather than 1.0 so a token issued "3600 seconds" ago reads as
      // "1 hour", not "60 minutes".
      if (abs >= ms * 0.95) {
        const n = Math.round(abs / ms);
        return (delta < 0 ? n + ' ' + name + (n === 1 ? '' : 's') + ' ago' : 'in ' + n + ' ' + name + (n === 1 ? '' : 's'));
      }
    }
    return 'just now';
  }

  function claimNotes(payload) {
    const lines = [];
    Object.keys(TIME_CLAIMS).forEach((claim) => {
      const v = payload[claim];
      if (typeof v !== 'number') return;
      lines.push('  ' + claim.padEnd(10) + TIME_CLAIMS[claim] + ' ' + new Date(v * 1000).toISOString() + '  (' + human(v) + ')');
    });
    return lines;
  }

  async function verify(token, alg) {
    const secret = $('opt-secret').value;
    if (!secret) return { state: 'unchecked' };

    const bits = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' }[alg];
    if (!bits) return { state: 'unsupported' };

    const [h, p, s] = token.split('.');
    const raw = $('opt-b64').checked
      ? Uint8Array.from(atob(secret.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(secret);

    const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: bits }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(s), new TextEncoder().encode(h + '.' + p));
    return { state: ok ? 'valid' : 'invalid' };
  }

  async function run() {
    const token = input.value.trim().replace(/^Bearer\s+/i, '');

    if (!token) {
      outHeader.value = '';
      output.value = '';
      TK.status(inStatus, 'Waiting for input.');
      TK.status(headerStatus, '');
      TK.status(outStatus, '');
      return;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      outHeader.value = '';
      output.value = '';
      TK.status(inStatus, 'A JWT has three dot-separated parts — this one has ' + parts.length + '.', 'err');
      TK.status(outStatus, '', 'err');
      return;
    }

    let header;
    let payload;
    try {
      header = JSON.parse(b64urlDecode(parts[0]));
      payload = JSON.parse(b64urlDecode(parts[1]));
    } catch (err) {
      outHeader.value = '';
      output.value = '';
      TK.status(inStatus, 'Could not decode the token: ' + err.message, 'err');
      return;
    }

    outHeader.value = JSON.stringify(header, null, 2);
    TK.status(headerStatus, 'alg ' + (header.alg || '?') + ' · typ ' + (header.typ || '?') + (header.kid ? ' · kid ' + header.kid : ''), 'ok');

    const notes = claimNotes(payload);
    output.value = JSON.stringify(payload, null, 2) + (notes.length ? '\n\n// timestamps\n' + notes.join('\n') : '');

    TK.status(inStatus, 'Decoded · ' + token.length + ' chars · signature ' + parts[2].length + ' chars', 'ok');

    // Expiry is what people are actually here to check, so lead with it.
    const now = Date.now() / 1000;
    const bits = [];
    if (typeof payload.exp === 'number') bits.push(payload.exp < now ? 'EXPIRED ' + human(payload.exp) : 'expires ' + human(payload.exp));
    if (typeof payload.nbf === 'number' && payload.nbf > now) bits.push('not valid until ' + human(payload.nbf));

    let sig = 'signature not verified (no secret supplied)';
    let kind = payload.exp && payload.exp < now ? 'err' : '';
    try {
      const result = await verify(token, header.alg);
      if (result.state === 'valid') { sig = 'signature VALID'; kind = kind || 'ok'; }
      else if (result.state === 'invalid') { sig = 'signature INVALID'; kind = 'err'; }
      else if (result.state === 'unsupported') sig = header.alg + ' needs a public key — not verified here';
    } catch (err) {
      sig = 'could not verify: ' + err.message;
      kind = 'err';
    }

    TK.status(outStatus, bits.concat(sig).join(' · '), kind);
  }

  input.addEventListener('input', run);
  ['opt-secret', 'opt-b64'].forEach((id) => $(id).addEventListener('input', run));
  $('opt-b64').addEventListener('change', run);
  $('btn-run').addEventListener('click', run);
  $('btn-sample').addEventListener('click', () => { input.value = SAMPLE; run(); });
  $('btn-clear').addEventListener('click', () => {
    input.value = '';
    $('opt-secret').value = '';
    run();
  });
  $('btn-copy').addEventListener('click', () => TK.copy(output.value, outStatus, output));
  $('btn-download').addEventListener('click', () => TK.download(output.value, 'claims.json', 'application/json'));

  TK.wireDrop(input, (t) => { input.value = t; run(); }, inStatus);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  });
})();
