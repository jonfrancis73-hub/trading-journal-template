import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyRisk, localDay, sessionNow, tradeSession, validateRisk, riskHistory } from '../src/risk.js';
import { RULES, checklistStats, disciplineAnalytics } from '../src/discipline.js';
import { normalizeStore, exportLocalBackup, importLocalBackup, mergeBackupStores } from '../src/localJournal.js';
const a={id:'a',name:'Synthetic A',startingBalance:0}, b={id:'b',name:'Synthetic B',startingBalance:0};
const trade=(id,pnl,extra={})=>({id,accountId:'a',date:'2026-11-04',entryTime:'08:00',exitTime:'09:00',screenshots:[],outcome:'Loss',pnl:String(pnl),...extra});
const answers=Object.fromEntries(RULES.map(([id])=>[id,'yes']));
test('net cumulative loss includes profits, is independent and excludes unrealised/missed',()=>{
 const trades=[trade('loss',-550),trade('profit',100),trade('other',-900,{accountId:'b'}),trade('open',-2000,{realised:false}),trade('missed',-1000,{outcome:'Missed'})];
 const r=dailyRisk(trades,a,'2026-11-04');assert.equal(r.pnl,-450);assert.equal(r.remaining,50);assert.equal(r.status,'approaching');assert.equal(dailyRisk(trades,b,'2026-11-04').status,'breached');
 assert.equal(dailyRisk([trade('limit',-500)],a,'2026-11-04').remaining,0);assert.equal(dailyRisk([trade('limit',-500)],a,'2026-11-04').status,'breached');
 assert.equal(dailyRisk(trades,a,'2026-11-05').pnl,0);
});
test('local midnight reset uses local calendar fields, not UTC',()=>{assert.equal(localDay(new Date(2026,10,4,23,59,59)),'2026-11-04');assert.equal(localDay(new Date(2026,10,5,0,0,0)),'2026-11-05');});
test('UK session boundaries, winter/summer daylight saving, unknown and account-specific settings',()=>{
 for(const [time,want] of [['07:29',false],['07:30',true],['11:59',true],['12:00',false],['',null]]) assert.equal(tradeSession(trade('t',0,{entryTime:time}),a),want);
 assert.equal(sessionNow(a,new Date('2026-07-01T06:30:00Z')),true);assert.equal(sessionNow(a,new Date('2026-01-01T07:29:00Z')),false);
 assert.equal(sessionNow(a,new Date('2026-07-01T11:00:00Z')),false);
 assert.equal(tradeSession(trade('t',0),{...b,risk:{sessionStart:'09:00',sessionEnd:'10:00'}}),false);
 assert.throws(()=>validateRisk({dailyLossLimit:-1,sessionStart:'07:30',sessionEnd:'12:00'}));
 assert.throws(()=>validateRisk({dailyLossLimit:500,sessionStart:'12:00',sessionEnd:'07:30'}));
});
test('historical limit hits remain visible after recovery and incomplete chronology is unknown',()=>{
 const rows=[trade('one',-500),trade('two',100,{exitTime:'10:00'})];const r=riskHistory(rows,a)[0];assert.equal(r.reached,true);assert.equal(r.continued,1);assert.equal(r.pnl,-400);
 assert.equal(dailyRisk([trade('u',-500,{exitTime:''})],a,'2026-11-04').chronologyKnown,false);
});
test('checklist percentages exclude unanswered/N/A and distinguish incomplete/all N/A',()=>{
 assert.equal(checklistStats().percent,null);assert.equal(checklistStats({answers:{deskBefore:'yes',reviewed:'na'}}).percent,100);assert.equal(checklistStats({answers:{deskBefore:'yes'}}).complete,false);
 assert.equal(checklistStats({answers}).compliant,true);assert.equal(checklistStats({answers:Object.fromEntries(RULES.map(([id])=>[id,'na']))}).compliant,false);
});
test('historical trends, missing checklists, streaks and performance groups isolate accounts',()=>{
 const records=[{accountId:'a',date:'2026-11-02',answers},{accountId:'a',date:'2026-11-04',answers:{...answers,reviewed:'no'}},{accountId:'b',date:'2026-11-03',answers}];
 const trades=[trade('1',100,{date:'2026-11-02'}),trade('2',-500,{date:'2026-11-03'}),trade('3',50),trade('b',1000,{accountId:'b'})];const r=disciplineAnalytics(records,trades,a);
 assert.equal(r.fullyCompliant,1);assert.equal(r.incomplete,1);assert.equal(r.streak,0);assert.equal(r.best,1);assert.equal(r.compliant.pnl,100);assert.equal(r.noncompliant.pnl,50);assert.equal(r.rules.find(x=>x.id==='reviewed').broken,1);
});
test('ZIP backups and repeated imports preserve settings, discipline, notes and unrealised flags',async()=>{
 const store=normalizeStore({accounts:[{...a,risk:{dailyLossLimit:450,sessionStart:'08:00',sessionEnd:'11:30'}},b],trades:[trade('t',-40,{realised:false})],discipline:[{id:'day-a',accountId:'a',date:'2026-11-04',answers,notes:'Synthetic reflection'}]});
 const restored=await importLocalBackup(await exportLocalBackup(store));assert.deepEqual(restored.discipline,store.discipline);assert.deepEqual(restored.accounts,store.accounts);assert.equal(restored.trades[0].realised,false);assert.equal(mergeBackupStores(mergeBackupStores(store,restored),restored).discipline.length,1);
 assert.throws(()=>normalizeStore({...store,discipline:[...store.discipline,store.discipline[0]]}),/duplicate/);
 assert.throws(()=>mergeBackupStores(store,{...restored,discipline:[{...restored.discipline[0],notes:'changed'}]}),/conflicts/);
});
