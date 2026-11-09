// ==UserScript==
// @name         PrizePulse Browser Connector
// @namespace    https://pulseprize.netlify.app/
// @version      0.2.0
// @description  Opt-in public competition price capture from a page you are viewing. No login or payment data.
// @match        https://thatprizeguy.co.uk/
// @match        https://thatprizeguy.co.uk/categories/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      pulseprize.netlify.app
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';
  const pageUrl=new URL(location.href);
  if (pageUrl.pathname.replace(/\/$/,'')!=='/categories/all')return;
  const loadedAt=new Date().toISOString();
  let timer=null, busy=false;
  const get=(key,def)=>GM_getValue('prizepulse-'+key,def);
  const put=(key,value)=>GM_setValue('prizepulse-'+key,value);
  const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const amtPence=value=>{
    const raw=String(value||'').replace(/[,\s]/g,'');
    const m=raw.match(/^(£)?(\d+(?:\.\d+)?)([kKmM])?(p)?$/);
    if(!m)return null;
    let v=Number(m[2]);
    if(m[3]?.toLowerCase()==='k')v*=1000;
    if(m[3]?.toLowerCase()==='m')v*=1000000;
    return Number.isFinite(v)?Math.round(v*(m[4]?1:100)):null;
  };
  const prices=text=>[...String(text).matchAll(/£\s*\d[\d,.]*\s*[kKmM]?|\d+(?:\.\d+)?\s*p\b/gi)].map(m=>amtPence(m[0])).filter(Number.isInteger);
  const category=title=>{
    const t=title.toLowerCase();
    if(/instant|instants|plinko/.test(t))return 'Instant';
    if(/car|bmw|audi|ford|mercedes|lamborghini|porsche|golf r|vehicle|volkswagen|range rover/.test(t))return 'Cars';
    if(/phone|ipad|iphone|laptop|macbook|playstation|nintendo|samsung|tech|ps5|switch/.test(t))return 'Tech';
    if(/trip|cruise|holiday|spa|hotel|concert|tickets to|disney on ice/.test(t))return 'Experiences';
    if(/£\s*\d|cash|million|money/.test(t))return 'Cash';
    return 'Lifestyle';
  };
  function extractCards(){
    const records=new Map();
    for(const titleEl of document.querySelectorAll('h3')){
      const title=titleEl.textContent?.replace(/\s+/g,' ').trim();
      if(!title||title.length>155)continue;
      let card=null,root=titleEl;
      for(let depth=0;depth<7&&root;depth++,root=root.parentElement){
        const text=(root.innerText||root.textContent||'').replace(/\s+/g,' ').trim();
        if(text.length>2200)break;
        if(!/Per\s+entry/i.test(text)||!/(\d{1,3})\s*%\s*Sold\b/i.test(text))continue;
        const link=titleEl.closest('a[href*="/competitions/"]')||root.querySelector('a[href*="/competitions/"]');
        if(!link)continue;
        const headingCount=root.querySelectorAll('h3').length;
        if(headingCount!==1)continue;
        card={root,text,link};break;
      }
      if(!card)continue;
      let url;
      try{
        url=new URL(card.link.href,location.href);
        if(url.origin!=='https://thatprizeguy.co.uk'||!/^\/competitions\/[a-z0-9-]+\/?$/i.test(url.pathname))continue;
      }catch{continue;}
      const per=card.text.split(/Per\s+entry/i)[1]||'';
      const priceString=per.split(/\b\d{1,3}\s*%\s*Sold\b/i)[0].slice(0,200);
      const amounts=prices(priceString);
      if(!amounts.length)continue;
      const sold=card.text.match(/(\d{1,3})\s*%\s*Sold\b/i);
      const soldPercent=sold?Number(sold[1]):null;
      if(soldPercent===null||soldPercent>100)continue;
      const current=amounts.at(-1);
      if(current<0||current>100000)continue;
      const beforeEntry=card.text.split(/Per\s+entry/i)[0];
      const alternative=(beforeEntry.match(/£\s*\d[\d,.]*\s*[kKmM]?\s+cash\s+alternative\b/i)||[])[0];
      const cashAlternative=alternative?amtPence(alternative.replace(/cash\s+alternative/i,'')):null;
      const close=(card.text.match(/Closes\s+(?:Today|Tmrw|Tomorrow|[A-Za-z]+\s+\d{1,2}\s+[A-Za-z]+)(?:\s+\d{1,2}(?::\d{2})?(?:am|pm))?/i)||[])[0]||null;
      const id=url.pathname.split('/').filter(Boolean).at(-1);
      const instant=/instant\s+wins?|win\s+instantly/i.test(card.text)||category(title)==='Instant';
      records.set(id,{title,url:url.origin+url.pathname,category:instant?'Instant':category(title),pricePence:current,
        advertisedPreviousPence:amounts.length>1?amounts[0]:null,cashAlternativePence:cashAlternative,
        soldPercent,closingLabel:close,instantWin:instant,
        variablePrize:/up to|£\s*1\s*to\s*£|prize ladder|prize pool/i.test(title),
        multipleWinners:/multiple winners|instant win|instants|50\/50/i.test(title)});
    }
    return [...records.values()].slice(0,160);
  }

  const box=document.createElement('aside');
  box.id='prizepulse-collector-widget';
  box.style.cssText='position:fixed;bottom:16px;right:12px;z-index:2147483600;width:min(300px,calc(100vw - 24px));box-sizing:border-box;background:#111b20;color:#f4f6f2;border:1px solid #aac87f;padding:12px 14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 12px 36px #0008;';
  box.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong style="color:#c0f878">PRIZEPULSE</strong><a style="color:#c0f878;font-size:12px" href="https://pulseprize.netlify.app/" target="_blank" rel="noopener noreferrer">Dashboard ↗</a></div><div id="pp-result" style="padding:8px 0;word-wrap:break-word">Browser connector ready.</div><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" id="pp-key">Pair key</button><button type="button" id="pp-sync">Sync now</button><button type="button" id="pp-auto">Start 1 min</button></div><small style="display:block;margin-top:6px;color:#aeb6bb">Only visible public competition details are sent. No account, ticket or payment data.</small>`;
  document.body.appendChild(box);
  for(const button of box.querySelectorAll('button'))button.style.cssText='cursor:pointer;border:1px solid #62726b;background:#26352e;color:white;padding:7px 9px;border-radius:0;font:12px system-ui';
  const result=box.querySelector('#pp-result');
  const auto=box.querySelector('#pp-auto');
  const label=(text)=>{result.textContent=text;};
  function updateAuto(){auto.textContent=get('auto',false)?'Stop 1 min':'Start 1 min';}
  function paired(){const value=get('key','');if(value.length<24){label('Tap Pair key and paste your private PrizePulse collector key.');return null;}return value;}
  function stop(message){put('auto',false);clearTimeout(timer);timer=null;updateAuto();if(message)label(message);}
  function schedule(){clearTimeout(timer);if(!get('auto',false))return;
    // Each repeat is a normal reload of this public page in your foreground browser.
    // Never reload indefinitely when there are no valid cards or the connection is rejected.
    timer=setTimeout(()=>{if(document.visibilityState==='visible')location.reload();else stop('Paused: browser tab is not visible. Tap Start to resume.');},60000);
  }
  function sync(){
    const key=paired();if(!key||busy)return;
    const items=extractCards();
    if(items.length<2){stop('No readable public competition cards on this page. Open All competitions; automatic reload stopped.');return;}
    busy=true;label('Sending '+items.length+' public competitions…');
    const payload={pageUrl:location.origin+location.pathname,pageLoadedAt:loadedAt,capturedAt:new Date().toISOString(),items};
    GM_xmlhttpRequest({method:'POST',url:'https://pulseprize.netlify.app/api/browser-feed',timeout:15000,
      headers:{'Content-Type':'application/json','X-PrizePulse-Key':key},data:JSON.stringify(payload),
      onload:r=>{busy=false;
        let response={};try{response=JSON.parse(r.responseText||'{}');}catch{}
        if(r.status===200&&response.ok){label('Sent '+response.count+' competitions at '+new Date().toLocaleTimeString('en-GB')+'.');schedule();}
        else {stop('Sync rejected ('+r.status+'): '+(response.error||'check connection/key'));}
      },onerror:()=>{busy=false;stop('Could not connect to PrizePulse. Retry when online.');},
      ontimeout:()=>{busy=false;stop('Connection timed out. Automatic reload stopped.');}});
  }
  box.querySelector('#pp-key').addEventListener('click',()=>{
    const entered=prompt('Paste your private PrizePulse collector key (stored only inside the extension)',get('key',''));
    if(entered===null)return;
    const trimmed=entered.trim();
    if(trimmed.length<24){label('Invalid key: expected at least 24 characters.');return;}
    put('key',trimmed);label('Collector key saved in browser extension storage.');
  });
  box.querySelector('#pp-sync').addEventListener('click',sync);
  auto.addEventListener('click',()=>{if(get('auto',false)){stop('Automatic checks stopped.');return;}
    if(!paired())return;
    put('auto',true);updateAuto();sync();});
  updateAuto();
  if(get('auto',false))setTimeout(sync,1700);
})();