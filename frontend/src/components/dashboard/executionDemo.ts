const dailyCounts = [
  [12, 2], [15, 1], [13, 3], [18, 2], [16, 2], [21, 4], [17, 1],
  [22, 3], [19, 2], [24, 3], [20, 5], [25, 2], [22, 2], [26, 4],
  [24, 3], [20, 1], [28, 4], [25, 2], [31, 6], [27, 3], [33, 4],
  [26, 2], [28, 3], [22, 2], [31, 5], [26, 2], [37, 4], [32, 2],
  [41, 6], [36, 3],
];

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const dailyExecutions = dailyCounts.map(([successful, failed], index) => {
  const date = new Date(Date.UTC(2026, 10, 20 - (dailyCounts.length - 1 - index)));
  return { date: dateFormat.format(date), successful, failed };
});

export const executionRanges = [7, 30] as const;
export type ExecutionRange = typeof executionRanges[number];

function summarize(days: ExecutionRange) {
  const data = dailyExecutions.slice(-days);
  return {
    data,
    label: data[0].date + ' – ' + data[data.length - 1].date,
    successful: data.reduce((total, day) => total + day.successful, 0),
    failed: data.reduce((total, day) => total + day.failed, 0),
  };
}

export const demoExecutionActivity = { 7: summarize(7), 30: summarize(30) };
