/**
 * 获取本地日期的 ISO 格式字符串 (YYYY-MM-DD)
 * 使用本地时区，而不是 UTC 时区
 */
export function getLocalDateIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取今天的本地日期 ISO 格式字符串
 */
export function getTodayIso(): string {
  return getLocalDateIso(new Date());
}
