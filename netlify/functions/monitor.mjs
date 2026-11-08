import { getStore } from '@netlify/blobs';
import { collect } from '../../lib/monitor.mjs';

export default async function monitor() {
  const store=getStore({name:'prizepulse-public-v1',consistency:'strong'});
  const previous=await store.get('latest',{type:'json'}).catch(()=>null);
  try {
    const next=await collect(new Date().toISOString(),fetch,previous?.items||[]);
    await store.setJSON('latest',next);
    return Response.json({ok:true,count:next.count,checkedAt:next.checkedAt});
  } catch(error) {
    console.error('Price monitor failed without overwriting previous snapshot',String(error));
    await store.setJSON('sync-status',{status:'error',at:new Date().toISOString(),error:String(error).slice(0,300)});
    return Response.json({ok:false,error:'Source check failed; previous prices were retained'},{status:503});
  }
}

export const config={schedule:'*/30 * * * *'};