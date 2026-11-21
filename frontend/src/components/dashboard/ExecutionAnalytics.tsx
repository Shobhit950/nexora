import { motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { demoExecutionActivity, executionRanges, type ExecutionRange } from './executionDemo';

const series = [
  { key: 'successful', label: 'Successful', color: '#9bdff5' },
  { key: 'failed', label: 'Failed', color: '#ffa1bf' },
] as const;

type ExecutionAnalyticsProps = {
  range: ExecutionRange;
  onRangeChange: (range: ExecutionRange) => void;
};

export default function ExecutionAnalytics({ range, onRangeChange }: ExecutionAnalyticsProps) {
  const { data, label, successful, failed } = demoExecutionActivity[range];
  const reducedMotion = useReducedMotion();
  const chartId = useId();
  const ticks = data.filter((_, index) => range === 7 || index % 5 === 0 || index === data.length - 1)
    .map(day => day.date);

  return (
    <section className="dashboard-surface dashboard-analytics" aria-labelledby="execution-activity-title">
      <div className="dashboard-section-heading">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id="execution-activity-title">Execution activity</h2>
          <span className="dashboard-demo-tag">Demo data</span>
        </div>
        <div className="dashboard-range-control" role="group" aria-label="Execution date range">
          {executionRanges.map(days => (
            <button type="button" key={days} aria-pressed={days === range} onClick={() => onRangeChange(days)}>
              {days === range && <motion.span
                className="dashboard-range-indicator"
                aria-hidden="true"
                layoutId={chartId + '-range'}
                transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 35 }}
              />}
              <span className="relative">{days} days</span>
            </button>
          ))}
        </div>
      </div>
      <div className="dashboard-analytics-meta" aria-live="polite" aria-atomic="true">
        <span>{label}</span>
        <ul className="dashboard-chart-legend">
          {series.map(({ key, label: name }) => (
            <li key={key} data-series={key}>
              <span className="dashboard-chart-key" aria-hidden="true" />
              {name} <strong>{key === 'successful' ? successful : failed}</strong>
            </li>
          ))}
        </ul>
      </div>
      <div className="dashboard-chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={60} initialDimension={{ width: 320, height: 230 }}>
          <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 3 }} accessibilityLayer>
            <defs>
              {series.map(({ key, color }) => (
                <linearGradient key={key} id={chartId + key} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={.13} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="#302743" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="date" ticks={ticks} tick={{ fill: '#b7accb', fontSize: 11 }} tickLine={false}
              axisLine={false} tickMargin={10} minTickGap={16} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={28} tick={{ fill: '#b7accb', fontSize: 11 }} tickLine={false}
              axisLine={false} tickMargin={5} />
            <Tooltip
              cursor={{ stroke: '#b297e9', strokeDasharray: '4 5' }}
              contentStyle={{ background: '#191428', border: '1px solid #504063', borderRadius: 10 }}
              labelStyle={{ color: '#f4efff', fontWeight: 800 }}
              itemSorter="name"
              isAnimationActive={!reducedMotion}
            />
            {series.map(({ key, label: name, color }) => (
              <Area key={key} type="monotone" dataKey={key} name={name} stroke={color} strokeWidth={2}
                fill={'url(#' + chartId + key + ')'} activeDot={{ r: 4, stroke: '#171124', strokeWidth: 2 }}
                animationDuration={430} isAnimationActive={!reducedMotion} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
