import { getStore } from '@netlify/blobs';
import { runMonitor } from '../../lib/run-monitor.mjs';
import { pickFeed } from '../../lib/browser-feed.mjs';

const headers={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
const cacheName='prizepulse-public-v1';
function currentSlot(now) {
  const date=new Date(now);
  return date.toISOString().slice(0,13)+'-'+(date.getUTCMinutes()<30?'00':'30');
}
export default async function competitions(req,context) {
  if(req.method!=='GET') return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
  try {
    const store=getStore({name:cacheName,consistency:'strong'});
    const [serverLatest,status,browserLatest]=await Promise.all([store.get('latest',{type:'json'}),store.get('sync-status',{type:'json'}),store.get('browser-latest',{type:'json'})]);
    const latest=pickFeed(browserLatest,serverLatest);
    if(!latest || !Array.isArray(latest.items) || latest.items.length<2) {
      const sourceBlocked=Boolean(status?.blocked)||(status?.status==='error'&&/source website refused or limited|source access policy could not be verified/i.test(status.reason||''));
      // Trigger the initial read at most once per 30-minute slot. It obeys robots.txt
      // and never publishes errors or samples as verified data. Scheduled checks
      // continue independently every 30 minutes after initialization.
      let started=false;
      if(!sourceBlocked && typeof context?.waitUntil==='function') {
        try {
          const slot=currentSlot(Date.now());
          const claim=await store.setJSON(`bootstrap/${slot}`,{at:new Date().toISOString()},{onlyIfNew:true});
          if(claim.modified) {
            context.waitUntil(runMonitor(store));
            started=true;
          }
        } catch(error) { console.warn('PrizePulse bootstrap could not start',String(error)); }
      }
      return Response.json({status:sourceBlocked?'blocked':'uninitialised',checkedAt:null,items:[],count:0,
        bootstrapStarted:started,lastAttemptAt:status?.at||null,
        monitorWarning:status?.status==='error'?status.reason:'Waiting for the first verified public-source check.'},{headers});
    }
    const browserSource=latest.status==='browser';
    const failed=!browserSource&&status?.status==='error'&&Date.parse(status.at)>Date.parse(latest.checkedAt);
    const stale=!(Date.parse(latest.checkedAt)>0)||Date.now()-Date.parse(latest.checkedAt)>3*60*1000;
    const warning=failed?`${status.reason} Showing the previous verified snapshot.`:stale?'The last verified snapshot is over 3 minutes old. Prices may have changed.':null;
    return Response.json({...latest,status:stale?'stale':browserSource?'browser':'live',feedType:browserSource?'browser':'server',monitorWarning:warning,lastAttemptAt:browserSource?latest.checkedAt:status?.at||latest.checkedAt},{headers});
  } catch(error) {
    console.error('PrizePulse snapshot API failed',String(error));
    return Response.json({status:'error',checkedAt:null,items:[],count:0,monitorWarning:'The monitoring service is temporarily unavailable.'},{status:503,headers});
  }
}
export const config={path:'/api/competitions',method:'GET'};