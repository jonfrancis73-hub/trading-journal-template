import {chromium,expect} from '@playwright/test';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5199';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5199'],{stdio:'ignore'});
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(let i=0;i<60;i++){try{await page.goto(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 await expect(page.getByLabel('View account')).toBeVisible();
 await expect(page.getByText('Not enough data',{exact:true})).toBeVisible();
 await expect(page.locator('.trading-calendar')).toBeVisible();
 assert.deepEqual(await page.locator('.app-nav button').allTextContents(),[' Discipline',' Dashboard',' Trade Log',' Add Trade',' Analytics',' Risk Management',' Accounts',' Playbooks',' Reports',' Settings']);
 await page.evaluate(async()=>{const j=await import('/src/localJournal.js');const s=await j.loadLocalStore();await j.saveLocalAccounts(s,[...s.accounts,{id:'a',name:'Synthetic A',startingBalance:50000},{id:'b',name:'Synthetic B',startingBalance:50000}]);});
 await page.reload();await page.getByRole('button',{name:'Add Trade',exact:true}).first().click();
 await page.getByLabel('Trade account',{exact:true}).selectOption('a');
 await page.getByLabel('P&L',{exact:true}).fill('-200');
 await page.getByRole('checkbox',{name:'Synthetic B',exact:true}).check();
 await expect(page.getByLabel('Net P&L Synthetic B',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:/Screenshots/}).click();
 await page.locator('input[type=file]').first().setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=','base64')});
 await page.getByRole('button',{name:/Notes/}).click();await page.getByLabel('Raw Trade Notes').fill('Synthetic multi-account note and reflection.');
 await page.getByRole('button',{name:/Review Check and save/}).click();await page.getByRole('button',{name:'Save Trade',exact:true}).click();
 await expect(page.getByText('Confirm net realised P&L for every account.',{exact:true})).toBeVisible();
 assert.equal(await page.evaluate(async()=>{const j=await import('/src/localJournal.js');return (await j.loadLocalStore()).trades.length;}),0);
 await page.getByLabel('Net P&L Synthetic B',{exact:true}).fill('-100');
 await page.getByRole('button',{name:'Save Trade',exact:true}).dblclick();await expect(page.getByText('Trade saved.',{exact:true})).toBeVisible();
 let saved=await page.evaluate(async()=>{const j=await import('/src/localJournal.js');return (await j.loadLocalStore()).trades;});
 assert.equal(saved.length,2);assert.equal(new Set(saved.map(t=>t.id)).size,2);assert.deepEqual(saved.map(t=>t.pnl).sort(),['-100','-200']);
 // Force the journal+backup write transaction to fail after preflight; neither changes.
 const atomic=await page.evaluate(async()=>{
   const j=await import('/src/localJournal.js');const s=await j.loadLocalStore(),backups=await j.listLocalAutoBackups();
   const native=IDBDatabase.prototype.transaction;
   IDBDatabase.prototype.transaction=function(...args){const tx=native.apply(this,args);if(args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
   let failed=false;try{await j.saveLocalTradeBatch(s,{date:'2026-11-01',asset:'TEST',note:'Synthetic failed write'},[{accountId:'a',pnl:'-1'},{accountId:'b',pnl:'-2'}],'failed');}catch{failed=true;}finally{IDBDatabase.prototype.transaction=native;}
   const after=await j.loadLocalStore();if(!failed||after.trades.length!==2||JSON.stringify(await j.listLocalAutoBackups())!==JSON.stringify(backups))throw Error('Atomic rollback failed');
   const next=await j.saveLocalTradeBatch(after,{date:'2026-11-01',asset:'TEST',note:'Synthetic retry'},[{accountId:'a',pnl:'-1'},{accountId:'b',pnl:'-2'}],'failed');
   const retried=await j.saveLocalTradeBatch(next,{},[{accountId:'a',pnl:'-1'}],'failed');if(retried.trades.length!==4)throw Error('Idempotent retry failed');
   const beforeB=JSON.stringify(retried.trades.find(t=>t.accountId==='b'));const edited=await j.saveLocalTrade(retried,{...retried.trades[0],pnl:'-150'});if(JSON.stringify(edited.trades.find(t=>t.accountId==='b'))!==beforeB)throw Error('Edit leaked');
   const zip=await j.importLocalBackup(await j.exportLocalBackup(edited));if(zip.trades[0].note!==s.trades[0].note||zip.trades[0].screenshots[0].dataUrl!==s.trades[0].screenshots[0].dataUrl)throw Error('ZIP lost shared fields');
   const snap=(await j.listLocalAutoBackups())[0];await j.saveLocalTrade(edited,{...edited.trades[0],note:'temporary'});const restored=await j.restoreLocalAutoBackup(snap.id);if(restored.trades[0].note!==zip.trades[0].note)throw Error('Recovery lost note');
   return true;
 });assert.equal(atomic,true);
 await page.reload();await page.getByRole('button',{name:'Dashboard',exact:true}).click();
 await expect(page.locator('.performance-cards').getByText('-$253',{exact:true})).toBeVisible();
 await page.getByLabel('View account').selectOption('b');await expect(page.locator('.performance-cards').getByText('-$102',{exact:true})).toBeVisible();
 for(const tab of ['Dashboard','Analytics']){await page.getByRole('button',{name:tab,exact:true}).click();await expect(page.locator('.trading-calendar')).toBeVisible();const label=await page.locator('.calendar-header h2').innerText();await page.getByRole('button',{name:'Next',exact:true}).click();assert.notEqual(await page.locator('.calendar-header h2').innerText(),label);await page.getByRole('button',{name:'Prev',exact:true}).click();await page.locator('.calendar-month-grid button:not([disabled])').first().click();await expect(page.locator('.calendar-trade-list button').first()).toBeVisible();}
 await page.getByRole('button',{name:'Dashboard',exact:true}).click();await page.screenshot({path:`${tmpdir()}/trading-journal-dashboard.png`,fullPage:true});
 await page.getByRole('button',{name:'Discipline',exact:true}).click();
 const answerGroup=page.getByRole('group',{name:'Am I trading from my desk?',exact:true});
 await answerGroup.getByRole('button',{name:'N/A',exact:true}).click();await expect(answerGroup.getByRole('button',{name:/N\/A/})).toHaveAttribute('aria-pressed','true');
 await answerGroup.getByRole('button',{name:'Yes',exact:true}).click();await expect(answerGroup.getByRole('button',{name:'N/A',exact:true})).toHaveAttribute('aria-pressed','false');
 await answerGroup.getByRole('button',{name:/Yes/}).click();assert.equal(await answerGroup.locator('[aria-pressed=true]').count(),0);
 await expect(page.getByRole('group',{name:'Have I confirmed risk sizing relative to account P&L?',exact:true})).toBeVisible();
 await expect(page.getByText('Have I confirmed which funded account I am trading?',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Risk Management',exact:true}).click();await expect(page.getByLabel('Session start (UK)',{exact:true})).toHaveCount(0);await expect(page.getByLabel('Session end (UK)',{exact:true})).toHaveCount(0);
 for(const width of [1024,768,320]){await page.setViewportSize({width,height:900});await page.getByRole('button',{name:'Dashboard',exact:true}).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`Dashboard overflow at ${width}`);}
 await page.setViewportSize({width:390,height:844});
 for(const tab of ['Dashboard','Discipline','Analytics','Risk Management','Accounts','Add Trade']){await page.getByRole('button',{name:tab,exact:true}).first().click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${tab} mobile overflow`);}
 await page.locator('.sidebar summary').click();await expect(page.getByRole('navigation',{name:'Main navigation'})).not.toBeVisible();await page.locator('.sidebar summary').click();await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
 await page.locator('.sidebar summary').click();await page.setViewportSize({width:1440,height:1000});await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
 assert.deepEqual(errors,[]);console.log('Experience browser checks passed: batch UI, differing results, double click, atomic rollback/retry, independent edit, ZIP/recovery, account metrics, both calendars, navigation, mobile.');
}finally{await browser?.close();server.kill('SIGTERM');}
