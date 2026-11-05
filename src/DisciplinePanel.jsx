import React,{useEffect,useState} from 'react';
import { RULES, checklistStats, disciplineAnalytics } from './discipline.js';
import { dailyRisk, localDay, sessionNow } from './risk.js';
const percent=n=>n===null?'No applicable answers':`${n.toFixed(1)}%`;
export default function DisciplinePanel({store,accountId,onSave,onReview}) {
 const [date,setDate]=useState(localDay());
 const account=store.accounts.find(a=>a.id===accountId);
 if(!account)return <section className="panel"><h2>Discipline</h2><p>Select one funded account above for its daily checklist and compliance history.</p></section>;
 return <DisciplineAccount key={`${accountId}:${date}`} {...{store,account,date,setDate,onSave,onReview}}/>;
}
function DisciplineAccount({store,account,date,setDate,onSave,onReview}) {
 const [now,setNow]=useState(new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),1000);return ()=>clearInterval(timer);},[]);
 const existing=(store.discipline||[]).find(r=>r.accountId===account.id&&r.date===date);
 const [record,setRecord]=useState(existing||{id:`discipline:${account.id}:${date}`,accountId:account.id,date,answers:{},notes:''});
 const [message,setMessage]=useState('');
 const stats=checklistStats(record),analytics=disciplineAnalytics(store.discipline||[],store.trades,account,localDay());
 const risk=dailyRisk(store.trades,account,date);
 return <section className="panel discipline-panel"><h2>Discipline · {account.name}</h2><p>Consistency first. Profit and loss never determine your compliance score.</p>
 <div className="metrics-grid"><div className="metric-card"><span>Overall rule compliance</span><strong>{percent(analytics.percent)}</strong></div><div className="metric-card"><span>Fully compliant days</span><strong>{analytics.fullyCompliant}</strong></div><div className="metric-card"><span>Current / best streak</span><strong>{analytics.streak} / {analytics.best}</strong></div><div className="metric-card"><span>Incomplete days</span><strong>{analytics.incomplete}</strong></div></div>
 <p>Only Yes and No answers enter percentages. N/A is excluded. All questions must be answered to complete a checklist; all-N/A days do not qualify as compliant. Streaks count consecutive recorded trading/checklist days; a missing checklist on a recorded trade day breaks the streak.</p>
 <label>Trading day<input aria-label="Discipline trading day" type="date" max={localDay()} value={date} onChange={e=>e.target.value&&setDate(e.target.value)}/></label>
 <div className={`risk-status ${risk.status}`}>Loss limit: {risk.status} · remaining ${risk.remaining.toFixed(2)} · {risk.outside.length} outside-hours trades. {date===localDay()?`Current UK session: ${sessionNow(account,now)?'open':'closed'}`:'Historical day; execution-session checks appear below.'}</div>
 <h3>Daily checklist</h3><p>{stats.complete?'Completed':'Incomplete'} · {stats.answered}/{RULES.length} answered · {percent(stats.percent)}</p><progress aria-label="Checklist completion" max={RULES.length} value={stats.answered}/>
 <form onSubmit={async e=>{e.preventDefault();try{await onSave(record);setMessage('Checklist and reflection saved.');}catch(error){setMessage(error.message);}}}>
 {['Before','After'].map(phase=><fieldset key={phase}><legend>{phase} trading</legend>{RULES.filter(r=>r[1]===phase).map(([id,,label])=><label className="checklist-row" key={id}><span>{label}</span><select aria-label={label} value={record.answers[id]||''} onChange={e=>{setMessage('Unsaved changes');setRecord({...record,answers:{...record.answers,[id]:e.target.value}});}}><option value="">Unanswered</option><option value="yes">Yes</option><option value="no">No</option><option value="na">Not Applicable</option></select></label>)}</fieldset>)}
 <label>Daily reflection<textarea aria-label="Daily reflection" value={record.notes} onChange={e=>{setMessage('Unsaved changes');setRecord({...record,notes:e.target.value});}}/></label><button className="primary">Save Daily Checklist</button><p role="status">{message}</p></form>
 <h3>Trades and results for {date}</h3><p>Net realised P&L: ${risk.pnl.toFixed(2)}. Compare this with your answers; recorded violations do not automatically change self-reported answers.</p>{store.trades.filter(t=>t.accountId===account.id&&t.date===date).map(t=><button className="secondary risk-history" key={t.id} onClick={()=>onReview(t)}>{t.asset} · {t.entryTime||'Unknown execution time'} UK · ${t.pnl} net</button>)}
 <h3>Compliance trends and history</h3>{analytics.days.slice().reverse().map(d=><button className="secondary risk-history" key={d.date} onClick={()=>setDate(d.date)}>{d.date} · {percent(d.percent)} · {d.complete?'Completed':'Incomplete'}<progress aria-label={`Compliance ${d.date}`} max="100" value={d.percent||0}/></button>)}
 <h3>Individual rules · most frequently broken first</h3>{analytics.rules.slice().sort((a,b)=>b.broken-a.broken).map(r=><div className="risk-history" key={r.id}>{r.label}<br/>{percent(r.percent)} · {r.broken} No / {r.answered} applicable answers</div>)}
 <h3>Performance comparison</h3><p>Completed, applicable checklists only; incomplete and all-N/A days are excluded. This comparison shows association, not causation.</p><div className="risk-history">Compliant: {analytics.compliant.days} days · total ${analytics.compliant.pnl.toFixed(2)} · average {analytics.compliant.average===null?'N/A':`$${analytics.compliant.average.toFixed(2)}`}</div><div className="risk-history">Non-compliant: {analytics.noncompliant.days} days · total ${analytics.noncompliant.pnl.toFixed(2)} · average {analytics.noncompliant.average===null?'N/A':`$${analytics.noncompliant.average.toFixed(2)}`}</div>
 </section>;
}
