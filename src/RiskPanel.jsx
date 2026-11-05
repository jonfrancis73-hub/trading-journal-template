import React, { useEffect, useState } from 'react';
import { dailyRisk, localDay, riskHistory, riskSettings, sessionNow, validateRisk } from './risk.js';
export default function RiskPanel({ store, accountId, onSave }) {
  const [now,setNow] = useState(new Date());
  useEffect(()=>{ const timer=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(timer); },[]);
  const account=store.accounts.find(a=>a.id===accountId);
  const [draft,setDraft]=useState(riskSettings(account));
  const [message,setMessage]=useState('');
  if(!account) return <section className="panel"><h2>Risk Management</h2><p>Select one funded account above to view its independent limits.</p></section>;
  const day=dailyRisk(store.trades,account,localDay(now));
  return <section className="panel risk-panel"><h2>Risk Management · {account.name}</h2><p>Manual journal only. Warnings cover recorded trades; this app cannot block broker orders or detect unrecorded trades.</p>
    <div role="status" className={`risk-status ${day.status}`}><strong>{day.status==='breached'?'DAILY LOSS LIMIT REACHED / BREACHED':day.status==='approaching'?'Approaching daily loss limit':'Within daily loss limit'}</strong><p>{day.status==='breached'?'Stop trading this account and review your rules.':`${sessionNow(account,now)?'Session open':'Session closed'} · ${day.risk.sessionStart}–${day.risk.sessionEnd} UK time`}</p></div>
    <div className="metrics-grid"><div className="metric-card"><span>Today’s net realised P&L</span><strong>${day.pnl.toFixed(2)}</strong></div><div className="metric-card"><span>Remaining loss allowance</span><strong>${day.remaining.toFixed(2)}</strong></div><div className="metric-card"><span>Recorded trades today</span><strong>{day.count}</strong></div><div className="metric-card"><span>Outside permitted hours</span><strong>{day.outside.length}</strong></div></div>
    <p>Current UK session: {sessionNow(account,now)?'open':'closed'} · {day.risk.sessionStart}–{day.risk.sessionEnd}.</p><p>Day: {day.date} · midnight reset in this computer’s local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). P&L is entered net of all commissions and fees; unrealised entries are excluded. Profits replenish the allowance.</p>
    <p>{day.unknown.length} trades have unknown execution times. UK session starts inclusive, ends exclusive; daylight saving follows Europe/London.</p>
    <form onSubmit={async e=>{e.preventDefault();try{const risk=validateRisk(draft);await onSave(store.accounts.map(a=>a.id===account.id?{...a,risk}:a));setMessage('Risk settings saved.');}catch(error){setMessage(error.message);}}}>
    <h3>Account risk settings</h3><div className="form-grid"><label>Maximum daily realised loss ($)<input type="number" min="0.01" step="0.01" value={draft.dailyLossLimit} onChange={e=>setDraft({...draft,dailyLossLimit:e.target.value})}/></label><label>Session start (UK)<input type="time" value={draft.sessionStart} onChange={e=>setDraft({...draft,sessionStart:e.target.value})}/></label><label>Session end (UK)<input type="time" value={draft.sessionEnd} onChange={e=>setDraft({...draft,sessionEnd:e.target.value})}/></label></div><button className="primary">Save Risk Settings</button><p role="status">{message}</p></form>
    <h3>Historical risk-rule review</h3><p>History is recalculated against the account’s current settings. Intraday checks use recorded exit times only when all realised trades that day have them; missing times leave chronology unknown. Equal exit times have ambiguous ordering.</p>
    {riskHistory(store.trades,account).reverse().map(d=><div className="risk-history" key={d.date}><strong>{d.date}</strong> · ${d.pnl.toFixed(2)} · {d.status} · {d.reached?'Limit reached during day':'No confirmed limit hit'} · {d.chronologyKnown?`${d.continued} recorded results after limit hit`:'Intraday order unknown'} · {d.outside.length} outside session · {d.unknown.length} unknown times</div>)}
  </section>;
}
