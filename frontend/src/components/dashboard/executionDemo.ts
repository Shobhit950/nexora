import {
  executionRanges, summarizeExecutions, type ExecutionActivitySource, type ExecutionBucket, type ExecutionRange,
} from './executionData';

const hour = 60 * 60 * 1000;
const day = 24 * hour;
const end = Date.UTC(2026, 10, 21);

// One fixed hourly snapshot. Every daily count is a rollup of the same underlying hours.
function sampleHour(index: number): ExecutionBucket {
  const start = end - (90 * 24 - index) * hour;
  const date = new Date(start);
  const weekday = date.getUTCDay();
  const hours = date.getUTCHours();
  const businessHours = Math.max(0, Math.sin((hours - 4) * Math.PI / 17));
  const workday = weekday > 0 && weekday < 6 ? 1 : 0.51;
  const growth = 0.7 + Math.floor(index / 24) / 114;
  const noise = ((Math.imul(index + 1, 2654435761) >>> 19) % 23) / 23;
  const incident = index % 347 < 6 || (index >= 2148 && index <= 2151);
  const successful = Math.floor((2 + 28 * businessHours) * workday * growth * (0.52 + noise * 0.8));
  const failed = Math.floor(successful * (0.02 + noise * 0.1)) + (incident ? 4 + index % 5 : 0);
  return { start, successful, failed };
}

const hourly = Array.from({ length: 90 * 24 }, (_, index) => sampleHour(index));
const daily = Array.from({ length: 90 }, (_, index): ExecutionBucket => {
  const counts = summarizeExecutions(hourly.slice(index * 24, (index + 1) * 24));
  return { start: end - (90 - index) * day, successful: counts.successful, failed: counts.failed };
});

function sampleRange(range: ExecutionRange) {
  const resolution = range === 1 ? 'hour' : 'day';
  const buckets = range === 1 ? hourly.slice(-24) : daily.slice(-range);
  return { resolution, buckets, source: 'demo' } as const;
}

const snapshot = new Map(executionRanges.map(({ value }) => [value, sampleRange(value)]));

export const demoExecutionActivity: ExecutionActivitySource = {
  getDataset: range => snapshot.get(range)!,
};
