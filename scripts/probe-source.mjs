import { collect } from '../lib/monitor.mjs';
import { safeMonitorError } from '../lib/run-monitor.mjs';

try {
  const snapshot=await collect();
  console.log('SOURCE_PROBE_OK',JSON.stringify({count:snapshot.count,checkedAt:snapshot.checkedAt,examples:snapshot.items.slice(0,4).map(({id,pricePence,soldPercent})=>({id,pricePence,soldPercent}))}));
} catch(error) {
  console.error('SOURCE_PROBE_UNAVAILABLE',safeMonitorError(error));
  console.error('Technical detail:',String(error));
  process.exitCode=1;
}
