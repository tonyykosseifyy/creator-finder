import React, { useEffect, useState } from 'react';

const STEPS = {
  scraping: ['1', 'Searching hashtags, places, tagged posts and related profiles'],
  profiles: ['2', 'Checking the profiles it found'],
  labelling: ['3', 'Gemini is studying the creators who passed'],
};

export const fmtDuration = ms => {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(sec).padStart(2, '0')} s`;
};
const clock = t => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Beirut' });

// Shown under the menu on every page while a run is going. The time counts up every second;
// the step and progress line refresh from the server every 30 seconds.
export default function RunBar({ run, skew }) {
  const [now, setNow] = useState(Date.now());
  const running = run && run.stage && run.stage !== 'idle';
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  if (!running) return null;
  const step = STEPS[run.stage] || ['', run.stage];
  const started = run.runStarted;
  return (
    <div className="runbar" role="status" aria-live="off">
      <span className="pulse" aria-hidden="true" />
      <div className="runbar-text">
        <strong>The finder is running</strong>
        <span>{step[0] ? `Step ${step[0]} of 3: ` : ''}{step[1]}</span>
        {run.status && <span className="runbar-status" dir="auto">{run.status.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}: /, '')}</span>}
      </div>
      {started && (
        <div className="runbar-time">
          <strong aria-label="Running for">{fmtDuration(now + skew - started)}</strong>
          <span>started {clock(started)}, usually 20 to 40 min</span>
        </div>
      )}
    </div>
  );
}
