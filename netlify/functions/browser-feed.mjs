import { timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { validateBrowserSubmission,mergeBrowserSnapshot } from '../../lib/browser-feed.mjs';

const HEADERS={'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8'};
const json=(data,status=200)=>Response.json(data,{status,headers:HEADERS});

export default async function browserFeed(req){
  if(req.method!=='POST')return json({error:'Method not allowed'},405);
  const configured=process.env.PRIZEPULSE_COLLECTOR_KEY;
  if(!configured||configured.length<24)return json({error:'Browser collector not configured'},503);
  const supplied=req.headers.get('x-prizepulse-key')||'';
  const a=Buffer.from(supplied),b=Buffer.from(configured);
  if(a.length!==b.length||!timingSafeEqual(a,b))return json({error:'Unauthorised browser collector'},401);
  if(!(req.headers.get('content-type')||'').includes('application/json'))return json({error:'JSON required'},415);
  const contentLength=Number(req.headers.get('content-length')||0);
  if(contentLength>128000)return json({error:'Payload too large'},413);
  try {
    const raw=await req.text();
    if(raw.length>128000) return json({error:'Payload too large'},413);
    const now=new Date().toISOString();
    const records=validateBrowserSubmission(JSON.parse(raw),Date.parse(now));
    const store=getStore({name:'prizepulse-public-v1',consistency:'strong'});
    const previous=await store.get('browser-latest',{type:'json'});
    const snapshot=mergeBrowserSnapshot(records,previous,now);
    await store.setJSON('browser-latest',snapshot);
    console.info('Saved user-assisted public listing snapshot',snapshot.count);
    return json({ok:true,count:snapshot.count,checkedAt:now});
  } catch(error){
    console.warn('Browser listing rejected',String(error));
    return json({error:'Cannot import snapshot: '+String(error.message||error).slice(0,140)},400);
  }
}
export const config={path:'/api/browser-feed',method:'POST'};