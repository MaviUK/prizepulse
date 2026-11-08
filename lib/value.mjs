/** GBP minor units: all prices and monetary amounts are integers in pence. */
export function parseMoneyPence(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : null;
  if (typeof value !== 'string') return null;
  const raw = value.trim().replace(/,/g, '').replace(/\s/g, '');
  const match = raw.match(/^(?:\u00a3|GBP)?(\d+(?:\.\d+)?)([kKmM])?(p|pence)?$/);
  if (!match) return null;
  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'k') amount *= 1000;
  if (unit === 'm') amount *= 1_000_000;
  return Math.round(amount * (match[3] ? 1 : 100));
}

export function money(pence) {
  if (!Number.isFinite(pence)) return 'Unknown';
  if (pence < 100) return `${pence}p`;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(pence / 100);
}

/**
 * Lower-bound, full-allocation, single-winning-entry value estimate.
 * Never use for instant wins, variable prize pools, unknown cap/prize, or free entry.
 * Does not predict final odds or guarantee a return.
 */
export function getValueMetrics(item) {
  const price = item.pricePence;
  const value = item.prizeValuePence ?? item.cashAlternativePence;
  const cap = item.maxEntries;
  if (item.instantWin || item.variablePrize || item.multipleWinners || item.hasUnknownMechanics ||
      !Number.isInteger(price) || price <= 0 || !Number.isInteger(value) || value <= 0 ||
      !Number.isInteger(cap) || cap <= 0) return null;
  const grossReturnPence = value / cap;
  const valueRatio = grossReturnPence / price;
  return {
    grossReturnPence,
    valueRatio,
    valuePercent: valueRatio * 100,
    entryCostPence: price,
    maximumEntries: cap,
    soldPercent: Number.isFinite(item.soldPercent) ? item.soldPercent : null
  };
}

export function percentageDrop(before, after) {
  if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after)) return null;
  return ((before - after) / before) * 100;
}

export function getObservedDrop(item) {
  const events = Array.isArray(item.priceEvents) ? item.priceEvents : [];
  return events.filter(e => e.afterPence < e.beforePence).at(-1) ?? null;
}

export function normalizeItem(item) {
  const url = typeof item.url === 'string' && /^https:\/\/thatprizeguy\.co\.uk\/competitions\/[-a-z0-9]+\/?(?:\?.*)?$/i.test(item.url) ? item.url : null;
  if (!url || typeof item.title !== 'string' || !Number.isInteger(item.pricePence) || item.pricePence < 0) return null;
  return {
    id: url.split('/competitions/')[1].split(/[/?#]/)[0],
    title: item.title.trim().slice(0, 160), url,
    category: ['Cash','Cars','Tech','Experiences','Lifestyle','Instant'].includes(item.category) ? item.category : 'Other',
    pricePence: item.pricePence,
    advertisedPreviousPence: Number.isInteger(item.advertisedPreviousPence) ? item.advertisedPreviousPence : null,
    prizeValuePence: Number.isInteger(item.prizeValuePence) ? item.prizeValuePence : null,
    cashAlternativePence: Number.isInteger(item.cashAlternativePence) ? item.cashAlternativePence : null,
    maxEntries: Number.isInteger(item.maxEntries) ? item.maxEntries : null,
    entriesSold: Number.isInteger(item.entriesSold) ? item.entriesSold : null,
    soldPercent: Number.isFinite(item.soldPercent) ? Math.max(0,Math.min(100,item.soldPercent)) : null,
    closingLabel: typeof item.closingLabel === 'string' ? item.closingLabel.slice(0,100) : null,
    instantWin: Boolean(item.instantWin), variablePrize: Boolean(item.variablePrize),
    multipleWinners: Boolean(item.multipleWinners), hasUnknownMechanics: Boolean(item.hasUnknownMechanics),
    history: Array.isArray(item.history) ? item.history.slice(-240) : [],
    priceEvents: Array.isArray(item.priceEvents) ? item.priceEvents.slice(-80) : [],
    checkedAt: typeof item.checkedAt === 'string' ? item.checkedAt : null,
    detailCheckedAt: typeof item.detailCheckedAt === 'string' ? item.detailCheckedAt : null
  };
}