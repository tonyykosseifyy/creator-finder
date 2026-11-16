import React, { useCallback, useEffect, useState } from 'react';

// Settings grouped by what they control, each with a one-line explanation. Labels must match the Settings tab.
const GROUPS = [
  ['Budget, markets and schedule', [
    ['Monthly Apify budget (USD)', 'The finder never plans past this. Each run gets an even share of what is left this billing month.'],
    ['Markets to find', 'Creators clearly in other markets are left out. Creators whose location is unclear are kept for you to judge.'],
    ['Discovery days', 'Daily, or days such as Mon, Wed, Fri.'],
    ['Search TikTok', 'Yes or No. TikTok checks cost about 10 times an Instagram check.'],
  ]],
  ['How many accounts get checked', [
    ['Max profiles checked per run', 'The budget may lower this on a given day.'],
    ['Share of profile checks for Instagram', 'TikTok gets the rest.'],
    ['Max share found through competitors', 'Limits accounts found only on competitor posts.'],
  ]],
  ['Searches', [
    ['Keyword searches per run', 'Keywords take turns, oldest-run first.'],
    ['Max new posts scraped per run', 'Shared across the keyword searches.'],
    ['Search posts from the last (days)', 'Tagged-post and location searches only. Hashtags have no date filter.'],
    ['New hashtags added per run', 'Hashtags that kept creators share are added to Keywords.'],
    ['Pause a keyword after runs with no creators', 'Keywords that keep finding nobody switch off.'],
  ]],
  ['Creator network', [
    ['Creators whose network is explored per run', 'Seeds and creators you approved, oldest first.'],
    ['Related profiles per creator', "Instagram's own suggestions. The best source so far."],
    ['Following accounts per creator', 'Cheaper, but more friends and celebrities.'],
  ]],
  ['Brands', [
    ['Brand checks per run', 'New brands Gemini classifies.'],
    ['Brand scans per run', 'Local brands whose posts are read for the creators they work with.'],
    ['Brand scan: posts per brand', ''],
    ['Brand scan: posts from the last (days)', ''],
    ['Rescan a brand after (days)', ''],
  ]],
  ['Filters', [
    ['Minimum followers on Instagram', ''],
    ['Minimum followers on TikTok', ''],
    ['Small tier: max followers', 'Below this, a creator shows as under 10k.'],
    ['Minimum posts with hair visible', 'Fewer and the hair labels say not clear.'],
    ['Minimum label confidence', 'Below this, the hair labels say not clear.'],
    ['Counts as recently active within (days)', 'Only marks creators as not active lately. Nobody is dropped for it.'],
  ]],
  ['Gemini study', [
    ['Videos Gemini watches per creator', 'More videos mean better judgement and slower runs.'],
    ['Longest video Gemini watches (seconds)', ''],
  ]],
];

const MARKETS = [['LB', 'Lebanon'], ['JO', 'Jordan'], ['SY', 'Syria']];
function MarketPicker({ value, onChange }) {
  const v = String(value || '').toUpperCase();
  const on = MARKETS.filter(([c, n]) => v.includes(c) || v.includes(n.toUpperCase())).map(([c]) => c);
  const chosen = on.length ? on : MARKETS.map(([c]) => c);
  const toggle = c => {
    const next = chosen.includes(c) ? chosen.filter(x => x !== c) : [...chosen, c];
    if (next.length) onChange(MARKETS.map(([m]) => m).filter(m => next.includes(m)).join(', '));
  };
  return (
    <span className="markets" role="group" aria-label="Markets to find">
      {MARKETS.map(([c, n]) => (
        <label key={c} className={chosen.includes(c) ? 'mk on' : 'mk'}>
          <input type="checkbox" checked={chosen.includes(c)} onChange={() => toggle(c)} disabled={chosen.length === 1 && chosen.includes(c)} />{n}
        </label>
      ))}
    </span>
  );
}

export default function Control({ api, notify, data: c, setData: setC, run: liveRun, onRun, onRunError }) {
  const [error, setError] = useState('');
  const [edits, setEdits] = useState({});
  const [seeds, setSeeds] = useState('');
  const [market, setMarket] = useState('');
  const [busy, setBusy] = useState('');
  const [armed, setArmed] = useState(false);

  const load = useCallback(async () => {
    setError(''); setBusy('load');
    try { setC(await api('uiControl')); setEdits({}); } catch (e) { setError(e.message); } finally { setBusy(''); }
  }, [api, setC]);
  useEffect(() => { if (!c) load(); }, [c, load]); // reloads after a run finishes too

  const run = async (label, fn, done) => {
    setBusy(label);
    try { const r = await fn(); if (r && r.settings) setC(r); if (r && r.run && onRun) onRun(r.run); if (done) { const m = [].concat(done(r)); notify(m[0], m[1] || 'good'); } return r; }
    catch (e) { notify(e.message, 'bad'); if (label === 'run' && onRunError) onRunError(); }
    finally { setBusy(''); }
  };

  if (error && !c) return <main id="main" className="state"><p>{error}</p><button className="btn" onClick={load}>Try again</button></main>;
  if (!c) return <main id="main" className="state" aria-busy="true"><p className="loading">Loading the finder's status…</p></main>;

  const stage = (liveRun && liveRun.stage) || c.stage || 'idle';
  const values = Object.fromEntries(c.settings);
  const known = new Set(GROUPS.flatMap(([, rows]) => rows.map(([k]) => k)));
  const others = c.settings.filter(([k]) => !known.has(k)).map(([k]) => [k, '']);
  const groups = others.length ? [...GROUPS, ['Other', others]] : GROUPS;
  const changed = Object.keys(edits).length > 0;
  const spend = c.spend && c.spend.used != null ? Number(c.spend.used) : null;
  const budget = Number(String(values['Monthly Apify budget (USD)'] || '').replace(/[^\d.]/g, '')) || null;
  const share = spend != null && budget ? Math.min(1, spend / budget) : null;

  return (
    <main id="main" className="page control">
      <div className="page-head">
        <div>
          <h1>Control</h1>
          <p className="muted">Last activity: {c.status || 'none yet'}</p>
        </div>
        <button className="btn" onClick={load} disabled={!!busy}>{busy === 'load' ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <div className="stats">
        <div><strong>{c.counts.waiting}</strong><span>waiting for review</span></div>
        <div><strong>{c.counts.candidates}</strong><span>candidates found so far</span></div>
        <div><strong>{c.counts.seedsWaiting}</strong><span>{c.counts.seeds ? `seeds still to check, of ${c.counts.seeds}` : 'seeds still to check'}</span></div>
        <div className="spend">
          <strong>{spend != null ? `$${spend.toFixed(2)}` : 'n/a'}</strong>
          <span>Apify spend this month{budget ? ` of the $${budget} budget` : ''}</span>
          {share != null && <span className="bar" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={spend} aria-label="Budget used"><i style={{ width: `${Math.max(2, share * 100)}%` }} className={share > 0.85 ? 'hot' : ''} /></span>}
        </div>
      </div>

      <div className="control-grid">
        <div className="control-side">
          <section className="panel">
            <h2>Daily run</h2>
            <p>{c.switchOn ? 'The finder runs every day at 05:00 Beirut.' : 'The finder is off: no runs and no spend.'}</p>
            <p className="muted">{stage === 'idle' ? 'Not running now.' : 'Running now: see the bar at the top for the step and how long it has been going.'}</p>
            <div className="actions">
              <button className={c.switchOn ? 'btn' : 'btn primary'} disabled={!!busy} onClick={() => run('switch', () => api('uiSwitch', !c.switchOn), r => (r.switchOn ? 'Daily run turned on' : 'Daily run turned off'))}>
                {c.switchOn ? 'Turn off' : 'Turn on'}
              </button>
              {!armed
                ? <button className="btn" disabled={!!busy || stage !== 'idle'} onClick={() => setArmed(true)}>Run now</button>
                : <>
                    <button className="btn primary" disabled={!!busy} onClick={() => { setArmed(false); if (onRun) onRun({ stage: 'starting', runStarted: Date.now(), now: Date.now() }); run('run', () => api('uiRunNow'), r => (r.run && r.run.stage !== 'idle' ? ['Run started. The bar at the top shows its progress.', 'good'] : [`The run did not start: ${String((r.run && r.run.status) || r.status || '').replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}: /, '')}`, 'bad'])); }}>Start a full run</button>
                    <button className="link quiet" onClick={() => setArmed(false)}>Cancel</button>
                  </>}
            </div>
            {armed && <p className="muted small">A run uses part of this month's Apify budget, like the 05:00 run.</p>}
          </section>

          <section className="panel">
            <h2>Add seed creators</h2>
            <p className="muted">Creators you already like. Each is checked once in the next run, and the accounts related to them become the next candidates.</p>
            <label className="sr-only" htmlFor="seeds">Seed creators</label>
            <textarea id="seeds" value={seeds} onChange={e => setSeeds(e.target.value)} placeholder={'@creator.one\nhttps://www.instagram.com/creator.two/\nhttps://www.tiktok.com/@creator.three'} />
            <div className="actions">
              <select value={market} onChange={e => setMarket(e.target.value)} aria-label="Market of these seeds"><option value="">Market: let the finder decide</option><option value="LB">Lebanon</option><option value="JO">Jordan</option><option value="SY">Syria</option></select>
              <button className="btn primary" disabled={!!busy || !seeds.trim()} onClick={async () => {
                const n = await run('seeds', () => api('uiAddSeeds', seeds, market), n2 => (n2 ? `${n2} seed${n2 === 1 ? '' : 's'} added` : 'Those seeds are already in the list'));
                if (n != null) { setSeeds(''); load(); }
              }}>Add seeds</button>
            </div>
          </section>
        </div>

        <section className="panel settings-panel">
          <h2>Settings</h2>
          <p className="muted">Changes apply from the next run.</p>
          {groups.map(([title, rows], gi) => (
            <details key={title} className="group" open={gi < 2}>
              <summary>{title}</summary>
              {rows.filter(([k]) => k in values).map(([k, help]) => (
                <label key={k} className="setting">
                  <span className="setting-text"><span>{k}</span>{help && <small>{help}</small>}</span>
                  {k === 'Markets to find'
                    ? <MarketPicker value={edits[k] ?? values[k]} onChange={v => setEdits(p => ({ ...p, [k]: v }))} />
                    : k === 'Search TikTok'
                    ? <select value={edits[k] ?? values[k]} onChange={e => setEdits(p => ({ ...p, [k]: e.target.value }))}><option>Yes</option><option>No</option></select>
                    : <input value={edits[k] ?? values[k]} onChange={e => setEdits(p => ({ ...p, [k]: e.target.value }))} inputMode={k === 'Discovery days' ? 'text' : 'decimal'} />}
                </label>
              ))}
            </details>
          ))}
        </section>
      </div>

      <section className="panel log">
        <h2>Last runs</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Posts read</th><th>Profiles checked</th><th>Sent to Gemini</th><th>Studied</th><th>New candidates</th><th>Apify estimate</th><th>Notes</th></tr></thead>
            <tbody>
              {c.log.map((r, i) => <tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td><strong>{r[5]}</strong></td><td className="small">{String(r[6] || '').replace(/ \(.*$/, '') || '–'}</td><td className="muted small notes">{r[8]}</td></tr>)}
              {!c.log.length && <tr><td colSpan={8} className="empty-note">No runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {changed && (
        <div className="savebar" role="region" aria-label="Unsaved settings">
          <span>{Object.keys(edits).length} setting{Object.keys(edits).length === 1 ? '' : 's'} changed</span>
          <button className="link quiet" onClick={() => setEdits({})}>Undo changes</button>
          <button className="btn primary" disabled={!!busy} onClick={() => run('save', () => api('uiSaveSettings', Object.entries(edits)), () => 'Settings saved. They apply from the next run.').then(r => { if (r) setEdits({}); })}>Save settings</button>
        </div>
      )}
    </main>
  );
}
