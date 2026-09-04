const DAY_MS = 24 * 60 * 60 * 1000;

export function getShanghaiISODate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  ) as Record<string, string>;

  return `${values.year}-${values.month}-${values.day}`;
}

export function getCurrentUserWeekIndex(userStartDate: string, now: Date = new Date()): number {
  const start = Date.parse(`${userStartDate}T00:00:00.000Z`);
  const current = Date.parse(`${getShanghaiISODate(now)}T00:00:00.000Z`);
  const diff = Math.floor((current - start) / DAY_MS);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

export function getPreviousClosedWeekIndex(userStartDate: string, now: Date = new Date()): number | null {
  const current = getCurrentUserWeekIndex(userStartDate, now);
  return current > 1 ? current - 1 : null;
}
