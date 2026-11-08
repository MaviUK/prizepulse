import { getStore } from '@netlify/blobs';
import { runMonitor } from '../../lib/run-monitor.mjs';

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
    const [latest,status]=await Promise.all([store.get('latest',{type:'json'}),store.get('sync-status',{type:'json'})]);
    if(!latest || !Array.isArray(latest.items) || latest.items.length<2) {
      // The first browser visit may bootstrap once per slot, always obeying robots.txt.
      let started=false;
      if(typeof context?.waitUntil==='function') {
        try {
          const slot=currentSlot(Date.now());
          const claim=await store.setJSON('bootstrap/'+slot,{at:new Date().toISOString()},{onlyIfNew:true});
          if(claim.modified) {
            context.waitUntil(runMonitor(store));
            started=true;
          }
        } catch(error) { console.warn('PrizePulse bootstrap could not start',String(error)); }
      }
      return Response.json({status:'uninitialised',checkedAt:null,items:[],count:0,
        bootstrapStarted:started,lastAttemptAt:status?.at||null,
        monitorWarning:status?.status==='error'?status.reason:'Waiting for the first verified public-source check.'},{headers});
    }
    const failed=status?.status==='error'&&Date.parse(status.at)>Date.parse(latest.checkedAt);
    const stale=!(Date.parse(latest.checkedAt)>0)||Date.now()-Date.parse(latest.checkedAt)>90*60*1000;
    const warning=failed?status.reason+' Showing the previous verified snapshot.':stale?'The last verified snapshot is over 90 minutes old. Prices may have changed.':null;
    return Response.json({...latest,status:stale?'stale':'live',monitorWarning:warning,lastAttemptAt:status?.at||latest.checkedAt},{headers});
  } catch(error) {
    console.error('PrizePulse snapshot API failed',String(error));
    return Response.json({status:'error',checkedAt:null,items:[],count:0,monitorWarning:'The monitoring service is temporarily unavailable.'},{status:503,headers});
  }
}
export const config={path:'/api/competitions',method:'GET'};
