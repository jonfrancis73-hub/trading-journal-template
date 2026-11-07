import React, { useEffect, useState } from 'react';
import { dailyRisk, localDay, riskHistory, riskSettings, validateRisk } from './risk.js';
export default function RiskPanel({ store, accountId, onSave }) {
  const [now,setNow] = useState(new Date());
  useEffect(()=>{ const timer=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(timer); },[]);
  const account=store.accounts.find(a=>a.id===accountId);
  const [draft,setDraft]=useState(riskSettings(account));
  const [message,setMessage]=useState('');
  if(!account) return <section className="panel"><h2>Risk Management</h2><p>Select one funded account above to view its independent limits.</p></section>;
  const day=dailyRisk(store.trades,account,localDay(now));
  return <section className="panel risk-panel"><h2>Risk Management · {account.name}</h2><p>Manual journal only. Warnings cover recorded trades; this app cannot block broker orders or detect unrecorded trades.</p>
    <div role="status" className={`risk-status ${day.reached?'breached':day.status}`}><strong>{!day.amountsKnown?'Unknown risk status':day.reached?'DAILY LOSS LIMIT REACHED / BREACHED':day.status==='approaching'?'Approaching daily loss limit':'Within daily loss limit'}</strong>{day.reached&&<p>Stop trading this account and review your rules.</p>}</div>
    <div className="metrics-grid"><div className="metric-card"><span>Today’s net realised P&L</span><strong>${day.pnl.toFixed(2)}</strong></div><div className="metric-card"><span>Remaining loss allowance</span><strong>${day.remaining.toFixed(2)}</strong></div><div className="metric-card"><span>Recorded trades today</span><strong>{day.count}</strong></div><div className="metric-card"><span>Outside permitted hours</span><strong>{day.outside.length}</strong></div></div>
    <form onSubmit={async e=>{e.preventDefault();try{const risk=validateRisk(draft);await onSave(store.accounts.map(a=>a.id===account.id?{...a,risk}:a));setMessage('Risk settings saved.');}catch(error){setMessage(error.message);}}}>
    <h3>Account risk settings</h3><div className="form-grid"><label>Maximum daily realised loss ($)<input type="number" min="0.01" step="0.01" value={draft.dailyLossLimit} onChange={e=>setDraft({...draft,dailyLossLimit:e.target.value})}/></label></div><button className="primary">Save Risk Settings</button><p role="status">{message}</p></form>
    <h3>Historical risk-rule review</h3>{riskHistory(store.trades,account).reverse().map(d=><div className={`risk-history ${d.historyStatus}`} key={d.date}><div className="risk-row"><strong>{d.date}</strong><span>${d.pnl.toFixed(2)}</span><strong>{d.historyStatus==='unknown'?'Unknown':d.historyStatus==='breached'?'Limit reached / breached':'Within risk limit'}</strong></div><div className="stacked-bar"><span className={d.historyStatus==='unknown'?'na':d.historyStatus==='breached'?'no':'yes'} style={{width:`${d.historyStatus==='unknown'?100:Math.min(100,d.peakLoss/d.risk.dailyLossLimit*100)}%`}}/></div><small>{d.historyStatus==='unknown'?'Incomplete chronology':`${d.chronologyKnown?'':'At least '}${(d.peakLoss/d.risk.dailyLossLimit*100).toFixed(0)}% maximum loss allowance used`}</small></div>)}
  </section>;
}
