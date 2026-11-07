import { parseMoney } from './journalRules.js';
export const DEFAULT_RISK = { dailyLossLimit: 500, sessionStart: '07:30', sessionEnd: '12:00' };
export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function riskSettings(account = {}) { return { ...DEFAULT_RISK, ...account.risk }; }
export function validateRisk(risk) {
  if (!Number.isFinite(Number(risk.dailyLossLimit)) || Number(risk.dailyLossLimit) <= 0) throw new Error('Daily loss limit must be a positive number.');
  if (![risk.sessionStart,risk.sessionEnd].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) || risk.sessionStart >= risk.sessionEnd) throw new Error('Choose valid session hours with the start before the end.');
  return { ...risk, dailyLossLimit: Number(risk.dailyLossLimit) };
}
export function executed(trade) { return !['Missed','No Trade'].includes(trade.outcome) && trade.direction !== 'No Trade'; }
export function inSession(time, risk) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) return null;
  return time >= risk.sessionStart && time < risk.sessionEnd;
}
export function sessionNow(account, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  return inSession(parts, DEFAULT_RISK);
}
export function tradeSession(trade, account) {
  if (!executed(trade)) return null;
  // Recorded execution time is explicitly UK wall time, never journal creation time.
  return inSession(trade.entryTime, DEFAULT_RISK);
}
export function dailyRisk(trades, account, date = localDay()) {
  const risk = riskSettings(account);
  const rows = trades.filter(t => t.accountId === account.id && t.date === date && executed(t));
  const realised = rows.filter(t => t.realised !== false);
  const pnl = Math.round(realised.reduce((s,t) => s + parseMoney(t.pnl),0)*100)/100;
  const ordered = realised.filter(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t.exitTime || '')).slice().sort((a,b)=>a.exitTime.localeCompare(b.exitTime));
  const amountsKnown=realised.every(t=>String(t.pnl??'').replace(/[$,+\s]/g,'')!==''&&Number.isFinite(Number(String(t.pnl).replace(/[$,+\s]/g,''))));
  const chronologyKnown = realised.length > 0 && amountsKnown && ordered.length === realised.length && new Set(ordered.map(t=>t.exitTime)).size === ordered.length;
  let running=0, reached=false, continued=0, peakLoss=0;
  if (chronologyKnown) for (const t of ordered) { if (reached) continued++; running=Math.round((running+parseMoney(t.pnl))*100)/100; peakLoss=Math.max(peakLoss,-running); if(running<=-risk.dailyLossLimit) reached=true; }
  const outside = rows.filter(t => tradeSession(t,account) === false);
  const unknown = rows.filter(t => tradeSession(t,account) === null);
  const confirmedHit=reached || (amountsKnown&&pnl<=-risk.dailyLossLimit);
  return { date, pnl, amountsKnown, peakLoss:Math.max(peakLoss,-pnl,0), historyStatus: confirmedHit ? 'breached' : chronologyKnown ? 'within' : 'unknown', reached: confirmedHit, continued, chronologyKnown, count: rows.length, remaining: Math.max(0, risk.dailyLossLimit+pnl), outside, unknown, status: pnl <= -risk.dailyLossLimit ? 'breached' : pnl <= -risk.dailyLossLimit*0.8 ? 'approaching' : 'within', risk };
}
export function riskHistory(trades, account) {
  return [...new Set(trades.filter(t=>t.accountId===account.id).map(t=>t.date))].filter(Boolean).sort().map(date=>dailyRisk(trades,account,date));
}
