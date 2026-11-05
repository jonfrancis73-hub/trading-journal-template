import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5198';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5198'],{stdio:'ignore'});
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 const context=await browser.newContext({timezoneId:'America/Los_Angeles',viewport:{width:1440,height:1000}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<60;i++){try{await page.goto(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 await expect(page.getByLabel('View account')).toBeVisible();
 await page.evaluate(async()=>{
 const j=await import('/src/localJournal.js');const {localDay}=await import('/src/risk.js');let s=await j.loadLocalStore();
 s=await j.saveLocalAccounts(s,[...s.accounts,{id:'a',name:'Synthetic A',startingBalance:50000},{id:'b',name:'Synthetic B',startingBalance:50000}]);
 s=await j.saveLocalTrade(s,{id:'risk-loss',accountId:'a',date:localDay(),asset:'MNQ',pnl:'-500',outcome:'Loss',entryTime:'12:00',exitTime:'12:05',note:'Synthetic risk review'});
 await j.saveLocalTrade(s,{id:'risk-profit',accountId:'b',date:localDay(),asset:'MNQ',pnl:'100',outcome:'Win',entryTime:'07:30',exitTime:'08:00'});
 });
 await page.reload();await page.getByLabel('View account').selectOption('a');
 await page.getByRole('button',{name:'Risk Management',exact:true}).click();
 await expect(page.getByText('DAILY LOSS LIMIT REACHED / BREACHED',{exact:true})).toBeVisible();
 await page.getByLabel('View account').selectOption('b');await expect(page.getByText('Within daily loss limit',{exact:true})).toBeVisible();
 await page.getByLabel('Maximum daily realised loss ($)').fill('650');await page.getByRole('button',{name:'Save Risk Settings'}).click();await expect(page.getByText('Risk settings saved.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Discipline',exact:true}).click();
 const selects=page.locator('fieldset select');for(let i=0;i<await selects.count();i++)await selects.nth(i).selectOption(i===0?'no':'yes');
 await page.getByLabel('Daily reflection').fill('Synthetic reflection');await page.getByRole('button',{name:'Save Daily Checklist'}).click();await expect(page.getByText('Checklist and reflection saved.',{exact:true})).toBeVisible();
 await page.reload();await page.getByLabel('View account').selectOption('b');await expect(page.getByLabel('Daily reflection')).toHaveValue('Synthetic reflection');
 await page.getByLabel('View account').selectOption('a');await expect(page.getByLabel('Daily reflection')).toHaveValue('');
 await selects.nth(0).selectOption('yes');await page.getByRole('button',{name:'Save Daily Checklist'}).click();await expect(page.getByText('Incomplete · 1/11 answered · 100.0%',{exact:true})).toBeVisible();
 // Automatic restore includes the full new collections and account settings.
 await page.evaluate(async()=>{const j=await import('/src/localJournal.js');const original=await j.loadLocalStore();await j.createLocalAutoBackup(original,'synthetic_risk_restore');const snap=(await j.listLocalAutoBackups())[0];await j.saveLocalDiscipline(original,{id:'x',accountId:'a',date:'2026-01-01',answers:{},notes:'temporary'});const restored=await j.restoreLocalAutoBackup(snap.id);if(restored.discipline.length!==original.discipline.length||restored.accounts.find(a=>a.id==='b').risk.dailyLossLimit!==650)throw Error('Restore lost risk/discipline');const round=await j.importLocalBackup(await j.exportLocalBackup(restored));if(round.discipline.find(r=>r.accountId==='b').notes!=='Synthetic reflection')throw Error('ZIP lost reflection');});
 await page.getByRole('button',{name:'Trade Log',exact:true}).click();await expect(page.getByText('Outside permitted trading hours',{exact:true})).toBeVisible();
 await page.setViewportSize({width:390,height:844});for(const tab of ['Discipline','Risk Management']){await page.getByRole('button',{name:tab,exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${tab} mobile overflow`);}
 // The clock crosses local midnight while the panel remains mounted.
 await page.clock.install({time:new Date('2026-11-05T07:59:59Z')});await page.reload();await page.getByLabel('View account').selectOption('a');await page.clock.runFor(2000);await expect(page.getByText(/Day: 2026-11-05/)).toBeVisible();
 assert.deepEqual(errors,[]);console.log('Risk/discipline browser checks passed: account independence, settings, incomplete/completed persistence, reflections, backups, session flags, mobile, local midnight.');
} finally {await browser?.close();server.kill('SIGTERM');}
