import { parseHomepageHtml, parseDetailHtml, canMonitorRobots } from './parse.mjs';
import { normalizeItem } from './value.mjs';

const BASE='https://thatprizeguy.co.uk';
const USER_AGENT='PrizePulsePriceMonitor/0.1 (+independent-public-price-monitor)';

async function fetchPage(url, fetcher=fetch, timeoutMs=9000) {
  const response=await fetcher(url,{headers:{'User-Agent':USER_AGENT,'Accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(timeoutMs),redirect:'follow'});
  if(!response.ok) throw new Error(`Source HTTP ${response.status} at ${new URL(url).pathname}`);
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('html') && !contentType.includes('text/plain')) throw new Error('Unexpected source content type');
  const html=await response.text();
  if(html.length < 200 || html.length > 6_000_000) throw new Error('Source response size invalid');
  return html;
}

export async function collect(now=new Date().toISOString(), fetcher=fetch, previous=[]) {
  // Respect robots directives; if unavailable for a reason other than 404, do not scrape.
  const robots=await fetcher(`${BASE}/robots.txt`,{headers:{'User-Agent':USER_AGENT},signal:AbortSignal.timeout(5000)});
  if(robots.ok) {
    if(!canMonitorRobots(await robots.text())) throw new Error('Robots policy disallows monitoring');
  } else if(robots.status!==404) throw new Error(`Cannot verify robots policy (HTTP ${robots.status})`);
  const html=await fetchPage(BASE,fetcher);
  const basics=parseHomepageHtml(html,now);
  if(basics.length<2) throw new Error('Source layout changed; too few valid competitions. No update saved.');
  const previousById=new Map(previous.map(x=>[x.id,x]));
  const records=[];
  for(const basic of basics) {
    const old=previousById.get(basic.id);
    const priceEvents=old?.priceEvents ? [...old.priceEvents] : [];
    if(old && old.pricePence!==basic.pricePence) priceEvents.push({at:now,beforePence:old.pricePence,afterPence:basic.pricePence});
    const history=old?.history ? [...old.history] : [];
    const last=history.at(-1);
    const due=!last||Date.parse(now)-Date.parse(last.at)>=6*60*60*1000;
    if(!last||last.pricePence!==basic.pricePence||due) history.push({at:now,pricePence:basic.pricePence,entriesSold:basic.entriesSold});
    records.push(normalizeItem({
      ...old,...basic,
      // Retain validated detail data until a fresh detail check.
      cashAlternativePence: basic.cashAlternativePence ?? old?.cashAlternativePence ?? null,
      history:history.slice(-240),priceEvents:priceEvents.slice(-80)
    }));
  }
  const valid=records.filter(Boolean);
  // Only two public details per run to avoid excessive requests.
  const candidates=[...valid].sort((a,b)=>Date.parse(a.detailCheckedAt||0)-Date.parse(b.detailCheckedAt||0)).slice(0,2);
  for(const item of candidates) {
    try {
      const detail=parseDetailHtml(await fetchPage(item.url,fetcher,5000));
      if(Number.isInteger(detail.maxEntries)&&detail.maxEntries>0) {
        item.maxEntries=detail.maxEntries;
        item.entriesSold=detail.entriesSold;
      }
      if(detail.cashAlternativePence && !item.instantWin) item.cashAlternativePence=detail.cashAlternativePence;
      if(detail.instantWin) {item.instantWin=true;item.category='Instant';}
      item.detailCheckedAt=now;
    } catch(e) {
      // Source may block some pages; preserve older details and retry on future run.
      console.warn('Detail enrichment unavailable',item.id,String(e));
      item.detailCheckedAt=now;
    }
  }
  return {items:valid,checkedAt:now,source:BASE,status:'live',count:valid.length};
}