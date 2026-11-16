import React, { useCallback, useEffect, useState } from 'react';

export default function Control({ api, notify }) {
  const [c, setC] = useState(null);
  const [error, setError] = useState('');
  const [edits, setEdits] = useState({});
  const [seeds, setSeeds] = useState('');
  const [market, setMarket] = useState('');
  const [busy, setBusy] = useState('');
  const [armed, setArmed] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setC(await api('uiControl')); setEdits({}); } catch (e) { setError(e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const run = async (label, fn, done) => {
    setBusy(label);
    try { const r = await fn(); if (r && r.settings) setC(r); if (done) notify(done(r), 'good'); }
    catch (e) { notify(e.message, 'bad'); }
    finally { setBusy(''); }
  };

  if (error) return <main className="state"><p>{error}</p><button className="btn" onClick={load}>Try again</button></main>;
  if (!c) return <main className="state"><p className="loading">Loading the finder's status…</p></main>;

  const changed = Object.keys(edits).length > 0;
  const spend = c.spend && c.spend.used != null ? c.spend : null;

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Control</h1>
          <p className="muted">{c.status}</p>
        </div>
        <button className="btn" onClick={load} disabled={!!busy}>Refresh</button>
      </div>

      <div className="stats">
        <div><strong>{c.counts.waiting}</strong><span>waiting for review</span></div>
        <div><strong>{c.counts.candidates}</strong><span>candidates found so far</span></div>
        <div><strong>{c.counts.seedsWaiting}</strong><span>seeds still to check, of {c.counts.seeds}</span></div>
        <div><strong>{spend ? `$${Number(spend.used).toFixed(2)}` : 'n/a'}</strong><span>Apify spend this month{spend && spend.max ? `, limit $${spend.max}` : ''}</span></div>
      </div>

      <div className="grid-3">
        <section className="panel">
          <h2>Daily run</h2>
          <p>{c.switchOn ? 'The finder runs every day at 05:00 Beirut.' : 'The finder is off. No runs, no spend.'}</p>
          <p className="muted">{c.stage === 'idle' ? 'Not running now.' : `Running now: ${c.stage}.`}</p>
          <div className="actions">
            <button className={c.switchOn ? 'btn' : 'btn primary'} disabled={!!busy} onClick={() => run('switch', () => api('uiSwitch', !c.switchOn), r => (r.switchOn ? 'Daily run turned on' : 'Daily run turned off'))}>
              {c.switchOn ? 'Turn off' : 'Turn on'}
            </button>
            {!armed
              ? <button className="btn" disabled={!!busy || c.stage !== 'idle'} onClick={() => setArmed(true)}>Run now</button>
              : <button className="btn primary" disabled={!!busy} onClick={() => { setArmed(false); run('run', () => api('uiRunNow'), () => 'Run started. It takes about an hour; refresh to follow it.'); }}>Start a full run (uses Apify credit)</button>}
          </div>
        </section>

        <section className="panel">
          <h2>Add seed creators</h2>
          <p className="muted">Creators you already know. Each is checked once in the next run, and their related profiles and following start the search.</p>
          <textarea value={seeds} onChange={e => setSeeds(e.target.value)} placeholder={'@creator.one\nhttps://www.instagram.com/creator.two/'} aria-label="Seed creators" />
          <div className="actions">
            <select value={market} onChange={e => setMarket(e.target.value)} aria-label="Market"><option value="">Market: let the finder decide</option><option>LB</option><option>JO</option><option>SY</option></select>
            <button className="btn primary" disabled={!!busy || !seeds.trim()} onClick={() => run('seeds', async () => { const n = await api('uiAddSeeds', seeds, market); setSeeds(''); load(); return n; }, n => (n ? `${n} seed${n === 1 ? '' : 's'} added` : 'Those seeds are already in the list'))}>Add seeds</button>
          </div>
        </section>

        <section className="panel span-rows">
          <h2>Settings</h2>
          <p className="muted">Changes apply from the next run.</p>
          <div className="settings">
            {c.settings.map(([k, v]) => (
              <label key={k} className="setting">
                <span>{k}</span>
                <input value={edits[k] ?? v} onChange={e => setEdits(p => ({ ...p, [k]: e.target.value }))} />
              </label>
            ))}
          </div>
          <div className="actions">
            <button className="btn primary" disabled={!changed || !!busy} onClick={() => run('save', () => api('uiSaveSettings', Object.entries(edits)), () => 'Settings saved. They apply from the next run.')}>Save settings</button>
            {changed && <button className="link quiet" onClick={() => setEdits({})}>Undo changes</button>}
          </div>
        </section>
      </div>

      <section className="panel log">
        <h2>Last runs</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Posts read</th><th>Profiles checked</th><th>Sent to Gemini</th><th>Studied</th><th>New candidates</th><th>Notes</th></tr></thead>
            <tbody>
              {c.log.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td><strong>{r[5]}</strong></td><td className="muted small">{r[8]}</td></tr>)}
              {!c.log.length && <tr><td colSpan={7} className="empty-note">No runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
