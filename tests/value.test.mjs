import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoneyPence, money, getValueMetrics, normalizeItem, percentageDrop} from '../lib/value.mjs';

test('UK money formats use pence safely',()=>{
  assert.equal(parseMoneyPence('17p'),17);
  assert.equal(parseMoneyPence('£0.07'),7);
  assert.equal(parseMoneyPence('£2,000'),200000);
  assert.equal(parseMoneyPence('£1.25K'),125000);
  assert.equal(parseMoneyPence('£1M'),100000000);
  assert.equal(parseMoneyPence('free'),null);
  assert.equal(money(75),'75p');
  assert.equal(money(100),'£1.00');
});

test('value comparison requires a fixed single prize and a verified cap',()=>{
  const sample={pricePence:99,cashAlternativePence:125000,maxEntries:5000,instantWin:false};
  const metrics=getValueMetrics(sample);
  assert.ok(metrics);
  assert.equal(metrics.grossReturnPence,25);
  assert.ok(Math.abs(metrics.valuePercent-25.2525)<0.001);
  assert.equal(getValueMetrics({...sample,maxEntries:null}),null);
  assert.equal(getValueMetrics({...sample,instantWin:true}),null);
  assert.equal(getValueMetrics({...sample,variablePrize:true}),null);
  assert.equal(getValueMetrics({...sample,multipleWinners:true}),null);
  assert.equal(getValueMetrics({...sample,pricePence:0}),null);
  assert.equal(percentageDrop(20,15),25);
});

test('untrusted imports cannot point to non-official pages',()=>{
  const valid=normalizeItem({title:'Entry',url:'https://thatprizeguy.co.uk/competitions/valid-prize',pricePence:17});
  assert.equal(valid.id,'valid-prize');
  assert.equal(normalizeItem({title:'Bad',url:'https://evil.test/competitions/valid-prize',pricePence:17}),null);
  assert.equal(normalizeItem({title:'Bad',url:'https://thatprizeguy.co.uk/competitions/valid-prize',pricePence:-1}),null);
});