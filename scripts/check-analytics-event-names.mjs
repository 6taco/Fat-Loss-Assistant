import fs from 'node:fs';

const typesSource = fs.readFileSync('src/lib/analytics/types.ts', 'utf8');
const collectorSource = fs.readFileSync('src/lib/analytics/collector.ts', 'utf8');
const clientSource = fs.readFileSync('src/lib/analytics/client.ts', 'utf8');

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
const clientBlock = clientSource.match(/const VALID_EVENT_NAMES = new Set<AnalyticsEventName>\(\[([\s\S]*?)\]\);/);
if (!clientBlock) {
  throw new Error('Unable to find client VALID_EVENT_NAMES list.');
}

const clientAccepted = [...clientBlock[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
const missing = declared.filter(eventName => !accepted.includes(eventName));
const extra = accepted.filter(eventName => !declared.includes(eventName));
const clientMissing = declared.filter(eventName => !clientAccepted.includes(eventName));
const clientExtra = clientAccepted.filter(eventName => !declared.includes(eventName));

if (missing.length || extra.length || clientMissing.length || clientExtra.length) {
  console.error(JSON.stringify({ missing, extra, clientMissing, clientExtra }, null, 2));
  process.exit(1);
}

console.log(`Analytics event validator and client queue guard cover ${declared.length} declared events.`);
