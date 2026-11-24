import type { BarSeriesOption, LineSeriesOption } from 'echarts/charts';
import type { GridComponentOption } from 'echarts/components';
import { graphic, type ComposeOption } from 'echarts/core';
import {
  executionSeries, formatAxis, type ExecutionBucket, type ExecutionDataset, type ExecutionMode, type ExecutionSeries,
} from './executionData';

type ChartOption = ComposeOption<LineSeriesOption | BarSeriesOption | GridComponentOption>;

export type SeriesVisibility = Record<ExecutionSeries, boolean>;
export const plotBounds = { left: 44, right: 16, top: 12, bottom: 111 };
export const navigatorBounds = { left: plotBounds.left, right: plotBounds.right, bottom: 12, height: 42 };

const violet = '#a699ff';
const cyan = '#76dfed';
const warm = '#fb879b';
const coolRamp = new graphic.LinearGradient(0, 0, 1, 0, [
  { offset: 0, color: violet }, { offset: 1, color: cyan },
]);

export function executionAxisMaximum(buckets: readonly ExecutionBucket[], mode: ExecutionMode) {
  const peak = Math.max(0, ...buckets.map(({ successful, failed }) =>
    mode === 'bars' ? successful + failed : Math.max(successful, failed)));
  const target = (peak * 1.08) / 4;
  const unit = Math.pow(10, Math.floor(Math.log10(Math.max(1, target))));
  const step = [1, 2, 2.5, 5, 10].find(multiplier => multiplier * unit >= target) ?? 10;
  return 4 * Math.ceil(unit * step);
}

export type ExecutionCanvasProps = {
  dataset: ExecutionDataset;
  visible: readonly ExecutionBucket[];
  mode: ExecutionMode;
  visibility: SeriesVisibility;
  emphasis: ExecutionSeries | null;
  maximum: number;
  reducedMotion: boolean;
  directManipulation: boolean;
};

export function buildExecutionChart({
  dataset, visible, mode, visibility, emphasis, maximum, reducedMotion, directManipulation,
}: ExecutionCanvasProps): ChartOption {
  return {
    animation: !reducedMotion,
    animationDuration: 560,
    animationDurationUpdate: directManipulation ? 0 : 270,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    textStyle: { fontFamily: 'Manrope Variable, system-ui, sans-serif' },
    grid: [
      { ...plotBounds, outerBoundsMode: 'none' },
      { ...navigatorBounds, outerBoundsMode: 'none' },
    ],
    xAxis: [
      {
        gridIndex: 0, type: 'category', boundaryGap: true, silent: true,
        data: visible.map(({ start }) => String(start)),
        axisLine: { lineStyle: { color: '#302941' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#a49bb7', fontSize: 11, margin: 10, hideOverlap: true,
          formatter: value => formatAxis(Number(value), dataset.resolution),
        },
      },
      {
        gridIndex: 1, type: 'category', boundaryGap: true, show: false,
        data: dataset.buckets.map(({ start }) => String(start)),
      },
    ],
    yAxis: [
      {
        gridIndex: 0, type: 'value', silent: true, min: 0, max: maximum, interval: maximum / 4,
        axisLabel: { color: '#a49bb7', fontSize: 11, margin: 9 },
        splitLine: { lineStyle: { color: '#262135', type: [3, 5] } },
      },
      { gridIndex: 1, type: 'value', show: false, min: 0 },
    ],
    series: [
      ...executionSeries.map(({ key, label, color }): LineSeriesOption | BarSeriesOption => {
        const opacity = visibility[key] ? (emphasis && emphasis !== key ? 0.28 : 1) : 0;
        const success = key === 'successful';
        const stroke = success ? coolRamp : color;
        const data = visible.map(bucket => ({
          id: String(bucket.start),
          value: mode === 'bars' && !visibility[key] ? 0 : bucket[key],
        }));
        const shared = { id: key, name: label, silent: true, data, universalTransition: !reducedMotion && !directManipulation };
        if (mode === 'bars') {
          return {
            ...shared, type: 'bar', stack: 'executions', barMaxWidth: 34, barWidth: '64%',
            itemStyle: {
              color: success ? '#9484f6' : warm, opacity,
              borderRadius: success && visibility.failed ? 0 : [3, 3, 0, 0],
            },
          };
        }
        return {
          ...shared, type: 'line', smooth: 0.32, smoothMonotone: 'x', showSymbol: false,
          lineStyle: { color: stroke, width: success ? 2.5 : 2, opacity },
          areaStyle: {
            opacity,
            color: new graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: success ? '#8e79fb55' : '#f86d8a3e' },
              { offset: 1, color: success ? '#8e79fb04' : '#f86d8a03' },
            ]),
          },
        };
      }),
      {
        id: 'overview', type: 'line', silent: true, smooth: 0.24, smoothMonotone: 'x', xAxisIndex: 1, yAxisIndex: 1,
        showSymbol: false, animation: false,
        data: dataset.buckets.map(bucket => bucket.successful + bucket.failed),
        lineStyle: { color: '#9d87f1', width: 1.25 },
        areaStyle: { color: '#8870d836' },
      },
    ],
  };
}
