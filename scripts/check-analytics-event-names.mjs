import fs from 'node:fs';

const typesSource = fs.readFileSync('src/lib/analytics/types.ts', 'utf8');
const collectorSource = fs.readFileSync('src/lib/analytics/collector.ts', 'utf8');

const typeBlock = typesSource.match(/export type AnalyticsEventName =([\s\S]*?);/);
if (!typeBlock) {
  throw new Error('Unable to find AnalyticsEventName type block.');
}

const declared = [...typeBlock[1].matchAll(/\|\s*'([^']+)'/g)].map(match => match[1]);

const validatorBlock = collectorSource.match(/export function isAnalyticsEventName[\s\S]*?\[([\s\S]*?)\]\.includes/);
if (!validatorBlock) {
  throw new Error('Unable to find isAnalyticsEventName validator list.');
}

const accepted = [...validatorBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
const missing = declared.filter(eventName => !accepted.includes(eventName));
const extra = accepted.filter(eventName => !declared.includes(eventName));

if (missing.length || extra.length) {
  console.error(JSON.stringify({ missing, extra }, null, 2));
  process.exit(1);
}

console.log(`Analytics event validator covers ${declared.length} declared events.`);
