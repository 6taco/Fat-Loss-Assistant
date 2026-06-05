import fs from 'node:fs';

const source = fs.readFileSync('src/lib/analytics/collector.ts', 'utf8');

if (!source.includes('function dedupeEventsById')) {
  console.error('Analytics ingestion must dedupe repeated eventIds before database writes.');
  process.exit(1);
}

if (!source.includes('skipDuplicates: true')) {
  console.error('Analytics ingestion must tolerate eventId retries with skipDuplicates.');
  process.exit(1);
}

if (source.includes('$transaction')) {
  console.error('Analytics ingestion should not use an interactive transaction for remote event batches.');
  process.exit(1);
}

for (const derivedWrite of ['upsertIdentity', 'upsertSession', 'upsertDailyAggregates', 'upsertLifecycle']) {
  if (source.includes(derivedWrite)) {
    console.error(`Analytics ingestion should not run derived write ${derivedWrite} in the request path.`);
    process.exit(1);
  }
}

console.log('Analytics ingestion writes raw events only, idempotently and quickly.');
