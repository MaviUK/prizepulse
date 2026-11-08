import { parseMoneyPence } from './value.mjs';

const BASE = 'https://thatprizeguy.co.uk';
const AMOUNT = /(?:\u00a3\s*\d[\d,.]*(?:\s*[kKmM])?|\d[\d,.]*\s*p(?:ence)?)/g;
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', pound: '\u00a3', ndash: '-', mdash: '-', rsquo: "'" };
function decode(s) {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (_, code) => {
    if (code[0] === '#') {
      const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2),16) : parseInt(code.slice(1),10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
    }
    return ENTITIES[code.toLowerCase()] || ' ';
  });
}
export function cleanText(html) {
  return decode(String(html).replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ')
    .replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim();
}
function getAmountList(raw) {
  return [...raw.matchAll(AMOUNT)].map(m => parseMoneyPence(m[0])).filter(v => Number.isInteger(v));
}
function categoryFor(title) {
  const t = title.toLowerCase();
  if (/instant|instants|1 in 2|1 in 5|50\/50/.test(t)) return 'Instant';
  if (/car|ford|bmw|mercedes|lamborghini|audi|evo|civic|porsche|range rover/.test(t)) return 'Cars';
  if (/iphone|apple|nintendo|playstation|ps5|laptop|switch|tech|macbook|samsung/.test(t)) return 'Tech';
  if (/holiday|trip|cruise|hotel|spa|flight|concert/.test(t)) return 'Experiences';
  if (/\u00a3\s*[\d,.]+|cash|money|month/.test(t)) return 'Cash';
  return 'Lifestyle';
}
function isVariable(title) { return /\u00a3\s*\d[\d,.]*\s+to\s+\u00a3|up to|prize ladder|prize pool|1 to 1,000,000/i.test(title); }
function multiple(title) { return /chances of|worth of|instants|instant win|multiple winners|50\/50/i.test(title); }
function normalizeHref(href) {
  if (!href) return null;
  try {
    const url = new URL(decode(href), BASE);
    if (url.origin !== BASE || !/^\/competitions\/[a-z0-9-]+\/?$/i.test(url.pathname)) return null;
    return `${BASE}${url.pathname}`;
  } catch { return null; }
}

/**
 * Tolerant SSR HTML parser: headings and nearby card content are read without an API/login.
 * If the upstream site changes its markup, we fail closed instead of inventing records.
 */
export function parseHomepageHtml(html, now = new Date().toISOString()) {
  const input = String(html);
  const results = new Map();
  const headings = [...input.matchAll(/<h([234])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  for (let i=0;i<headings.length;i++) {
    const h=headings[i]; const title=cleanText(h[2]);
    if (!title || title.length > 150 || /^(?:featured|ending today|tomorrow|future selection|cash|all|more)$/i.test(title)) continue;
    const start=h.index + h[0].length;
    const end=Math.min(input.length, start+1900, i+1<headings.length ? headings[i+1].index : input.length);
    const nearby=input.slice(Math.max(0,h.index-500),end);
    const after=cleanText(input.slice(start,end));
    // Only inspect the price and sale percentage belonging to this heading.
    const priceFragment=after.match(/per\s+entry\s+([\s\S]{0,180}?)\s+(\d{1,3})\s*%\s*Sold/i);
    if (!priceFragment) continue;
    const prices=getAmountList(priceFragment[1]);
    if (!prices.length) continue;
    const current=prices.at(-1);
    if (current < 0 || current > 100_000) continue;
    // Nearby anchors may be after or before the heading depending on card structure.
    const offset=Math.max(0,h.index-500);
    const anchors=[...nearby.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(anchor=>({url:normalizeHref(anchor[1]),label:cleanText(anchor[2]).toLowerCase(),pos:offset+anchor.index}))
      .filter(anchor=>anchor.url);
    // Heading cards often repeat in featured / ending sections. Never bind a card to
    // a link from the previous item merely because both contain "Enter now".
    const labelMatch=anchors.find(anchor=>anchor.label.includes(title.toLowerCase().slice(0,18)));
    const following=anchors.find(anchor=>anchor.pos>=h.index);
    const link=labelMatch?.url || following?.url || null;
    if (!link) continue;
    const beforePrice=after.split(/per\s+entry/i)[0];
    const alt=(beforePrice.match(/(\u00a3\s*\d[\d,.]*\s*[kKmM]?)\s+cash\s+alternative/i)||[])[1];
    const close=(cleanText(input.slice(Math.max(0,h.index-250),h.index)).match(/Closes\s+(?:Today|Tmrw|Tomorrow|[A-Za-z]+\s+\d{1,2}\s+[A-Za-z]+)(?:\s+\d{1,2}(?::\d{2})?(?:am|pm))?/i)||[])[0] || null;
    const id=link.split('/').at(-1);
    const item={id,title,url:link,category:categoryFor(title),pricePence:current,
      advertisedPreviousPence:prices.length>1 ? prices[0] : null,
      soldPercent:Number(priceFragment[2]), closingLabel:close,
      cashAlternativePence:alt?parseMoneyPence(alt):null,
      prizeValuePence:null, maxEntries:null,entriesSold:null,
      instantWin:categoryFor(title)==='Instant',variablePrize:isVariable(title),multipleWinners:multiple(title),
      hasUnknownMechanics:false,checkedAt:now};
    const existing=results.get(id);
    // Prefer entries with more information, but never multiply duplicates from category sections.
    if(!existing || (!existing.cashAlternativePence && item.cashAlternativePence)) results.set(id,item);
  }
  return [...results.values()];
}

export function parseDetailHtml(html) {
  const text=cleanText(html);
  const match=text.match(/([\d,]+)\s+Tickets\s+Left\s+([\d,]+)\s*\/\s*([\d,]+)/i);
  const maxEntries=match?Number(match[3].replace(/,/g,'')):null;
  const entriesSold=match?Number(match[2].replace(/,/g,'')):null;
  const alt=text.match(/(\u00a3\s*\d[\d,.]*\s*[kKmM]?)\s+Cash\s+Alternative/i);
  const title=(text.match(/(?:^|\s)(?:##\s*)?([^.!?]+?)\s+(?:Auto\s+)?Draw(?:n)?\s+(?:TODAY|TOMORROW|on)/i)||[])[1] || '';
  const cashback=text.match(/(\d+(?:\.\d+)?)%\s+Cashback/i);
  const postal=text.match(/Postal entries to this competition receive\s+([\d,]+)\s+tickets?/i);
  const instants=/\d[\d,]*\s+Instants\s+remaining/i.test(text);
  return {
    maxEntries: maxEntries && maxEntries<=100_000_000 ? maxEntries : null,
    entriesSold: entriesSold!==null && entriesSold>=0 && entriesSold<=maxEntries ? entriesSold : null,
    cashAlternativePence:alt?parseMoneyPence(alt[1]):null,
    cashbackPercent:cashback?Number(cashback[1]):null,
    postalTickets:postal?Number(postal[1].replace(/,/g,'')):null,
    instantWin:instants,
    titleFromDetail:title.slice(0,140)
  };
}

export function canMonitorRobots(content, agent='PrizePulsePriceMonitor') {
  const lines=String(content).split(/\r?\n/).map(line=>line.split('#')[0].trim());
  let groups=[];let current=null; let hasRules=false;
  for (const line of lines) {
    const m=line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
    if(!m) continue;
    const key=m[1].toLowerCase(),val=m[2].trim();
    if(key==='user-agent') {
      if(!current||hasRules){current={agents:[],rules:[]};groups.push(current);hasRules=false;}
      current.agents.push(val.toLowerCase());
    } else if(current) {current.rules.push({type:key,path:val});hasRules=true;}
  }
  const who=agent.toLowerCase();
  const specific=groups.filter(g=>g.agents.includes(who));
  const use=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
  // We access only the homepage and public /competitions/ detail URLs.
  for(const path of ['/', '/competitions/example']) {
    const rules=use.flatMap(g=>g.rules).filter(r=>r.path && path.startsWith(r.path.replace(/\*.*$/,'')));
    rules.sort((a,b)=>b.path.length-a.path.length);
    if(rules.length && rules[0].type==='disallow') return false;
  }
  return true;
}