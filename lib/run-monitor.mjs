import { collect } from './monitor.mjs';

export function safeMonitorError(error) {
  const message=String(error);
  if (/robots|policy/i.test(message)) return 'The source access policy could not be verified or does not allow monitoring.';
  if (/HTTP 401|HTTP 403|HTTP 429|HTTP 503|HTTP 502/i.test(message)) return 'The source website refused or limited the request.';
  if (/layout changed|too few valid/i.test(message)) return 'The source page structure needs review before prices can be trusted.';
  if (/timeout|abort|fetch failed|network|ENOTFOUND|ECONN/i.test(message)) return 'The source website could not be reached.';
  return 'The source check failed. Previous verified prices were preserved.';
}

export async function runMonitor(store,{now=new Date().toISOString(),fetcher=fetch}={}) {
  try {
    const previous=await store.get('latest',{type:'json'});
    const next=await collect(now,fetcher,previous?.items||[]);
    if (next.status!=='live'||!Array.isArray(next.items)||next.items.length<2) throw new Error('Source layout changed; too few valid competitions');
    await store.setJSON('latest',next);
    await store.setJSON('sync-status',{status:'ok',at:now,count:next.items.length});
    console.info('PrizePulse source check succeeded',next.items.length,now);
    return {ok:true,count:next.items.length,checkedAt:now};
  } catch(error) {
    const publicError=safeMonitorError(error);
    console.error('PrizePulse source check failed; previous snapshot retained',String(error));
    try { await store.setJSON('sync-status',{status:'error',at:now,reason:publicError}); }
    catch(storeError) { console.error('Price monitor status write failed',String(storeError)); }
    return {ok:false,checkedAt:now,reason:publicError};
  }
}
