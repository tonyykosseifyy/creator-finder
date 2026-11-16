// The finder's backend is the Google Apps Script web app. Every call is a plain POST carrying the access key.
// The key is not in this code: it comes from the link (?k=...) once, then stays in this browser.
export const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbx5eCAhwSU8uJ3jwIo_3gGslYq6dqqt5lWKd6yhppiCXhW5IC6dFuOQYjU8xX01pW0/exec';

const KEY_NAME = 'wtcf-key';

export function readKey() {
  const url = new URL(window.location.href);
  const fromLink = url.searchParams.get('k');
  if (fromLink) {
    saveKey(fromLink);
    url.searchParams.delete('k');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    return fromLink;
  }
  try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; }
}
export function saveKey(k) { try { localStorage.setItem(KEY_NAME, k.trim()); } catch { /* private mode */ } }
export function forgetKey() { try { localStorage.removeItem(KEY_NAME); } catch { /* private mode */ } }

export class KeyError extends Error {}

export async function call(key, fn, ...args) {
  let res;
  try {
    // text/plain keeps this a simple request, so the browser sends no CORS preflight
    res = await fetch(EXEC_URL, { method: 'POST', body: JSON.stringify({ k: key, fn, args }) });
  } catch {
    throw new Error('Could not reach the finder. Check your connection and try again.');
  }
  let body;
  try { body = await res.json(); } catch { throw new Error('The finder sent back something unexpected. Try again in a minute.'); }
  if (!body.ok) {
    if (/not valid/i.test(body.error || '')) throw new KeyError(body.error);
    throw new Error(body.error || 'Something went wrong.');
  }
  return body.data;
}
