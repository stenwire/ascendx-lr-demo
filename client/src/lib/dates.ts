/**
 * Date-only helpers.
 *
 * The API returns full ISO datetimes (Prisma DateTime), but leave requests are
 * conceptually whole days. Everything here works on the UTC calendar date so a
 * range never shifts by a day for viewers west of GMT.
 */

const MS_PER_DAY = 86_400_000;

/** "2026-03-07T00:00:00.000Z" -> "2026-03-07" */
export function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Parses a date key or ISO string to a UTC-midnight Date. */
export function parseDateKey(value: string): Date {
  const [y, m, d] = toDateKey(value).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days from a to b. Same day = 0. */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Inclusive day count of a leave request: a single-day request is 1 day. */
export function inclusiveDayCount(startIso: string, endIso: string): number {
  return daysBetween(parseDateKey(startIso), parseDateKey(endIso)) + 1;
}

const monthDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthDayYear = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("en-GB", { weekday: "narrow", timeZone: "UTC" });

/** "7 Mar" */
export function formatDay(iso: string | Date): string {
  return monthDay.format(typeof iso === "string" ? parseDateKey(iso) : iso);
}

/** "7 Mar 2026" */
export function formatFullDate(iso: string | Date): string {
  return monthDayYear.format(typeof iso === "string" ? parseDateKey(iso) : iso);
}

/** "3 – 7 Mar 2026", collapsing a single day to "3 Mar 2026". */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = parseDateKey(startIso);
  const end = parseDateKey(endIso);
  if (start.getTime() === end.getTime()) return monthDayYear.format(start);
  return `${monthDay.format(start)} – ${monthDayYear.format(end)}`;
}

/** "M" / "T" / "W" — column headers on the availability timeline. */
export function formatWeekdayInitial(date: Date): string {
  return weekdayShort.format(date);
}

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Full timestamp for audit-style metadata. */
export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Today as "YYYY-MM-DD", for date-input min attributes. */
export function todayInputValue(): string {
  return todayUtc().toISOString().slice(0, 10);
}
