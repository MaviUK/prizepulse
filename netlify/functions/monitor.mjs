import { getStore } from '@netlify/blobs';
import { runMonitor } from '../../lib/run-monitor.mjs';

export default async function monitor() {
  const store=getStore({name:'prizepulse-public-v1',consistency:'strong'});
  const result=await runMonitor(store);
  return Response.json(result,{status:result.ok?200:503,headers:{'Cache-Control':'no-store'}});
}
export const config={schedule:'*/30 * * * *'};
