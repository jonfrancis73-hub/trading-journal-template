import { calculateAdvancedStats } from './analytics.js';
// Original, equal-weight score. Saturate PF and payoff at 2; require 20 results
// and at least 3 wins and 3 losses to avoid unstable one-sided samples.
export function empraScore(trades) {
 const stats=calculateAdvancedStats(trades.filter(t=>t.realised!==false));
 const components=[stats.winRate,Math.min(2,stats.profitFactor)/2*100,Math.min(2,stats.payoffRatio)/2*100];
 const valid=stats.totalTrades>=20&&stats.wins>=3&&stats.losses>=3;
 return {stats,components,score:valid?Math.round(components.reduce((a,b)=>a+b,0)/3):null};
}
