import test from 'node:test';
import assert from 'node:assert/strict';
import { runMonitor, safeMonitorError } from '../lib/run-monitor.mjs';

const home='<h3>Car One or £500</h3> Per entry 20p 25% Sold <a href="/competitions/car-one">Enter now: Car One or £500</a> <h3>Win £2,000</h3> Per entry 10p 12% Sold <a href="/competitions/win-2000">Enter now: Win £2,000</a>';
function memoryStore(seed={}) { const db=new Map(Object.entries(seed)); return {db,async get(k){return db.get(k)||null},async setJSON(k,v){db.set(k,v);return {modified:true}}}; }
test('a forbidden source never replaces the previous live snapshot and reports readable status',async()=>{
 const earlier={status:'live',items:[{id:'old'}]};const store=memoryStore({latest:earlier});
 const result=await runMonitor(store,{now:'2026-11-08T22:40:00Z',fetcher:async()=>new Response('Forbidden',{status:403})});
 assert.equal(result.ok,false);
 assert.deepEqual(await store.get('latest'),earlier);
 assert.equal((await store.get('sync-status')).status,'error');
 assert.match(result.reason,/policy/i);
});
test('a valid source updates the snapshot and clears an earlier error status',async()=>{
 const store=memoryStore({'sync-status':{status:'error',at:'2026-11-08T21:00:00Z'}});
 const result=await runMonitor(store,{now:'2026-11-08T22:40:00Z',fetcher:async url=> {
   if(String(url).endsWith('/robots.txt')) return new Response('User-agent: *\nAllow: /',{status:200,headers:{'content-type':'text/plain'}});
   if(String(url).includes('/competitions/')) return new Response('<html><body>Test detail available</body></html>',{status:200,headers:{'content-type':'text/html'}});
   return new Response('<html><body>'+home+'</body></html>',{status:200,headers:{'content-type':'text/html'}});
 }});
 assert.equal(result.ok,true);
 assert.equal((await store.get('sync-status')).status,'ok');
 assert.equal((await store.get('latest')).items.length,2);
});
test('source error descriptions are suitable for public display',()=>{
 assert.match(safeMonitorError(new Error('Source HTTP 429 at /')),/refused|limited/i);
 assert.match(safeMonitorError(new Error('too few valid competitions')),/structure/i);
});

test('once blocked, a scheduled check does not retry without explicit approval',async()=>{
 const store=memoryStore({'sync-status':{status:'error',at:'2026-11-08T22:41:00Z',reason:'The source website refused or limited the request.',blocked:true}});
 const result=await runMonitor(store,{now:'2026-11-08T22:42:00Z',fetcher:async()=>{throw new Error('Should never fetch blocked source');}});
 assert.equal(result.blocked,true);assert.equal(result.paused,true);
});
