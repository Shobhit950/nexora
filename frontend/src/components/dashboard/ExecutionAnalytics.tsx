import { ChartColumn, ChartNoAxesCombined, Minus, Plus, RotateCcw } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { SeriesVisibility } from './executionChartOptions';
import { ExecutionPlot } from './ExecutionPlot';
import { ExecutionDetail } from './ExecutionReadout';
import {
  executionRanges, executionSeries, formatCount, formatPeriod, formatRate, formatWindow, summarizeExecutions, zoomWindow,
  type ExecutionDataset, type ExecutionMode, type ExecutionRange, type ExecutionSeries, type ExecutionWindow,
} from './executionData';
import './executionAnalytics.css';

type ExecutionAnalyticsProps = {
  range: ExecutionRange;
  dataset: ExecutionDataset;
  onRangeChange: (range: ExecutionRange) => void;
};

const modes = [
  { value: 'area', label: 'Area', Icon: ChartNoAxesCombined },
  { value: 'bars', label: 'Stacked bars', Icon: ChartColumn },
] as const;

export default function ExecutionAnalytics({ range, dataset, onRangeChange }: ExecutionAnalyticsProps) {
  const reduce = Boolean(useReducedMotion());
  const groupId = useId();
  const [mode, setMode] = useState<ExecutionMode>('area');
  const [viewport, setViewport] = useState<ExecutionWindow | null>(null);
  const [visibility, setVisibility] = useState<SeriesVisibility>({ successful: true, failed: true });
  const [hoverSeries, setHoverSeries] = useState<ExecutionSeries | null>(null);
  const [focusSeries, setFocusSeries] = useState<ExecutionSeries | null>(null);
  const [pinnedTime, setPinnedTime] = useState<number | null>(null);
  const focusDetail = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const inspector = useRef<HTMLSelectElement>(null);
  const length = dataset.buckets.length;
  const start = viewport?.start ?? 0;
  const end = viewport?.end ?? length;
  const visible = useMemo(() => dataset.buckets.slice(start, end), [dataset, start, end]);
  const counts = useMemo(() => summarizeExecutions(visible), [visible]);
  const zoomed = start !== 0 || end !== length;
  const pinned = visible.find(bucket => bucket.start === pinnedTime);
  const highlight = hoverSeries ?? focusSeries;
  const emphasis = highlight && visibility[highlight] ? highlight : null;
  const demo = dataset.source === 'demo';

  function changeWindow(next: ExecutionWindow) {
    if (next.start === start && next.end === end) return;
    setViewport(next.start === 0 && next.end === length ? null : next);
    if (pinnedTime !== null && !dataset.buckets.slice(next.start, next.end).some(bucket => bucket.start === pinnedTime)) {
      setPinnedTime(null);
    }
  }

  function pin(time: number, focus = false) {
    focusDetail.current = focus && time !== pinnedTime;
    setPinnedTime(time === pinnedTime ? null : time);
  }

  function changeRange(next: ExecutionRange) {
    if (next === range) return;
    focusDetail.current = false;
    setViewport(null);
    setPinnedTime(null);
    onRangeChange(next);
  }

  useLayoutEffect(() => {
    if (pinned && focusDetail.current) {
      focusDetail.current = false;
      closeButton.current?.focus();
    }
  }, [pinned]);

  function closeDetail() {
    if (document.activeElement === closeButton.current) inspector.current?.focus({ preventScroll: true });
    setPinnedTime(null);
  }

  const metrics = [
    { label: 'Total executions', value: formatCount(counts.total) },
    { label: 'Successful', value: formatCount(counts.successful), series: 'successful' },
    { label: 'Failed', value: formatCount(counts.failed), series: 'failed' },
    { label: 'Success rate', value: formatRate(counts.successRate) },
  ] as const;
  const transition = reduce ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 35 } as const;

  return (
    <section className="dashboard-surface execution-analytics" aria-labelledby="execution-activity-title"
      onKeyDown={event => {
        if (pinned && event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          closeDetail();
        }
      }}>
      <header className="execution-heading">
        <div className="execution-heading-copy">
          <div className="execution-heading-title">
            <h2 id="execution-activity-title">Execution Activity</h2>
            {demo && <span className="execution-demo-badge">Demo data</span>}
          </div>
          {demo && <p>Sample execution counts for this preview.</p>}
        </div>
        <div className="execution-segmented" role="group" aria-label="Execution date range">
          {executionRanges.map(({ value, label, description }) => (
            <button type="button" key={value} aria-pressed={range === value} aria-label={description} title={description}
              onClick={() => changeRange(value)}>
              {range === value && <motion.span className="execution-segment-indicator" aria-hidden="true"
                layoutId={groupId + '-range'} transition={transition} />}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </header>

      <dl className="execution-metrics" aria-label="Visible execution totals">
        {metrics.map(metric => {
          const series = 'series' in metric ? metric.series : null;
          return (
            <div key={metric.label} data-series={series} data-highlight={series !== null && series === emphasis}
              onPointerEnter={() => setHoverSeries(series)} onPointerLeave={() => setHoverSeries(null)}>
              <dt>{metric.label}</dt><dd>{metric.value}</dd>
            </div>
          );
        })}
      </dl>

      <div className="execution-chart-card">
        <div className="execution-toolbar">
          <div className="execution-caption">
            <p role="status">{visible.length ? formatWindow(visible[0], visible[visible.length - 1], dataset.resolution) : 'No periods'}</p>
            <span>{dataset.resolution === 'hour' ? 'Hourly' : 'Daily'}</span>
          </div>
          <div className="execution-segmented execution-modes" role="group" aria-label="Chart mode">
            {modes.map(({ value, label, Icon }) => (
              <button key={value} type="button" aria-pressed={mode === value} aria-label={label} title={label}
                onClick={() => setMode(value)}>
                {mode === value && <motion.span className="execution-segment-indicator" aria-hidden="true"
                  layoutId={groupId + '-mode'} transition={transition} />}
                <Icon size={14} aria-hidden="true" /><span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="execution-chart-actions">
          <div className="execution-legend" role="group" aria-label="Visible series">
            {executionSeries.map(({ key, label }) => (
              <button type="button" key={key} aria-pressed={visibility[key]} data-series={key} data-highlight={key === emphasis}
                onPointerEnter={() => setHoverSeries(key)} onPointerLeave={() => setHoverSeries(null)}
                onFocus={() => setFocusSeries(key)} onBlur={() => setFocusSeries(null)}
                onClick={() => setVisibility(previous => ({ ...previous, [key]: !previous[key] }))}>
                <span className="execution-dot" data-series={key} />{label}
              </button>
            ))}
          </div>
          <div className="execution-zoom" role="group" aria-label="Zoom controls">
            <button className="execution-icon-button" type="button" aria-label="Zoom in" title="Zoom in"
              disabled={visible.length <= 2}
              onClick={() => changeWindow(zoomWindow({ start, end }, Math.floor(visible.length / 1.5), length))}>
              <Plus size={15} aria-hidden="true" />
            </button>
            <button className="execution-icon-button" type="button" aria-label="Zoom out" title="Zoom out" disabled={!zoomed}
              onClick={() => changeWindow(zoomWindow({ start, end }, Math.ceil(visible.length * 1.5), length))}>
              <Minus size={15} aria-hidden="true" />
            </button>
            <button className="execution-icon-button execution-reset" type="button" disabled={!zoomed}
              aria-label="Reset zoom" title="Reset zoom" onClick={() => changeWindow({ start: 0, end: length })}>
              <RotateCcw size={14} aria-hidden="true" /><span>Reset zoom</span>
            </button>
          </div>
        </div>

        <ExecutionPlot dataset={dataset} view={{ start, end }} visible={visible} mode={mode} visibility={visibility}
          emphasis={emphasis} pinned={pinned} reducedMotion={reduce} onViewChange={changeWindow} onPin={pin} />

        <div className="execution-chart-footer">
          <p className="execution-gesture-hint">Drag to zoom · Shift + scroll</p>
          <label className="execution-inspector">
            <span>Inspect period</span>
            <select ref={inspector} value={pinnedTime ?? ''} disabled={!visible.length}
              onChange={event => event.target.value ? pin(Number(event.target.value), true) : closeDetail()}>
              <option value="">Choose a period</option>
              {visible.map(({ start }) => (
                <option key={start} value={start}>{formatPeriod(start, dataset.resolution)}</option>
              ))}
            </select>
          </label>
        </div>
        {pinned && <ExecutionDetail bucket={pinned} resolution={dataset.resolution} onClose={closeDetail} closeRef={closeButton} demo={demo} />}
      </div>
    </section>
  );
}
