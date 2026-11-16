import React, { useCallback, useEffect, useMemo, useState } from 'react';

const STATUSES = ['New', 'Scan', 'Skip', 'Person'];
const num = s => Number(String(s || '').replace(/[,\s]/g, '')) || 0;

export default function Brands({ api, notify, rows, setRows }) {
  const [error, setError] = useState('');
  const [f, setF] = useState({ status: '', market: '', q: '' });
  const [paste, setPaste] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try { setRows(await api('uiBrands')); } catch (e) { setError(e.message); }
  }, [api, setRows]);
  useEffect(() => { if (!rows) load(); }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => (rows || [])
    .filter(b => (!f.status || b.status === f.status) && (!f.market || b.market === f.market) && (!f.q || b.handle.toLowerCase().includes(f.q.toLowerCase())))
    .sort((a, b) => num(b.mentions) - num(a.mentions)), [rows, f]);

  const setStatus = async (b, status) => {
    try {
      await api('uiSetBrand', b.row, b.handle, status);
      setRows(r => r.map(x => (x.row === b.row ? { ...x, status } : x)));
      notify(`@${b.handle} set to ${status}`, 'good');
    } catch (e) { notify(e.message, 'bad'); }
  };
  const add = async () => {
    setAdding(true);
    try {
      const n = await api('uiAddBrands', paste);
      setPaste('');
      notify(n ? `${n} brand${n === 1 ? '' : 's'} added. They are checked in the next run.` : 'Those brands are already in the list.', 'good');
      load();
    } catch (e) { notify(e.message, 'bad'); } finally { setAdding(false); }
  };

  if (error && !rows) return <main id="main" className="state"><p>{error}</p><button className="btn" onClick={load}>Try again</button></main>;
  if (!rows) return <main id="main" className="state" aria-busy="true"><p className="loading">Loading brands…</p></main>;

  return (
    <main id="main" className="page">
      <div className="page-head">
        <div>
          <h1>Brands</h1>
          <p className="muted">Brands creators work with. Local ones are scanned automatically once Gemini has checked them. Set Skip to stop a brand.</p>
        </div>
        <div className="filter-row">
          <button className="btn" onClick={load}>Refresh</button>
          <input type="search" value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="Search handle" aria-label="Search handle" />
          <select value={f.status} onChange={e => setF({ ...f, status: e.target.value })} aria-label="Status"><option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
          <select value={f.market} onChange={e => setF({ ...f, market: e.target.value })} aria-label="Market"><option value="">All markets</option><option>LB</option><option>JO</option><option>SY</option></select>
        </div>
      </div>
      <div className="two">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Brand</th><th>Type</th><th>Market</th><th>Mentioned by</th><th>Creators found</th><th>Last scanned</th><th>Status</th></tr></thead>
            <tbody>
              {list.slice(0, 500).map(b => (
                <tr key={b.row}>
                  <td><a href={`https://www.instagram.com/${b.handle}/`} target="_blank" rel="noreferrer">@{b.handle}</a><div className="muted small">{[b.category, b.followers && `${b.followers} followers`].filter(Boolean).join(', ')}</div></td>
                  <td>{b.type || <span className="muted">Not checked yet</span>}</td>
                  <td>{b.market}</td>
                  <td>{b.mentions}<div className="muted small">{String(b.by || '').split(', ').slice(0, 3).join(', ')}</div></td>
                  <td>{b.found || 0}</td>
                  <td>{b.lastScanned || <span className="muted">Not yet</span>}</td>
                  <td><select value={b.status || 'New'} onChange={e => setStatus(b, e.target.value)} aria-label={`Status of @${b.handle}`}>{STATUSES.map(s => <option key={s}>{s}</option>)}</select></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="empty-note">{rows.length ? 'No brands match these filters.' : 'No brands yet. They appear after the first run.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <aside className="panel">
          <h2>Add brands</h2>
          <p className="muted">Paste Instagram handles or links, one per line. Gemini checks them in the next run, and local brands are then scanned.</p>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} placeholder={'@brand.one\nhttps://www.instagram.com/brand.two/'} aria-label="Brands to add" />
          <button className="btn primary" onClick={add} disabled={adding || !paste.trim()}>{adding ? 'Adding…' : 'Add brands'}</button>
        </aside>
      </div>
    </main>
  );
}
