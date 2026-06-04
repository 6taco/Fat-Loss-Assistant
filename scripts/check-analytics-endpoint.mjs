import fs from 'node:fs';

const clientSource = fs.readFileSync('src/lib/analytics/client.ts', 'utf8');
const pageSource = fs.readFileSync('src/app/analytics/page.tsx', 'utf8');

if (!clientSource.includes("const ENDPOINT = '/api/app-events'")) {
  console.error('Analytics client must send events to /api/app-events.');
  process.exit(1);
}

if (clientSource.includes("const ENDPOINT = '/api/analytics/events'")) {
  console.error('Analytics client should not use /api/analytics/events as the default endpoint.');
  process.exit(1);
}

if (!pageSource.includes('/api/app-metrics?days=30')) {
  console.error('Analytics dashboard must read metrics from /api/app-metrics.');
  process.exit(1);
}

if (pageSource.includes('/api/analytics/summary')) {
  console.error('Analytics dashboard should not use /api/analytics/summary as the default endpoint.');
  process.exit(1);
}

console.log('Analytics UI uses deploy-safe event and metric endpoints.');
