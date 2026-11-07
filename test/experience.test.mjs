import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareAccountExecutions,prepareLocalTrade,normalizeStore,exportLocalBackup,importLocalBackup} from '../src/localJournal.js';
import {calculateAdvancedStats,calendarStats,equityPointsByPeriod} from '../src/analytics.js';
import {empraScore} from '../src/empra.js';
import {checklistStats,disciplineAnalytics,RULES} from '../src/discipline.js';
import {dailyRisk} from '../src/risk.js';
const accounts=[{id:'a',name:'Synthetic A',startingBalance:1000},{id:'b',name:'Synthetic B',startingBalance:2000}];
const store=()=>normalizeStore({accounts,trades:[]});
const shared={date:'2026-11-06',asset:'MNQ',direction:'Short',outcome:'Loss',entryTime:'08:00',exitTime:'09:00',note:'Synthetic shared note',lesson:'Synthetic lesson',answers:{reason:'Synthetic review'},screenshots:[{id:'shot',dataUrl:'data:image/png;base64,iVBORw0KGgo=',name:'synthetic.png'}]};
test('one or two account executions have distinct IDs, results, analytics and independent edits',()=>{
 const one=prepareAccountExecutions(store(),shared,[{accountId:'a',pnl:'-200'}],'one');assert.equal(one.trades.length,1);
 const two=prepareAccountExecutions(store(),shared,[{accountId:'a',pnl:'-200'},{accountId:'b',pnl:'100',exitTime:'09:01'}],'two');
 assert.equal(new Set(two.trades.map(t=>t.id)).size,2);assert.equal(calculateAdvancedStats(two.trades).netPnl,-100);
 for(const [id,pnl] of [['a',-200],['b',100]]) {assert.equal(calculateAdvancedStats(two.trades.filter(t=>t.accountId===id)).netPnl,pnl);assert.equal(dailyRisk(two.trades,accounts.find(a=>a.id===id),shared.date).pnl,pnl);}
 assert.equal(two.trades[1].outcome,'Win');assert.equal(two.trades[0].note,shared.note);assert.deepEqual(two.trades[1].screenshots,two.trades[0].screenshots);
 const edited=prepareLocalTrade(two,{...two.trades[0],pnl:'-150',note:'independent'});assert.equal(edited.trades[1].pnl,'100');assert.equal(edited.trades[1].note,shared.note);
 assert.equal(prepareAccountExecutions(two,shared,[{accountId:'a',pnl:'-200'},{accountId:'b',pnl:'100'}],'two').trades.length,2);
});
test('invalid secondary account, missing result and duplicate account reject without changing input',()=>{
 for(const executions of [[{accountId:'a',pnl:'1'},{accountId:'b',pnl:''}],[{accountId:'a',pnl:'1'},{accountId:'missing',pnl:'1'}],[{accountId:'a',pnl:'1'},{accountId:'a',pnl:'2'}]]) {const input=store(),before=JSON.stringify(input);assert.throws(()=>prepareAccountExecutions(input,shared,executions,'x'));assert.equal(JSON.stringify(input),before);}
});
test('legacy checklist IDs survive ZIP; retired question excluded; distribution separates unanswered',async()=>{
 const answers=Object.fromEntries(RULES.map(([id])=>[id,'yes']));answers.accountConfirmed='no';
 const input=normalizeStore({...store(),discipline:[{id:'d',accountId:'a',date:shared.date,answers,notes:'Historical'}]});
 const restored=await importLocalBackup(await exportLocalBackup(input));assert.equal(restored.discipline[0].answers.accountConfirmed,'no');assert.equal(checklistStats(restored.discipline[0]).percent,100);assert.equal(checklistStats(restored.discipline[0]).complete,true);
 const records=Array.from({length:11},(_,i)=>({accountId:'a',date:`2026-10-${String(i+1).padStart(2,'0')}`,answers:{deskBefore:i<7?'yes':i<9?'no':i===9?'na':''}}));
 const rule=disciplineAnalytics(records,[],accounts[0]).rules.find(r=>r.id==='deskBefore');assert.deepEqual([rule.yes,rule.broken,rule.na,rule.total,rule.unanswered],[7,2,1,10,1]);assert.equal(rule.percent,7/9*100);
});
test('score minimum, deterministic components, account isolation and unrealised exclusion',()=>{
 assert.equal(empraScore([]).score,null);
 const trades=Array.from({length:20},(_,i)=>({...shared,id:`t${i}`,accountId:i<10?'a':'b',pnl:i<10?'200':'-100',outcome:i<10?'Win':'Loss'}));
 assert.equal(empraScore(trades).score,83);assert.equal(empraScore(trades.filter(t=>t.accountId==='a')).score,null);assert.equal(empraScore(trades.filter(t=>t.accountId==='b')).score,null);assert.equal(empraScore(trades.slice(0,19)).score,null);assert.equal(empraScore(trades.map(t=>({...t,outcome:'Win',pnl:'100'}))).score,null);
 assert.equal(empraScore([...trades,{...shared,realised:false,pnl:'-90000'}]).score,83);
 assert.equal(calendarStats(trades)[0].netPnl,1000);assert.equal(calendarStats(trades)[0].trades,20);assert.equal(equityPointsByPeriod(trades,'daily').at(-1).value,1000);
});
test('historical risk reports unknown ordering honestly and remembers recovered limit hits',()=>{
 const row=(pnl,exitTime)=>({...shared,accountId:'a',pnl,exitTime});
 assert.equal(dailyRisk([row('-200','')],accounts[0],shared.date).historyStatus,'unknown');
 assert.equal(dailyRisk([row('-500',''),row('100','10:00')],accounts[0],shared.date).historyStatus,'unknown');
 assert.equal(dailyRisk([row('-500','09:00'),row('400','10:00')],accounts[0],shared.date).historyStatus,'breached');
 assert.equal(dailyRisk([row('-50','09:00'),row('100','09:00')],accounts[0],shared.date).historyStatus,'unknown');
 assert.equal(dailyRisk([row('-200','09:00')],accounts[0],shared.date).historyStatus,'within');
 assert.equal(dailyRisk([row('-500','')],accounts[0],shared.date).peakLoss,500);
 assert.equal(dailyRisk([row('-500','09:00'),row('','10:00')],accounts[0],shared.date).historyStatus,'unknown');
});
