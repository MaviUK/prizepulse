import { getStore } from '@netlify/blobs';
export default async function competitions(req) {
  if(req.method!=='GET') return new Response('Method not allowed',{status:405,headers:{'Allow':'GET'}});
  try {
    const store=getStore({name:'prizepulse-public-v1',consistency:'strong'});
    const [latest,status]=await Promise.all([store.get('latest',{type:'json'}),store.get('sync-status',{type:'json'})]);
    if(!latest || !Array.isArray(latest.items)) return Response.json({status:'uninitialised',checkedAt:null,items:[],count:0},{headers:{'Cache-Control':'public, max-age=30'}});
    return Response.json({...latest,monitorWarning:status?.status==='error' && Date.parse(status.at)>Date.parse(latest.checkedAt) ? 'Latest collection attempt failed; displaying last verified snapshot.' : null},{headers:{'Cache-Control':'public, max-age=60, stale-while-revalidate=120'}});
  } catch(e) {
    console.error('Snapshot API unavailable',String(e));
    return Response.json({status:'error',checkedAt:null,items:[],message:'Price data currently unavailable'},{status:503});
  }
}
export const config={path:'/api/competitions',method:'GET'};