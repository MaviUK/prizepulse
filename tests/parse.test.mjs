import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHomepageHtml,parseDetailHtml,canMonitorRobots,cleanText} from '../lib/parse.mjs';
import {collect} from '../lib/monitor.mjs';

const fixture=`<html><body>
<h3>Norwegian Fjords Cruise</h3><div>£2.5K cash alternative <span>Per entry</span> <s>Previously 99p</s> <b>75p</b><div>75% Sold</div><a href="/competitions/norwegian-fjords-cruise">Enter now: Norwegian Fjords Cruise</a></div>
<h3>Amsterdam Trip for 2 + £500 Cash</h3><div>£1.25K cash alternative <span>Per entry</span> 99p <span>22%</span> Sold <a href="/competitions/amsterdam-for-2-ps500-cash-or-ps1250-cash-alt-2-7589">Enter now: Amsterdam Trip for 2 + £500 Cash</a></div>
<h3>Norwegian Fjords Cruise</h3><div>£2.5K cash alternative Per entry Previously 99p 75p 75% Sold <a href="/competitions/norwegian-fjords-cruise">Enter now: Norwegian Fjords Cruise</a></div>
</body></html>`;
const detail=`<html><body><h1>Amsterdam Trip</h1> Auto Draw TOMORROW 11:30pm £1,250 Cash Alternative 3% Cashback 22% 3,905 Tickets Left 1,095 / 5,000 Maximum tickets per user: 100 Postal entries to this competition receive 1 tickets. Free Entry Route</body></html>`;

test('homepage parser extracts price from Per entry, not from title or cash prize',()=>{
  const rows=parseHomepageHtml(fixture);
  assert.equal(rows.length,2);
  const cruise=rows.find(x=>x.id==='norwegian-fjords-cruise');
  assert.ok(cruise);
  assert.equal(cruise.pricePence,75);
  assert.equal(cruise.advertisedPreviousPence,99);
  assert.equal(cruise.cashAlternativePence,250000);
  assert.equal(cruise.soldPercent,75);
  assert.equal(rows.find(x=>x.id.startsWith('amsterdam')).pricePence,99);
});

test('detail parser extracts exact allocations and cash amount',()=>{
  const d=parseDetailHtml(detail);
  assert.equal(d.maxEntries,5000);
  assert.equal(d.entriesSold,1095);
  assert.equal(d.cashAlternativePence,125000);
  assert.equal(d.postalTickets,1);
  assert.equal(d.cashbackPercent,3);
});

test('robot instructions are respected',()=>{
  assert.equal(canMonitorRobots('User-agent: *\nDisallow: /'),false);
  assert.equal(canMonitorRobots('User-agent: *\nDisallow: /account\nAllow: /'),true);
  assert.equal(canMonitorRobots('User-agent: *\nDisallow: /competitions/'),false);
  assert.equal(canMonitorRobots('User-agent: Other\nDisallow: /\nUser-agent: PrizePulsePriceMonitor\nAllow: /'),true);
});

test('scheduled collector detects an independently observed change and retains history',async()=>{
  const requests=[];
  const fake=async url=>{
    requests.push(url);
    if(url.endsWith('/robots.txt'))return new Response('User-agent: *\nAllow: /',{status:200,headers:{'content-type':'text/plain'}});
    if(url.includes('/competitions/'))return new Response(detail,{status:200,headers:{'content-type':'text/html'}});
    return new Response(fixture,{status:200,headers:{'content-type':'text/html'}});
  };
  const old=[{id:'norwegian-fjords-cruise',url:'https://thatprizeguy.co.uk/competitions/norwegian-fjords-cruise',pricePence:99,history:[{at:'2026-11-07T20:00:00Z',pricePence:99}],priceEvents:[]}];
  const response=await collect('2026-11-08T20:00:00Z',fake,old);
  assert.equal(response.status,'live');
  assert.equal(response.count,2);
  const cruise=response.items.find(x=>x.id==='norwegian-fjords-cruise');
  assert.equal(cruise.priceEvents.length,1);
  assert.deepEqual(cruise.priceEvents[0],{at:'2026-11-08T20:00:00Z',beforePence:99,afterPence:75});
  assert.equal(cruise.history.length,2);
  assert.ok(requests.some(x=>x.endsWith('/robots.txt')));
});