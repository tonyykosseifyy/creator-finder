import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { call, readKey, saveKey, forgetKey, KeyError, EXEC_URL } from './api.js';
import Review from './Review.jsx';
import Brands from './Brands.jsx';
import Control from './Control.jsx';

function Login({ onKey, error }) {
  const [value, setValue] = useState('');
  return (
    <main className="login">
      <form className="login-box" onSubmit={e => { e.preventDefault(); if (value.trim()) onKey(value.trim()); }}>
        <Mark />
        <h1>Creator Finder</h1>
        <p>Open the team link, or paste the access key from it (the part after <code>k=</code>).</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <label className="sr-only" htmlFor="key">Access key</label>
        <input id="key" autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Access key" autoComplete="off" />
        <button className="btn primary" type="submit">Open the finder</button>
      </form>
    </main>
  );
}

export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" />
      <path d="M6 19c3-6 6-6 9 0s6 6 9 0" />
    </svg>
  );
}

// one screen failing never blanks the whole app
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="crash">
        <h2>This screen hit a problem</h2>
        <p>{String(this.state.error.message || this.state.error)}</p>
        <button className="btn" onClick={() => this.setState({ error: null })}>Try again</button>
      </main>
    );
  }
}

const ROUTES = ['instagram', 'tiktok', 'brands', 'control'];
const routeFromHash = () => { const r = window.location.hash.replace(/^#\/?/, ''); return ROUTES.includes(r) ? r : 'instagram'; };
const UNDO_MS = 6000;

export default function App() {
  const [key, setKey] = useState(() => readKey());
  const [keyError, setKeyError] = useState('');
  const [route, setRoute] = useState(routeFromHash);
  const [toast, setToast] = useState(null);
  const [queue, setQueue] = useState(null);       // shared by the Instagram and TikTok pages, loaded once
  const [queueError, setQueueError] = useState('');
  const [brands, setBrands] = useState(null);     // kept between visits so switching screens is instant
  const [control, setControl] = useState(null);
  const timer = useRef();
  const pending = useRef(new Map());              // decisions waiting out their undo window

  useEffect(() => {
    const on = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const notify = useCallback((text, tone = 'plain', action = null) => {
    setToast({ text, tone, action, id: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), action ? UNDO_MS : 4200);
  }, []);

  // every screen calls the backend through this; a rejected key sends you back to the sign-in screen
  const api = useMemo(() => async (fn, ...args) => {
    try { return await call(key, fn, ...args); }
    catch (e) {
      if (e instanceof KeyError) { forgetKey(); setKey(''); setKeyError('That access key is not valid any more. Ask for the current team link.'); }
      throw e;
    }
  }, [key]);

  const loadQueue = useCallback(async () => {
    setQueueError('');
    try { setQueue(await api('uiQueue')); } catch (e) { setQueueError(e.message); }
  }, [api]);
  useEffect(() => { if (key) loadQueue(); }, [key, loadQueue]);

  // A decision leaves the queue at once and is saved after the undo window.
  // If the tab closes first, the browser still sends it (sendBeacon).
  const send = useCallback(async (d) => {
    pending.current.delete(d.row);
    try { await api('uiDecide', d.row, d.handle, d.kind, d.reason || '', d.message || ''); }
    catch (e) {
      setQueue(q => (q ? { ...q, items: [d.item, ...q.items], reviewed: Math.max(0, (q.reviewed || 1) - 1) } : q));
      notify(`@${d.handle} was not saved: ${e.message}`, 'bad');
    }
  }, [api, notify]);

  const decide = useCallback((item, kind, extra = {}) => {
    const d = { row: item.row, handle: item.handle, kind, reason: extra.reason, message: extra.message, item };
    setQueue(q => ({ ...q, items: q.items.filter(c => c.row !== item.row), reviewed: (q.reviewed || 0) + 1 }));
    d.timer = setTimeout(() => send(d), UNDO_MS);
    pending.current.set(item.row, d);
    notify(kind === 'shortlist' ? `@${item.handle} added to Creators` : `@${item.handle} marked not a fit`, 'good', {
      label: 'Undo',
      run: () => {
        const p = pending.current.get(item.row);
        if (!p) return;
        clearTimeout(p.timer);
        pending.current.delete(item.row);
        setQueue(q => ({ ...q, items: [item, ...q.items], reviewed: Math.max(0, (q.reviewed || 1) - 1), focus: item.row }));
        setToast(null);
      },
    });
  }, [notify, send]);

  useEffect(() => {
    const flush = () => {
      for (const d of pending.current.values()) {
        clearTimeout(d.timer);
        navigator.sendBeacon(EXEC_URL, JSON.stringify({ k: key, fn: 'uiDecide', args: [d.row, d.handle, d.kind, d.reason || '', d.message || ''] }));
      }
      pending.current.clear();
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [key]);

  if (!key) return <Login error={keyError} onKey={k => { saveKey(k); setKeyError(''); setKey(k); }} />;

  const items = (queue && queue.items) || [];
  const count = p => items.filter(c => (c.platform || 'Instagram') === p).length;
  const tabs = [
    ['instagram', 'Instagram', queue ? count('Instagram') : null],
    ['tiktok', 'TikTok', queue ? count('TikTok') : null],
    ['brands', 'Brands', null],
    ['control', 'Control', null],
  ];

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <div className="brand"><Mark /><span>Creator Finder</span></div>
        <nav aria-label="Screens">
          {tabs.map(([id, label, n]) => (
            <a key={id} href={`#/${id}`} className={route === id ? 'tab on' : 'tab'} aria-current={route === id ? 'page' : undefined}>
              {label}{n != null && <span className={n ? 'badge' : 'badge zero'} aria-label={`${n} waiting`}>{n}</span>}
            </a>
          ))}
        </nav>
        <button className="link quiet signout" onClick={() => { forgetKey(); setKey(''); }}>Sign out</button>
      </header>
      <Boundary key={route}>
        {route === 'instagram' && <Review platform="Instagram" queue={queue} error={queueError} reload={loadQueue} decide={decide} api={api} notify={notify} />}
        {route === 'tiktok' && <Review platform="TikTok" queue={queue} error={queueError} reload={loadQueue} decide={decide} api={api} notify={notify} />}
        {route === 'brands' && <Brands api={api} notify={notify} rows={brands} setRows={setBrands} />}
        {route === 'control' && <Control api={api} notify={notify} data={control} setData={setControl} />}
      </Boundary>
      {toast && (
        <div key={toast.id} className={'toast ' + toast.tone} role="status" aria-live="polite">
          <span>{toast.text}</span>
          {toast.action && <button className="toast-action" onClick={toast.action.run}>{toast.action.label}</button>}
        </div>
      )}
    </div>
  );
}
