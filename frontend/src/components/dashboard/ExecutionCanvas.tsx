import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent } from 'echarts/components';
import { init, use as registerCharts, type EChartsType } from 'echarts/core';
import { UniversalTransition } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { buildExecutionChart, type ExecutionCanvasProps } from './executionChartOptions';

registerCharts([LineChart, BarChart, GridComponent, CanvasRenderer, UniversalTransition]);

export function ExecutionCanvas({
  dataset, visible, mode, visibility, emphasis, maximum, reducedMotion, directManipulation,
}: ExecutionCanvasProps) {
  const element = useRef<HTMLDivElement>(null);
  const instance = useRef<EChartsType | null>(null);
  const option = useMemo(() => buildExecutionChart({
    dataset, visible, mode, visibility, emphasis, maximum, reducedMotion, directManipulation,
  }), [dataset, visible, mode, visibility, emphasis, maximum, reducedMotion, directManipulation]);

  useLayoutEffect(() => {
    const node = element.current!;
    const chart = init(node, null, { renderer: 'canvas' });
    instance.current = chart;
    let width = node.clientWidth;
    let height = node.clientHeight;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nextWidth = node.clientWidth;
        const nextHeight = node.clientHeight;
        if (nextWidth === width && nextHeight === height) return;
        width = nextWidth;
        height = nextHeight;
        chart.resize({ width, height });
      });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      chart.dispose();
      instance.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    instance.current?.setOption(option, { replaceMerge: ['series'] });
  }, [option]);

  return <div className="execution-canvas" ref={element} aria-hidden="true" />;
}
