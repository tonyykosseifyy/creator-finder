import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// One entry per tab: what it is for, the columns shown first, and choices for columns with fixed values.
const TABS = [
  ['creators', 'Creators', 'Creators you shortlisted: your outreach list. Status, messages, dates and notes are yours to edit, and you can delete anyone you no longer want on the list.',
    ['List date', 'Platform', 'Handle', 'Name', 'Followers', 'Market', 'Hair type', 'Score', 'Matched briefs', 'Contact', 'Status', 'Contacted on', 'Notes']],
  ['candidates', 'Candidates', 'Everyone the finder found and Gemini studied. You review them on the Instagram and TikTok pages.',
    ['Found on', 'Platform', 'Handle', 'Name', 'Followers', 'Market guess', 'Hair type', 'UGC fit (1-5)', 'Persona', 'Source', 'Review', 'Reviewed on']],
  ['keywords', 'Keywords', 'The hashtags, search terms, accounts and places the finder searches. Last run, Times run and Creators kept are filled by the finder.', null],
  ['seeds', 'Seeds', 'Creators you already like. Each is checked once; Last checked and Result are filled by the finder.', null],
  ['network', 'Network', 'Creators whose related profiles and following were explored. Delete a row to explore that creator again.', null],
  ['backlog', 'Backlog', 'Accounts the searches found but a run had no budget left to check. The next runs check them first, which costs far less than searching again. They leave after 30 days. Delete one to skip it.', null],
  ['runlog', 'Run log', 'One row per run: how many accounts were checked, studied and kept.', null],
];
const SHEET_NAME = { creators: 'Creators', candidates: 'Candidates', keywords: 'Keywords', seeds: 'Seeds', network: 'Network', backlog: 'Backlog', runlog: 'Run log' };
const CHOICES = {
  'Creators:Status': ['New', 'Contacted', 'Replied', 'Negotiating', 'Test video', 'Rostered', 'Declined', 'Not a fit'],
  'Keywords:Type': ['Hashtag', 'Search term', 'Location', 'Own account: tagged and mentions', 'Competitor: tagged posts'],
  'Keywords:Platform': ['Instagram', 'TikTok', 'Both'],
  'Keywords:Market': ['All', 'LB', 'JO', 'SY'],
  'Keywords:Source': ['3. Market search', '1. Customers', '2. Competitors'],
  'Seeds:Platform': ['', 'Instagram', 'TikTok'],
  'Seeds:Market': ['', 'LB', 'JO', 'SY'],
};
const LONG = /message|why picked|bio|persona|summary|notes|reason|evidence|example posts|found through|signals|errors/i;
const PAGE = 150;

function Links({ text }) {
  const parts = String(text).split(/\n+/).filter(Boolean);
  if (parts.every(p => /^https?:\/\//.test(p))) {
    return <span className="cell-links">{parts.map((u, i) => <a key={i} href={u} target="_blank" rel="noreferrer">{parts.length > 1 ? `Link ${i + 1}` : u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a>)}</span>;
  }
  return <span dir="auto">{text}</span>;
}

function Cell({ sheet, header, value, editable, onSave, href }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef();
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  const choices = CHOICES[`${sheet}:${header}`];
  const isActive = sheet === 'Keywords' && header === 'Active';
  const long = LONG.test(header);
  const multi = long && (sheet === 'Creators' || /message/i.test(header));  // long writing gets a text box

  if (isActive) {
    const on = /^true$/i.test(String(value));
    return <td className="c-check"><input type="checkbox" checked={on} onChange={() => onSave(on ? 'FALSE' : 'TRUE')} aria-label={`Active: ${on ? 'on' : 'off'}`} /></td>;
  }
  if (!editable && href && value) return <td><a href={href} target="_blank" rel="noreferrer">{value}</a></td>;
  if (!editable) return <td className={long ? 'c-long' : ''}><div className={long ? 'clamp' : ''} title={long ? String(value) : undefined}><Links text={value} /></div></td>;
  if (choices) {
    return (
      <td className="c-edit">
        <select value={value} onChange={e => onSave(e.target.value)} aria-label={header}>
          {(choices.includes(value) ? choices : [value, ...choices]).map(o => <option key={o} value={o}>{o || 'Not set'}</option>)}
        </select>
      </td>
    );
  }
  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };
  if (editing) {
    return (
      <td className="c-edit editing">
        {multi
          ? <><textarea ref={ref} dir="auto" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false); } if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(); }} aria-label={header} /><span className="hint">Click outside or press Ctrl+Enter to save, Esc to cancel</span></>
          : <input ref={ref} dir="auto" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }} aria-label={header} />}
      </td>
    );
  }
  return (
    <td className={'c-edit' + (long ? ' c-long' : '')}>
      <button className="cell-btn" onClick={() => setEditing(true)} aria-label={`Edit ${header}: ${value || 'empty'}`}>
        <span className={long ? 'clamp' : ''} dir="auto">{value || <span className="muted">Add</span>}</span>
      </button>
    </td>
  );
}

export default function Sheets({ api, notify, tab, cache, setCache }) {
  const meta = TABS.find(t => t[0] === tab) || TABS[0];
  const name = SHEET_NAME[meta[0]];
  const data = cache[name];
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [allCols, setAllCols] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [newRow, setNewRow] = useState({});
  const [confirmRow, setConfirmRow] = useState(null);

  const load = useCallback(async () => {
    setError(''); setLoading(true);
    try { const d = await api('uiSheet', name); setCache(c => ({ ...c, [name]: d })); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [api, name, setCache]);
  useEffect(() => { setQ(''); setLimit(PAGE); setNewRow({}); setConfirmRow(null); if (!cache[name]) load(); }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols = useMemo(() => {
    if (!data) return [];
    const all = data.header.map((h, i) => ({ h: h || `Column ${i + 1}`, i }));
    if (allCols || !meta[3]) return all;
    const pick = all.filter(c => meta[3].includes(c.h));
    return pick.length ? pick : all;
  }, [data, allCols, meta]);

  const rows = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    const L = s ? data.rows.filter(r => r.v.join(' ').toLowerCase().includes(s)) : data.rows;
    // newest first for logs and lists that grow at the bottom
    return ['Keywords', 'Seeds', 'Backlog'].includes(name) ? L : [...L].reverse();
  }, [data, q, name]);

  const profileCol = data ? data.header.indexOf('Profile link') : -1;
  const save = async (r, col, value) => {
    const before = r.v[col];
    setCache(c => ({ ...c, [name]: { ...c[name], rows: c[name].rows.map(x => (x.row === r.row ? { ...x, v: x.v.map((y, j) => (j === col ? value : y)) } : x)) } }));
    try {
      const out = await api('uiSetCell', name, r.row, col, value, r.v[data.key]);
      setCache(c => ({ ...c, [name]: { ...c[name], rows: c[name].rows.map(x => (x.row === out.row ? { ...x, v: out.v } : x)) } }));
      notify('Saved', 'good');
    } catch (e) {
      setCache(c => ({ ...c, [name]: { ...c[name], rows: c[name].rows.map(x => (x.row === r.row ? { ...x, v: x.v.map((y, j) => (j === col ? before : y)) } : x)) } }));
      notify(e.message, 'bad');
    }
  };
  const add = async () => {
    try {
      const vals = data.header.map((h, i) => newRow[i] ?? (CHOICES[`${name}:${h}`] || [''])[0]);
      const d = await api('uiAddRow', name, vals);
      setCache(c => ({ ...c, [name]: d })); setNewRow({});
      notify(`Added to ${name}`, 'good');
    } catch (e) { notify(e.message, 'bad'); }
  };
  const remove = async r => {
    setConfirmRow(null);
    try { const d = await api('uiDeleteRow', name, r.row, r.v[data.key]); setCache(c => ({ ...c, [name]: d })); notify(`Row deleted from ${name}`, 'good'); }
    catch (e) { notify(e.message, 'bad'); }
  };

  return (
    <main id="main" className="page sheets">
      <div className="page-head">
        <div>
          <h1>{meta[1]}</h1>
          <p className="muted">{meta[2]}</p>
        </div>
        {data && <a className="btn" href={data.url} target="_blank" rel="noreferrer">Open in Google Sheets<span className="sr-only"> (opens in a new tab)</span></a>}
      </div>


      <section className="panel sheet-panel">
        <div className="sheet-head">
          <p className="muted small table-count-top">{data ? (q ? `${rows.length} of ${data.rows.length} rows match` : `${data.rows.length} ${data.rows.length === 1 ? 'row' : 'rows'}`) + (['Keywords', 'Seeds'].includes(name) ? '' : name === 'Backlog' ? ', best first' : ', newest first') : ''}</p>
          <div className="actions">
            <input type="search" value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE); }} placeholder={`Search ${name}`} aria-label={`Search ${name}`} />
            {meta[3] && <label className="muted small"><input type="checkbox" checked={allCols} onChange={e => setAllCols(e.target.checked)} /> All columns</label>}
            <button className="btn" onClick={load} disabled={loading}>{loading ? (data ? 'Refreshing…' : 'Loading…') : 'Refresh'}</button>
          </div>
        </div>

        {error && !data && <div className="empty-note"><p>{error}</p><button className="btn" onClick={load}>Try again</button></div>}
        {!data && !error && <div className="sk-table" aria-busy="true">{[0, 1, 2, 3, 4, 5, 6].map(i => <div key={i} className="sk sk-line" />)}<span className="sr-only" role="status">Loading {name}</span></div>}

        {data && (
          <>
            {data.add && (
              <form className="add-row" onSubmit={e => { e.preventDefault(); add(); }}>
                {data.edit.filter(i => !(name === 'Keywords' && i === 5)).map(i => {
                  const h = data.header[i], choices = CHOICES[`${name}:${h}`];
                  return choices
                    ? <select key={i} value={newRow[i] ?? choices[0]} onChange={e => setNewRow(p => ({ ...p, [i]: e.target.value }))} aria-label={`New row: ${h}`}>{choices.map(o => <option key={o} value={o}>{o || (h === 'Platform' ? 'Platform: from link' : `${h}: not set`)}</option>)}</select>
                    : <input key={i} value={newRow[i] ?? ''} onChange={e => setNewRow(p => ({ ...p, [i]: e.target.value }))} placeholder={h} aria-label={`New row: ${h}`} className={i === 0 ? 'first' : ''} />;
                })}
                <button className="btn primary" type="submit" disabled={!String(newRow[0] || '').trim()}>Add {name === 'Keywords' ? 'keyword' : 'seed'}</button>
              </form>
            )}
            <div className="table-wrap sheet-table">
              <table>
                <thead><tr>{cols.map(c => <th key={c.i} scope="col">{c.h}{data.edit.includes(c.i) && <span className="edit-dot" title="You can edit this column" aria-label="editable"> ✎</span>}</th>)}{data.del && <th scope="col"><span className="sr-only">Delete</span></th>}</tr></thead>
                <tbody>
                  {rows.slice(0, limit).map(r => (
                    <tr key={r.row}>
                      {cols.map(c => <Cell key={c.i} sheet={name} header={c.h} value={r.v[c.i]} editable={data.edit.includes(c.i)} onSave={v => save(r, c.i, v)} href={c.h === 'Handle' && profileCol >= 0 ? r.v[profileCol] : undefined} />)}
                      {data.del && (
                        <td className="c-del">
                          {confirmRow === r.row
                            ? <span className="confirm"><button className="btn danger small-btn" onClick={() => remove(r)}>Delete</button><button className="link quiet" onClick={() => setConfirmRow(null)}>Keep</button></span>
                            : <button className="link quiet" onClick={() => setConfirmRow(r.row)} aria-label={`Delete row ${r.v[data.key]}`}>Delete</button>}
                        </td>
                      )}
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={cols.length + 1} className="empty-note">{q ? 'No rows match this search.' : `${name} is empty.`}</td></tr>}
                </tbody>
              </table>
            </div>
            {rows.length > limit && <button className="btn more" onClick={() => setLimit(l => l + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more</button>}
          </>
        )}
      </section>
    </main>
  );
}
