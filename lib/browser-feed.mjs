import { normalizeItem } from './value.mjs';

const OFFICIAL='https://thatprizeguy.co.uk';
const MAX_ITEMS=160;

export function validateBrowserSubmission(payload, nowMs=Date.now()) {
  if(!payload || typeof payload!=='object' || !Array.isArray(payload.items)) throw new Error('Expected competition records');
  if(payload.items.length<2 || payload.items.length>MAX_ITEMS) throw new Error('Expected 2 to 160 listed competitions');
  const sourceUrl=new URL(String(payload.pageUrl||''));
  if(sourceUrl.origin!==OFFICIAL || sourceUrl.pathname.replace(/\/$/,'')!=='/categories/all') throw new Error('Only public competition listings are accepted');
  const loaded=Date.parse(String(payload.pageLoadedAt||''));
  if(!Number.isFinite(loaded)||loaded>nowMs+30000||nowMs-loaded>125000) throw new Error('Browser page is too old; reload it before syncing');
  const collected=Date.parse(String(payload.capturedAt||''));
  if(!Number.isFinite(collected)||Math.abs(nowMs-collected)>120000) throw new Error('Invalid capture time');
  const uniq=new Map();
  for(const raw of payload.items){
    const item=normalizeItem(raw);
    if(!item || !item.title || item.pricePence>100000 || (item.advertisedPreviousPence!==null&&item.advertisedPreviousPence>100000) || (item.cashAlternativePence!==null&&item.cashAlternativePence>10000000000)) throw new Error('Invalid public competition value');
    // Never accept user-supplied history, odds, or ticket limits from a list-page capture.
    item.maxEntries=null;item.entriesSold=null;item.prizeValuePence=null;
    item.history=[];item.priceEvents=[];item.detailCheckedAt=null;
    item.checkedAt=new Date(nowMs).toISOString();
    uniq.set(item.id,item);
  }
  if(uniq.size<2) throw new Error('Too few unique competitions');
  return [...uniq.values()];
}

export function mergeBrowserSnapshot(current, previous, now = new Date().toISOString()) {
  const prev=new Map((previous?.items||[]).map(x=>[x.id,x]));
  const items=current.map(next=>{
    const last=prev.get(next.id);
    const history=[...(last?.history||[])];
    const priceEvents=[...(last?.priceEvents||[])];
    const changed=Boolean(last)&&last.pricePence!==next.pricePence;
    if(changed) priceEvents.push({at:now,beforePence:last.pricePence,afterPence:next.pricePence});
    const lastReading=history.at(-1);
    if(!lastReading||changed||Date.parse(now)-Date.parse(lastReading.at)>=5*60000) history.push({at:now,pricePence:next.pricePence,entriesSold:null});
    return normalizeItem({...next,history:history.slice(-288),priceEvents:priceEvents.slice(-80),checkedAt:now});
  });
  return {status:'browser',source:'browser-visible-public-listings',checkedAt:now,items,count:items.length};
}

export function pickFeed(browser,server,nowMs=Date.now()) {
  const candidate=[browser,server].filter(x=>x&&Array.isArray(x.items)&&x.items.length>=2&&Number.isFinite(Date.parse(x.checkedAt)));
  if(!candidate.length)return null;
  return candidate.sort((a,b)=>Date.parse(b.checkedAt)-Date.parse(a.checkedAt))[0];
}