import {money, getValueMetrics, percentageDrop, getObservedDrop, normalizeItem} from './value.mjs';

const $ = id => document.getElementById(id);
const LABELS = {dashboard:['Overview','THE RADAR / ALL LISTINGS','Competition radar','Publicly listed prize draws, organised for easier comparison.'],drops:['Price drops','TRACKED / PRICE MOVEMENTS','Price drops','Tracked reductions and discounts shown by the promoter.'],value:['Best value','COMPARISON / FULL ALLOCATION','Value comparisons','Only fixed-prize draws with confirmed ticket limits are ranked.'],watching:['My watchlist','PERSONAL / SAVED ON DEVICE','Your watchlist','Competition prices you chose to follow on this device.']};
const ICONS = {Cash:'£',Cars:'🚗',Tech:'⌘',Experiences:'✈',Lifestyle:'♢',Instant:'⚡',Other:'◈'};
const STORAGE_KEY = 'prizepulse-watchlist-v1';
let screen = 'dashboard';
let category = 'All';
let sort = 'drops';
let search = '';
let items = [];
let sourceMode = 'loading';
let checkedAt = null;
let initialised = false;
let sampleNoticeDismissed = false;
let toastTimer;
let activeItem = null;
let watches = loadWatches();

function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function fmtDate(iso){if(!iso||Number.isNaN(Date.parse(iso)))return 'Not available';return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/London'}).format(new Date(iso));}
function fmtNum(n){return Number.isFinite(n)?new Intl.NumberFormat('en-GB').format(n):'Unknown';}
function loadWatches(){try{const o=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');if(o&&typeof o==='object'&&!Array.isArray(o))return o;}catch{}return {};}
function persistWatches(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(watches));}catch{toast('Cannot save watchlist: storage is disabled.');}}
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3600);}
function isWatched(item){return Object.hasOwn(watches,item.id);}
function toggleWatch(item){if(isWatched(item)){delete watches[item.id];toast('Removed from your watchlist.');}else{watches[item.id]={pricePence:item.pricePence,addedAt:new Date().toISOString()};toast('Watching this prize on this device.');}persistWatches();render();if(activeItem?.id===item.id)openDetails(item.id);}
function updateWatchStats(){const n=Object.keys(watches).length;$('sidebarWatchCount').textContent=n;$('watchCountTiny').textContent=n;$('statWatching').textContent=n;}
function calculateDrop(item){const tracked=getObservedDrop(item);if(tracked)return {pct:percentageDrop(tracked.beforePence,tracked.afterPence),old:tracked.beforePence,kind:'tracked'};
  if(Number.isInteger(item.advertisedPreviousPence)&&item.advertisedPreviousPence>item.pricePence)
    return {pct:percentageDrop(item.advertisedPreviousPence,item.pricePence),old:item.advertisedPreviousPence,kind:'advertised'};
  return null;
}
function renderStats(){
 $('statTotal').textContent=fmtNum(items.length);
 $('statDiscounts').textContent=fmtNum(items.filter(x=>x.advertisedPreviousPence>x.pricePence).length);
 $('statRanked').textContent=fmtNum(items.filter(x=>getValueMetrics(x)).length);
 updateWatchStats();
 $('lastChecked').textContent=checkedAt ? `Last checked: ${fmtDate(checkedAt)}` : 'No recent check';
 const status=$('dataStatus');status.className=`data-status ${sourceMode==='live'?'live':'demo'}`;
 const name=sourceMode==='live'?'LIVE PUBLIC SNAPSHOT':sourceMode==='import'?'LOCAL IMPORT':sourceMode==='loading'?'CHECKING SOURCE':'PREVIEW DATA ONLY';
 status.querySelector('span:last-child').textContent=name;
 $('sampleNotice').hidden=sourceMode!=='sample'||sampleNoticeDismissed;
}
function valueMarkup(item){const value=getValueMetrics(item);if(!value)return `<div class="unranked">${item.instantWin?'Separate mechanics':'Insufficient data'}</div><div class="value-sub">Not ranked</div>`;
 return `<div class="value-amount">${value.valuePercent.toFixed(1)}% <span>gross ratio</span></div><div class="value-sub">At max ticket allocation</div>`;
}
function cardMarkup(item){
 const drop=calculateDrop(item),watch=isWatched(item);
 const categoryClass=(item.category||'Other').toLowerCase();
 const discount=drop?`<span class="discount-label ${drop.kind==='advertised'?'advertised':''}">↓ ${drop.pct.toFixed(0)}%</span>`:'';
 const previous=drop?`<s>${money(drop.old)}</s> ${discount}`:`<span>No published markdown</span>`;
 const sold=Number.isFinite(item.soldPercent)?`${item.soldPercent.toFixed(0)}%`:'—';
 const notices=[...(drop?[`<span class="mini-badge ${drop.kind==='advertised'?'warn':''}">${drop.kind==='advertised'?'Advertised discount':'Recorded drop'}</span>`]:[]),...(item.instantWin?['<span class="mini-badge instant">Instant wins</span>']:[])].join('');
 const watchChange=watches[item.id]&&item.pricePence<watches[item.id].pricePence;
 return `<article class="prize-card" aria-label="${escapeHTML(item.title)}">
  <div class="card-main"><div class="prize-icon ${categoryClass}">${escapeHTML(ICONS[item.category]||ICONS.Other)}</div><div class="card-text"><div class="card-label"><span class="tiny-dot"></span>${escapeHTML(item.category.toUpperCase())}</div><h3 class="card-title">${escapeHTML(item.title)}</h3><div class="card-badges">${notices}${watchChange?'<span class="mini-badge">Below watch price</span>':''}</div></div></div>
  <div class="card-price"><div class="card-column-label">TICKET PRICE</div><div class="ticket-price">${money(item.pricePence)}</div><div class="was-price">${previous}</div></div>
  <div class="card-sold"><div class="card-column-label">TICKETS SOLD</div><div class="sold-percent">${sold}</div><div class="sold-bar"><div class="sold-fill" style="width:${Math.max(0,Math.min(100,item.soldPercent||0))}%"></div></div><div class="value-sub">${Number.isInteger(item.entriesSold)?fmtNum(item.entriesSold)+' entries recorded':'Promoter percentage'}</div></div>
  <div class="last-column"><div class="value-cell"><div class="card-column-label">VALUE CHECK</div><div>${valueMarkup(item)}</div></div><div class="card-buttons"><button class="watch-btn ${watch?'is-watched':''}" aria-label="${watch?'Stop watching':'Watch'} ${escapeHTML(item.title)}" title="${watch?'Stop watching':'Add to watchlist'}" data-action="watch" data-id="${escapeHTML(item.id)}">${watch?'★':'☆'}</button><button class="detail-btn" aria-label="Details for ${escapeHTML(item.title)}" title="Details" data-action="details" data-id="${escapeHTML(item.id)}">↗</button></div></div>
 </article>`;
}
function getVisibleItems(){let list=items;
 if(screen==='drops')list=list.filter(x=>calculateDrop(x));
 if(screen==='value')list=list.filter(x=>getValueMetrics(x));
 if(screen==='watching')list=list.filter(x=>isWatched(x));
 if(category!=='All')list=list.filter(x=>x.category===category);
 if(search)list=list.filter(x=>`${x.title} ${x.category}`.toLowerCase().includes(search.toLowerCase()));
 const dropMagnitude=x=>calculateDrop(x)?.pct??-1;
 return [...list].sort((a,b)=>{
   if(sort==='drops')return dropMagnitude(b)-dropMagnitude(a)||a.title.localeCompare(b.title);
   if(sort==='value')return (getValueMetrics(b)?.valueRatio??-1)-(getValueMetrics(a)?.valueRatio??-1)||a.title.localeCompare(b.title);
   if(sort==='lowprice')return a.pricePence-b.pricePence||a.title.localeCompare(b.title);
   if(sort==='sold')return (b.soldPercent??-1)-(a.soldPercent??-1);
   return a.title.localeCompare(b.title);
 });
}
function render(){renderStats();
 const [crumb,kicker,title,sub]=LABELS[screen];
 $('screenCrumb').textContent=crumb;$('sectionKicker').textContent=kicker;$('sectionTitle').firstChild.textContent=title+' ';$('sectionSub').textContent=sub;
 $('hero').hidden=screen!=='dashboard';$('explainer').hidden=false;
 document.querySelectorAll('[data-screen]').forEach(btn=>btn.classList.toggle('active',btn.dataset.screen===screen));
 document.querySelectorAll('[data-category]').forEach(btn=>btn.classList.toggle('active',btn.dataset.category===category));
 const list=getVisibleItems();$('shownCount').textContent=list.length;$('footCounter').textContent=`${list.length} / ${items.length} competitions`;
 $('listDescription').textContent=`${sourceMode==='live'?'Public feed':sourceMode==='import'?'Local file':'Sample dataset'} · ${list.length} matching listings`;
 $('prizeList').innerHTML=list.length?list.map(cardMarkup).join(''):`<div class="empty-state"><strong>${screen==='watching'?'Your watchlist is empty':screen==='value'?'No comparable prizes in this selection':'No competitions found'}</strong><p>${screen==='watching'?'Tap ☆ on a prize to start watching its price.':screen==='value'?'Cash prize and maximum tickets must both be known. Try another category.':'Try a different search or filter.'}</p></div>`;
}
function setScreen(next){if(!LABELS[next])return;screen=next;category='All';search='';$('searchInput').value='';if(next==='value'){$('sortSelect').value='value';sort='value';}else if(next==='drops'){$('sortSelect').value='drops';sort='drops';}render();$('competitions').scrollIntoView({behavior:'smooth',block:'start'});}
function buildChart(history){const pts=(history||[]).filter(x=>Number.isInteger(x.pricePence)&&x.at&&!Number.isNaN(Date.parse(x.at)));
 if(pts.length<2)return '<div class="chart-placeholder">History will appear after at least two recorded snapshots.</div>';
 const prices=pts.map(p=>p.pricePence),min=Math.min(...prices),max=Math.max(...prices),margin=Math.max(1,(max-min)*.25),a=Math.max(0,min-margin),b=max+margin;
 const x=i=>17+(i/(pts.length-1))*326,y=p=>136-((p-a)/(b-a||1))*112;
 const path=pts.map((p,i)=>`${i===0?'M':'L'}${x(i).toFixed(1)},${y(p.pricePence).toFixed(1)}`).join(' ');
 const dots=pts.map((p,i)=>`<circle cx="${x(i).toFixed(1)}" cy="${y(p.pricePence).toFixed(1)}" r="3.2" fill="#c0f878"/>`).join('');
 return `<svg class="price-chart" viewBox="0 0 360 155" preserveAspectRatio="none" role="img" aria-label="Recorded entry ticket price history"><path d="M15 25 H345 M15 76 H345 M15 136 H345" stroke="#36454b" stroke-dasharray="3 7" fill="none"/><path d="${path}" stroke="#c0f878" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>${dots}<text x="5" y="13" fill="#8b9b9b" font-size="10">${escapeHTML(money(max))}</text><text x="6" y="151" fill="#8b9b9b" font-size="10">${escapeHTML(money(min))}</text></svg>`;
}
function detailRow(key,value){return `<div class="detail-row"><span>${escapeHTML(key)}</span><strong>${escapeHTML(value)}</strong></div>`;}
function openDetails(id){const item=items.find(x=>x.id===id);if(!item)return;activeItem=item;
 const val=getValueMetrics(item),discount=calculateDrop(item),watch=isWatched(item);
 const details=`<div class="drawer-inner"><span class="detail-eyebrow">PRIZE / ${escapeHTML(item.category.toUpperCase())}</span><div class="detail-top-icon">${escapeHTML(ICONS[item.category]||ICONS.Other)}</div><h2>${escapeHTML(item.title)}</h2><p class="drawer-lead">An independent look at the publicly listed ticket price and sale figures.</p><div class="detail-price">${money(item.pricePence)} <small>per ticket</small></div>
 ${discount?`<p class="mini-badge ${discount.kind==='advertised'?'warn':''}" style="display:inline-block">${discount.kind==='advertised'?'Operator-advertised':'Independently observed'} decrease from ${money(discount.old)} (${discount.pct.toFixed(1)}%)</p>`:''}
 <div class="detail-chart"><div class="detail-chart-head"><h3>Recorded price history</h3><span>${(item.history||[]).length} readings</span></div>${buildChart(item.history)}</div>
 ${detailRow('Tickets sold',Number.isInteger(item.entriesSold)?fmtNum(item.entriesSold):Number.isFinite(item.soldPercent)?`${item.soldPercent}% (approx.)`:'Not available')}
 ${detailRow('Maximum allocated entries',fmtNum(item.maxEntries))}
 ${detailRow('Cash alternative',money(item.cashAlternativePence))}
 ${detailRow('Published closing',item.closingLabel||'Verify on source')}
 ${detailRow('Comparison status',val?`${val.valuePercent.toFixed(1)}% gross ratio at maximum tickets`:(item.instantWin?'Instant win – separate mechanics':'Insufficient data'))}
 ${detailRow('Last checked',fmtDate(item.checkedAt||checkedAt))}
 <div class="detail-disclaimer">${val?`Full-allocation estimate: ${money(Math.round(val.grossReturnPence))} gross prize value per ticket at ${fmtNum(item.maxEntries)} maximum entries. It is not a payout or an estimate of the final win probability.`:'This draw is not ranked without verified prize mechanics, a fixed prize value and maximum ticket allocation.'} The final number of entries may change, and free/postal tickets, discounts and prize conditions affect comparisons.</div>
 <div class="detail-actions"><button class="secondary-button" id="drawerWatch" data-action="watch" data-id="${escapeHTML(item.id)}">${watch?'★ Watching':'☆ Add to watchlist'}</button><a class="primary-button" href="${escapeHTML(item.url)}" rel="noopener noreferrer" target="_blank">Check official page ↗</a></div><div class="detail-disclaimer">18+ only. PrizePulse does not sell entries or operate the prize draw.</div></div>`;
 $('drawerContent').innerHTML=details;$('detailOverlay').hidden=false;document.body.style.overflow='hidden';$('closeDetails').focus();}
function closeOverlay(type){if(type==='detail'){$('detailOverlay').hidden=true;activeItem=null;}if(type==='method'){$('methodOverlay').hidden=true;}if($('detailOverlay').hidden&&$('methodOverlay').hidden)document.body.style.overflow='';}
function openMethod(){$('methodOverlay').hidden=false;document.body.style.overflow='hidden';$('closeMethod').focus();}
function checkWatchedPrices(){let n=0;for(const item of items){const saved=watches[item.id];if(saved&&Number.isInteger(saved.pricePence)&&item.pricePence<saved.pricePence)n++;}if(n)toast(`${n} watched prize${n>1?'s are':' is'} below your saved price.`);}
async function refreshData(showToast=false){
 $('refreshButton').disabled=true;
 try{
  const response=await fetch('/api/competitions',{cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error(`API returned ${response.status}`);
  const data=await response.json();
  if(data.status!=='live'||!Array.isArray(data.items)||!data.items.length)throw new Error('Monitor has not collected a live snapshot yet');
  const next=data.items.map(normalizeItem).filter(Boolean);
  if(!next.length)throw new Error('No valid live records');
  items=next;checkedAt=data.checkedAt;sourceMode='live';
  $('monitorWarning').hidden=!data.monitorWarning;
  if(data.monitorWarning)$('monitorWarningText').textContent=data.monitorWarning;
  if(showToast)toast(`Updated ${items.length} competitions from the monitor.`);
 }catch(err){
  if(!initialised){
   try{const resp=await fetch('/samples/official-snapshot.json');const data=await resp.json();items=data.items.map(normalizeItem).filter(Boolean);checkedAt=data.checkedAt;sourceMode='sample';}
   catch{items=[];sourceMode='sample';checkedAt=null;}
  }else if(showToast){toast(sourceMode==='live'?'Live feed temporarily unavailable; keeping previous prices.':'No live monitor configured yet. Showing preview data.');}
 }
 initialised=true;render();checkWatchedPrices();$('refreshButton').disabled=false;
}
function importSnapshot(file){
 if(!file||file.size>2_000_000){toast('Please select a JSON file smaller than 2 MB.');return;}
 const reader=new FileReader();reader.onload=()=>{try{
   const json=JSON.parse(reader.result),rows=Array.isArray(json)?json:json.items;
   if(!Array.isArray(rows)||rows.length>2000)throw new Error('Expected an array of at most 2,000 competitions');
   const accepted=rows.map(normalizeItem).filter(Boolean);
   if(!accepted.length)throw new Error('No valid competition records');
   items=accepted;checkedAt=typeof json.checkedAt==='string'?json.checkedAt:new Date().toISOString();sourceMode='import';
   $('monitorWarning').hidden=true;render();checkWatchedPrices();toast(`Imported ${accepted.length} local records — not a live feed.`);
 }catch(e){toast(`Import failed: ${e.message}`);}};reader.readAsText(file);
}

// Controls are deliberately real, keyboard accessible, and operate without user accounts.
document.querySelectorAll('[data-screen]').forEach(el=>el.addEventListener('click',()=>setScreen(el.dataset.screen)));
document.querySelectorAll('[data-category]').forEach(el=>el.addEventListener('click',()=>{category=el.dataset.category;render();}));
$('topWatchButton').addEventListener('click',()=>setScreen('watching'));
$('heroWatchButton').addEventListener('click',()=>setScreen('watching'));
$('exploreButton').addEventListener('click',()=>$('competitions').scrollIntoView({behavior:'smooth',block:'start'}));
$('searchInput').addEventListener('input',e=>{search=e.target.value.trim();render();});
$('sortSelect').addEventListener('change',e=>{sort=e.target.value;render();});
$('refreshButton').addEventListener('click',()=>refreshData(true));
$('dismissNotice').addEventListener('click',()=>{sampleNoticeDismissed=true;$('sampleNotice').hidden=true;});
$('uploadButton').addEventListener('click',()=>$('snapshotInput').click());
$('snapshotInput').addEventListener('change',e=>{importSnapshot(e.target.files?.[0]);e.target.value='';});
$('aboutButton').addEventListener('click',openMethod);
$('readMethodButton').addEventListener('click',openMethod);
$('closeDetails').addEventListener('click',()=>closeOverlay('detail'));
$('closeMethod').addEventListener('click',()=>closeOverlay('method'));
document.querySelectorAll('[data-close]').forEach(el=>el.addEventListener('click',()=>closeOverlay(el.dataset.close)));
document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const item=items.find(x=>x.id===button.dataset.id);if(!item)return;if(button.dataset.action==='watch')toggleWatch(item);if(button.dataset.action==='details')openDetails(item.id);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeOverlay('detail');closeOverlay('method');}if(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){event.preventDefault();$('searchInput').focus();}});
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
refreshData();