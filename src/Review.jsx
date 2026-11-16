import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const REASONS = ['Wrong hair for our briefs', 'Wrong market', 'Content quality too low', 'Not a creator (brand, page, meme)', 'Worked with a competitor', 'Too small or too big', 'Not a fit for the brand', 'Other'];
const num = s => { const n = Number(String(s ?? '').replace(/[,\s%]/g, '')); return Number.isFinite(n) && String(s ?? '').trim() !== '' ? n : null; };
const compact = n => n == null ? '?' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(n);
const clean = v => (v && v !== 'Unclear' ? v : '');
const IG = 'https://www.instagram.com/';

export function embedUrl(u) {
  let m = String(u).match(/instagram\.com\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  if (m) return IG + 'p/' + m[1] + '/embed/';
  m = String(u).match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (m) return 'https://www.tiktok.com/embed/v2/' + m[1];
  return '';
}

function Meter({ value, label }) {
  const n = num(value);
  if (!n) return null;
  return (
    <div className="meter" aria-label={`${label} ${n} out of 5`}>
      <span className="meter-label">{label}</span>
      <span className="meter-bar" aria-hidden="true">{[1, 2, 3, 4, 5].map(i => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
      <span className="meter-num">{n}/5</span>
    </div>
  );
}

function Row({ c, active, onPick, small }) {
  const f = num(c.followers);
  const fit = num(c.ugcFit);
  return (
    <button className={'row' + (active ? ' active' : '')} onClick={onPick} aria-current={active ? 'true' : undefined}>
      <span className="row-main">
        <span className="row-name" dir="auto">{c.name || c.handle}</span>
        <span className="row-handle">@{c.handle}</span>
      </span>
      <span className="row-side">
        <span className="row-f">{compact(f)}</span>
        <span className="row-tags"><span className={'tier' + (small ? ' small' : '')}>{c.market || '?'}</span>{fit ? <span className="fit">fit {fit}</span> : null}</span>
      </span>
    </button>
  );
}

function Detail({ c, smallMax, today, activeDays, onDecide, api, notify }) {
  const [mode, setMode] = useState(null);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState('');
  const msgRef = useRef();

  useEffect(() => { setMode(null); setMessage(''); setReason(REASONS[0]); setDetails(''); setBusy(''); }, [c.row]);
  useEffect(() => {
    const onKey = e => {
      if (/input|textarea|select/i.test(e.target.tagName)) { if (e.key === 'Escape') { e.target.blur(); setMode(null); } return; }
      if (e.key === 's') { e.preventDefault(); setMode('short'); setTimeout(() => msgRef.current && msgRef.current.focus(), 0); }
      if (e.key === 'x') { e.preventDefault(); setMode('nofit'); }
      if (e.key === 'Escape') setMode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const f = num(c.followers);
  const posts = String(c.examplePosts || '').split('\n').filter(Boolean);
  const watched = num(c.videosWatched) || 0;
  const embeds = posts.map(embedUrl).filter(Boolean).slice(0, 3);
  const links = String(c.links || '').split('\n').filter(Boolean);
  const hair = [clean(c.hairType), c.hairSubtype, clean(c.length), clean(c.thickness), c.colour === 'Yes' ? 'colour-treated' : ''].filter(Boolean);
  const old = c.lastPost && today && (Date.parse(today) - Date.parse(c.lastPost)) / 864e5 > (activeDays || 30);
  const through = String(c.foundThrough || '').split('\n')[0].replace(/: https?:\S+/, '');
  const tags = [...String(c.niches || '').split(', '), ...String(c.formats || '').split(', ')].filter(Boolean);

  const draft = async () => {
    setBusy('draft');
    try { setMessage(await api('uiDraftDm', c.row, c.handle)); } catch (e) { notify(e.message, 'bad'); } finally { setBusy(''); }
  };
  const decide = async kind => {
    setBusy(kind);
    try {
      if (kind === 'shortlist') await api('uiDecide', c.row, c.handle, 'shortlist', '', message);
      else await api('uiDecide', c.row, c.handle, 'reject', details.trim() ? `${reason}: ${details.trim()}` : reason, '');
      onDecide(c.row, kind === 'shortlist' ? `@${c.handle} added to Creators` : `@${c.handle} marked not a fit`);
    } catch (e) { notify(e.message, 'bad'); setBusy(''); }
  };

  return (
    <article className="detail" aria-label={`Creator @${c.handle}`}>
      <div className="detail-scroll">
        <header className="who">
          <div>
            <h2 dir="auto">{c.name || c.handle}</h2>
            <a className="handle" href={c.profileUrl} target="_blank" rel="noreferrer">@{c.handle} on {c.platform}</a>
          </div>
          <div className="count">
            <strong>{f == null ? '?' : f.toLocaleString()}</strong>
            <span>followers, {f != null && f < (smallMax || 10000) ? 'under 10k' : '10k and over'}, {c.market || 'market unclear'}</span>
          </div>
        </header>
        {c.summary && <p className="summary" dir="auto">{c.summary}</p>}

        <section className="posts" aria-label="Their posts">
          {embeds.length
            ? embeds.map(u => <iframe key={u} src={u} title="Instagram post" loading="lazy" allowFullScreen />)
            : <p className="empty-note">No post links were saved for this creator.</p>}
        </section>
        {posts.length > 0 && (
          <p className="post-links">
            {posts.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer">Post {i + 1}{i < watched ? ' (watched by Gemini)' : ''}</a>)}
          </p>
        )}

        {(c.competitor || c.brandSafety) && (
          <div className="warnings">
            {c.competitor && <p className="warn bad">Competitor link: {c.competitor}</p>}
            {c.brandSafety && <p className="warn">Brand safety: {c.brandSafety}</p>}
          </div>
        )}

        <div className="study">
          <section>
            <h3>Hair</h3>
            <p className="big-line">{hair.length ? hair.join(', ') : 'Not clear from their posts'}</p>
            {c.naturalVsWorn && <p className="muted" dir="auto">{c.naturalVsWorn}</p>}
            {c.heatTools === 'Yes' && <p className="good-note">Uses heat tools on camera</p>}
          </section>
          <section>
            <h3>On camera</h3>
            <p className="big-line">{c.speaks === 'Yes' ? 'Talks to camera' : c.speaks === 'No' ? 'Does not talk to camera' : 'Talking not clear'}{clean(c.language) ? `, ${c.language}` : ''}</p>
            <Meter value={c.delivery} label="Delivery" />
            <Meter value={c.ugcFit} label="UGC fit" />
            <Meter value={c.production} label="Production" />
          </section>
          {(c.persona || c.ugcReason) && (
            <section className="wide">
              <h3>Why they could work</h3>
              {c.persona && <p dir="auto"><b>Persona:</b> {c.persona}</p>}
              {c.ugcReason && <p dir="auto">{c.ugcReason}</p>}
            </section>
          )}
          {tags.length > 0 && <section className="wide"><h3>Content</h3><p className="tags">{tags.map(t => <span key={t}>{t}</span>)}</p></section>}
          <section>
            <h3>How we found them</h3>
            <p>{String(c.source || '').replace(/\b\d+\.\s*/g, '')}{through ? `, ${through}` : ''}</p>
          </section>
          <section>
            <h3>Contact</h3>
            <p>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : 'Instagram DM only'}</p>
            <p className="muted">Last post {c.lastPost || 'unknown'}{old ? ', not active lately' : ''}. {watched} video{watched === 1 ? '' : 's'} studied.</p>
          </section>
          {links.length > 0 && (
            <section className="wide">
              <h3>Also on</h3>
              <p className="also">{links.map(u => <a key={u} href={u} target="_blank" rel="noreferrer">{u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 44)}</a>)}</p>
            </section>
          )}
        </div>
      </div>

      <footer className="decide">
        {mode === 'short' && (
          <div className="decide-form">
            <label htmlFor="dm">First message, saved with them in Creators (optional)</label>
            <textarea id="dm" ref={msgRef} dir="auto" value={message} onChange={e => setMessage(e.target.value)} placeholder="Write the DM, or let Gemini draft it in their dialect" />
            <div className="decide-actions">
              <button className="btn" onClick={draft} disabled={!!busy}>{busy === 'draft' ? 'Drafting…' : message ? 'Draft again' : 'Draft with Gemini'}</button>
              <button className="btn primary" onClick={() => decide('shortlist')} disabled={!!busy}>{busy === 'shortlist' ? 'Adding…' : 'Add to Creators'}</button>
            </div>
          </div>
        )}
        {mode === 'nofit' && (
          <div className="decide-form">
            <label htmlFor="reason">Why not</label>
            <div className="decide-actions">
              <select id="reason" value={reason} onChange={e => setReason(e.target.value)}>{REASONS.map(r => <option key={r}>{r}</option>)}</select>
              <input value={details} onChange={e => setDetails(e.target.value)} placeholder="Details (optional)" aria-label="Details" />
              <button className="btn danger" onClick={() => decide('reject')} disabled={!!busy}>{busy === 'reject' ? 'Saving…' : 'Mark not a fit'}</button>
            </div>
          </div>
        )}
        {!mode && (
          <div className="decide-actions">
            <button className="btn primary" onClick={() => { setMode('short'); setTimeout(() => msgRef.current && msgRef.current.focus(), 0); }}>Shortlist <kbd>S</kbd></button>
            <button className="btn danger" onClick={() => setMode('nofit')}>Not a fit <kbd>X</kbd></button>
            <span className="hint">Next and previous: <kbd>J</kbd> <kbd>K</kbd></span>
          </div>
        )}
        {mode && <button className="link quiet close" onClick={() => setMode(null)}>Cancel</button>}
      </footer>
    </article>
  );
}

export default function Review({ api, notify }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);
  const [f, setF] = useState({ market: '', tier: '', hair: '', fit: 0, noComp: false, speaks: false, q: '', sort: 'fit' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    setError('');
    try { const r = await api('uiQueue'); setData(r); } catch (e) { setError(e.message); }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  const smallMax = (data && data.smallMax) || 10000;
  const list = useMemo(() => {
    if (!data) return [];
    const q = f.q.trim().toLowerCase();
    const L = data.items.filter(c => (!f.market || c.market === f.market) && (!f.hair || c.hairType === f.hair) && (num(c.ugcFit) || 0) >= f.fit
      && (!f.noComp || !c.competitor) && (!f.speaks || c.speaks === 'Yes')
      && (!f.tier || (f.tier === 'small') === ((num(c.followers) || 0) < smallMax))
      && (!q || [c.name, c.handle, c.bio, c.persona, c.summary, c.niches].join(' ').toLowerCase().includes(q)));
    return L.sort((a, b) => f.sort === 'new' ? String(b.foundOn).localeCompare(String(a.foundOn))
      : f.sort === 'followers' ? (num(b.followers) || 0) - (num(a.followers) || 0)
      : (num(b.ugcFit) || 0) - (num(a.ugcFit) || 0) || (num(b.delivery) || 0) - (num(a.delivery) || 0));
  }, [data, f, smallMax]);

  const current = list.find(c => c.row === sel) || list[0] || null;
  useEffect(() => { if (current && current.row !== sel) setSel(current.row); }, [current, sel]);

  useEffect(() => {
    const onKey = e => {
      if (/input|textarea|select/i.test(e.target.tagName) || !current) return;
      const i = list.findIndex(c => c.row === current.row);
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); if (list[i + 1]) setSel(list[i + 1].row); }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); if (list[i - 1]) setSel(list[i - 1].row); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, current]);

  const onDecide = (row, text) => {
    const i = list.findIndex(c => c.row === row);
    const next = list[i + 1] || list[i - 1];
    setData(d => ({ ...d, items: d.items.filter(c => c.row !== row), reviewed: (d.reviewed || 0) + 1 }));
    setSel(next ? next.row : null);
    notify(text, 'good');
  };

  if (error) return <main className="state"><p>{error}</p><button className="btn" onClick={load}>Try again</button></main>;
  if (!data) return <main className="state"><p className="loading">Loading the creators waiting for review…</p></main>;

  return (
    <main className="review">
      <aside className="queue" aria-label="Creators waiting">
        <div className="filters">
          <input type="search" value={f.q} onChange={e => set('q', e.target.value)} placeholder="Search name, bio, persona" aria-label="Search" />
          <div className="filter-grid">
            <select value={f.market} onChange={e => set('market', e.target.value)} aria-label="Market"><option value="">All markets</option><option>LB</option><option>JO</option><option>SY</option></select>
            <select value={f.tier} onChange={e => set('tier', e.target.value)} aria-label="Size"><option value="">All sizes</option><option value="small">Under 10k</option><option value="big">10k and over</option></select>
            <select value={f.hair} onChange={e => set('hair', e.target.value)} aria-label="Hair"><option value="">Any hair</option><option>Straight</option><option>Wavy</option><option>Curly</option><option>Coily</option></select>
            <select value={f.fit} onChange={e => set('fit', Number(e.target.value))} aria-label="UGC fit"><option value={0}>Any UGC fit</option><option value={3}>UGC fit 3+</option><option value={4}>UGC fit 4+</option></select>
          </div>
          <div className="checks">
            <label><input type="checkbox" checked={f.speaks} onChange={e => set('speaks', e.target.checked)} /> Talks to camera</label>
            <label><input type="checkbox" checked={f.noComp} onChange={e => set('noComp', e.target.checked)} /> Hide competitor-linked</label>
          </div>
          <div className="queue-head">
            <span>{list.length} of {data.items.length} waiting, {data.reviewed || 0} reviewed</span>
            <select value={f.sort} onChange={e => set('sort', e.target.value)} aria-label="Sort"><option value="fit">Best UGC fit</option><option value="new">Newest</option><option value="followers">Most followers</option></select>
          </div>
        </div>
        <div className="rows">
          {list.map(c => <Row key={c.row} c={c} small={(num(c.followers) || 0) < smallMax} active={current && c.row === current.row} onPick={() => setSel(c.row)} />)}
          {!list.length && <p className="empty-note">{data.items.length ? 'Nobody matches these filters.' : 'Everyone has been reviewed. New creators arrive after the 05:00 run.'}</p>}
        </div>
      </aside>
      {current
        ? <Detail key={current.row} c={current} smallMax={smallMax} today={data.today} activeDays={data.activeDays} onDecide={onDecide} api={api} notify={notify} />
        : <section className="detail empty"><p>Pick a creator on the left.</p></section>}
    </main>
  );
}
