import React, { useCallback, useMemo, useRef, useState } from 'react';
import { call, readKey, saveKey, forgetKey, KeyError } from './api.js';
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
        {error && <p className="login-error">{error}</p>}
        <input autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Access key" aria-label="Access key" />
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

const TABS = [['review', 'Review'], ['brands', 'Brands'], ['control', 'Control']];

export default function App() {
  const [key, setKey] = useState(() => readKey());
  const [keyError, setKeyError] = useState('');
  const [tab, setTab] = useState('review');
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const notify = useCallback((text, tone = 'plain') => {
    setToast({ text, tone });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4200);
  }, []);

  // every screen calls the backend through this; a rejected key sends you back to the login
  const api = useMemo(() => async (fn, ...args) => {
    try { return await call(key, fn, ...args); }
    catch (e) {
      if (e instanceof KeyError) { forgetKey(); setKey(''); setKeyError('That access key is not valid any more. Ask for the current team link.'); }
      throw e;
    }
  }, [key]);

  if (!key) return <Login error={keyError} onKey={k => { saveKey(k); setKeyError(''); setKey(k); }} />;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand"><Mark /><span>Creator Finder</span></div>
        <nav aria-label="Screens">
          {TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? 'tab on' : 'tab'} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
        <button className="link quiet" onClick={() => { forgetKey(); setKey(''); }}>Sign out</button>
      </header>
      <Boundary key={tab}>
        {tab === 'review' && <Review api={api} notify={notify} />}
        {tab === 'brands' && <Brands api={api} notify={notify} />}
        {tab === 'control' && <Control api={api} notify={notify} />}
      </Boundary>
      {toast && <div className={'toast ' + toast.tone} role="status">{toast.text}</div>}
    </div>
  );
}
