export const executionRanges = [
  { value: 1, label: '24H', description: 'Last 24 hours' },
  { value: 7, label: '7D', description: 'Last 7 days' },
  { value: 30, label: '30D', description: 'Last 30 days' },
  { value: 90, label: '90D', description: 'Last 90 days' },
] as const;

export type ExecutionRange = typeof executionRanges[number]['value'];
export type ExecutionResolution = 'hour' | 'day';
export type ExecutionBucket = { start: number; successful: number; failed: number };
export type ExecutionDataset = {
  resolution: ExecutionResolution;
  buckets: readonly ExecutionBucket[];
  source: 'demo' | 'live';
};

export type ExecutionActivitySource = {
  getDataset(range: ExecutionRange): ExecutionDataset;
};

export type ExecutionWindow = { start: number; end: number }; // Start inclusive, end exclusive.
export type ExecutionSeries = 'successful' | 'failed';
export type ExecutionMode = 'area' | 'bars';

export const executionSeries = [
  { key: 'successful', label: 'Successful', color: '#a699ff' },
  { key: 'failed', label: 'Failed', color: '#fb879b' },
] as const;

export function executionTotals(successful: number, failed: number) {
  const total = successful + failed;
  return { successful, failed, total, successRate: total ? successful / total : null };
}

export function summarizeExecutions(buckets: readonly ExecutionBucket[]) {
  let successful = 0;
  let failed = 0;
  for (const bucket of buckets) {
    successful += bucket.successful;
    failed += bucket.failed;
  }
  return executionTotals(successful, failed);
}

const number = new Intl.NumberFormat();
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const hour = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
});
const date = new Intl.DateTimeFormat(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

export const formatCount = (value: number) => number.format(value);
export const formatRate = (value: number | null) => value === null ? '—' : percent.format(value);
export const formatAxis = (start: number, resolution: ExecutionResolution) =>
  (resolution === 'hour' ? hour : day).format(start);
export const formatPeriod = (start: number, resolution: ExecutionResolution) =>
  resolution === 'hour' ? `${date.format(start)} · ${hour.format(start)} UTC` : date.format(start);

export function formatWindow(first: ExecutionBucket, last: ExecutionBucket, resolution: ExecutionResolution) {
  const firstDay = day.format(first.start);
  const lastDay = day.format(last.start);
  if (resolution === 'day') return `${firstDay}–${lastDay} · UTC`;
  const endingHour = hour.format(last.start + 3_600_000);
  const end = endingHour === '00:00' ? '24:00' : endingHour;
  const lastLabel = firstDay === lastDay ? end : `${lastDay} ${end}`;
  return `${firstDay} · ${hour.format(first.start)}–${lastLabel} UTC`;
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function zoomWindow(view: ExecutionWindow, size: number, length: number, anchor = 0.5): ExecutionWindow {
  const nextSize = clamp(Math.round(size), Math.min(2, length), length);
  const start = clamp(Math.round(view.start + (view.end - view.start - nextSize) * anchor), 0, length - nextSize);
  return { start, end: start + nextSize };
}

export function panWindow(view: ExecutionWindow, offset: number, length: number): ExecutionWindow {
  const size = view.end - view.start;
  const start = clamp(view.start + offset, 0, length - size);
  return { start, end: start + size };
}
