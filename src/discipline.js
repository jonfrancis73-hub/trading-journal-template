import { dailyRisk, executed } from './risk.js';
export const RULES = [
 ['deskBefore','Before','Am I trading from my desk rather than from bed?'],
 ['reviewed','Before','Have I reviewed my trading rules?'],
 ['prepared','Before','Am I emotionally prepared to trade?'],
 ['accountConfirmed','Before','Have I confirmed which funded account I am trading?'],
 ['sessionChecked','Before','Am I within my permitted trading session?'],
 ['lossChecked','Before','Is this account still within its daily loss limit?'],
 ['stopped','After','Did I stop trading after reaching this account’s daily realised-loss limit?'],
 ['sessionFollowed','After','Did I only execute trades within my permitted trading hours?'],
 ['deskAfter','After','Did I trade from my desk?'],
 ['journalled','After','Did I journal all my trades?'],
 ['planFollowed','After','Did I follow my trading plan?'],
];
export function checklistStats(record = {}) {
 const values=RULES.map(([id])=>record.answers?.[id]);
 const applicable=values.filter(v=>v==='yes'||v==='no');
 const yes=applicable.filter(v=>v==='yes').length;
 const answered=values.filter(v=>['yes','no','na'].includes(v)).length;
 return { yes, applicable:applicable.length, answered, complete:answered===RULES.length, percent:applicable.length?yes/applicable.length*100:null, compliant:answered===RULES.length&&applicable.length>0&&yes===applicable.length };
}
export function disciplineAnalytics(records, trades, account, through='9999-12-31') {
 const own=records.filter(r=>r.accountId===account.id&&r.date<=through);
 const dates=[...new Set([...own.map(r=>r.date),...trades.filter(t=>t.accountId===account.id&&executed(t)&&t.date<=through).map(t=>t.date)])].sort();
 const days=dates.map(date=>{const record=own.find(r=>r.date===date);return {date,record,...checklistStats(record),pnl:dailyRisk(trades,account,date).pnl};});
 const applicable=days.reduce((s,d)=>s+d.applicable,0),yes=days.reduce((s,d)=>s+d.yes,0);
 const rules=RULES.map(([id,,label])=>{const values=own.map(r=>r.answers?.[id]).filter(v=>v==='yes'||v==='no');const broken=values.filter(v=>v==='no').length;return {id,label,broken,answered:values.length,percent:values.length?(values.length-broken)/values.length*100:null};});
 let streak=0,best=0;for(const d of days){streak=d.compliant?streak+1:0;best=Math.max(best,streak);}
 const group=predicate=>{const rows=days.filter(predicate);return {days:rows.length,pnl:rows.reduce((s,d)=>s+d.pnl,0),average:rows.length?rows.reduce((s,d)=>s+d.pnl,0)/rows.length:null};};
 return {days,rules,percent:applicable?yes/applicable*100:null,fullyCompliant:days.filter(d=>d.compliant).length,incomplete:days.filter(d=>!d.complete).length,streak,best,compliant:group(d=>d.compliant),noncompliant:group(d=>d.complete&&d.applicable>0&&!d.compliant)};
}
