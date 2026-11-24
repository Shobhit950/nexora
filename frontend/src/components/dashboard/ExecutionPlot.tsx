import { useEffect, useEffectEvent, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ExecutionCanvas } from './ExecutionCanvas';
import { executionAxisMaximum, plotBounds, type SeriesVisibility } from './executionChartOptions';
import { ExecutionNavigator } from './ExecutionNavigator';
import { ExecutionTooltip } from './ExecutionReadout';
import {
  clamp, executionSeries, zoomWindow, type ExecutionBucket, type ExecutionDataset, type ExecutionMode,
  type ExecutionSeries, type ExecutionWindow,
} from './executionData';

type ExecutionPlotProps = {
  dataset: ExecutionDataset;
  mode: ExecutionMode;
  view: ExecutionWindow;
  visible: readonly ExecutionBucket[];
  visibility: SeriesVisibility;
  emphasis: ExecutionSeries | null;
  pinned: ExecutionBucket | undefined;
  reducedMotion: boolean;
  onViewChange: (view: ExecutionWindow) => void;
  onPin: (time: number, focusDetails?: boolean) => void;
};

export function ExecutionPlot({
  dataset, mode, view, visible, visibility, emphasis, pinned, reducedMotion, onViewChange, onPin,
}: ExecutionPlotProps) {
  const plot = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, number>());
  const drag = useRef<{ pointer: number; x: number; start: number; moved: boolean } | null>(null);
  const pinch = useRef<{ distance: number; view: ExecutionWindow; anchor: number } | null>(null);
  const lastWheel = useRef(-Infinity);
  const [hover, setHover] = useState<number | null>(null);
  const [brush, setBrush] = useState<ExecutionWindow | null>(null);
  const [direct, setDirect] = useState(false);
  const [keyboardActive, setKeyboardActive] = useState(false);
  const helpId = useId();
  const hovered = pinned ?? visible.find(bucket => bucket.start === hover);
  const activeIndex = hovered ? visible.indexOf(hovered) : -1;
  const activeFraction = (activeIndex + 0.5) / visible.length;
  const maximum = executionAxisMaximum(visible, mode);
  const length = dataset.buckets.length;
  const hasData = visible.length > 0;

  function fractionAt(clientX: number) {
    const bounds = plot.current!.getBoundingClientRect();
    return clamp((clientX - bounds.left) / bounds.width, 0, 1);
  }

  function indexAt(clientX: number) {
    return Math.min(visible.length - 1, Math.floor(fractionAt(clientX) * visible.length));
  }

  const handleWheel = useEffectEvent((event: WheelEvent) => {
    if (event.ctrlKey || pointers.current.size || (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY))) return;
    const delta = event.shiftKey ? event.deltaY || event.deltaX : event.deltaX;
    if (!delta) return;
    event.preventDefault();
    if (event.timeStamp - lastWheel.current < 75) return;
    lastWheel.current = event.timeStamp;
    const size = visible.length;
    const next = delta < 0 ? Math.min(size - 1, size * 0.82) : Math.max(size + 1, size / 0.82);
    onViewChange(zoomWindow(view, next, length, fractionAt(event.clientX)));
  });

  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => handleWheel(event);
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [hasData]);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || pointers.current.size >= 2) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, event.clientX);
    setKeyboardActive(false);
    if (pointers.current.size === 2) {
      const [first, second] = pointers.current.values();
      pinch.current = { distance: Math.max(12, Math.abs(second - first)), view, anchor: fractionAt((first + second) / 2) };
      drag.current = null;
      setBrush(null);
      setHover(null);
      setDirect(true);
      return;
    }
    drag.current = { pointer: event.pointerId, x: event.clientX, start: indexAt(event.clientX), moved: false };
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, event.clientX);
    if (pinch.current && pointers.current.size === 2) {
      const [first, second] = pointers.current.values();
      const { distance, anchor, view: initial } = pinch.current;
      const factor = distance / Math.max(12, Math.abs(second - first));
      onViewChange(zoomWindow(initial, (initial.end - initial.start) * factor, length, anchor));
      return;
    }
    const index = indexAt(event.clientX);
    const current = drag.current;
    if (current?.pointer === event.pointerId) {
      current.moved ||= Math.abs(event.clientX - current.x) >= 7;
      if (current.moved && event.pointerType !== 'touch') {
        setBrush({ start: Math.min(index, current.start), end: Math.max(index, current.start) + 1 });
      }
      return;
    }
    if (!pointers.current.size && event.pointerType !== 'touch') setHover(visible[index].start);
  }

  function pointerEnd(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    if (!pointers.current.delete(event.pointerId)) return;
    if (pinch.current) {
      pinch.current = null;
      setDirect(false);
    }
    const current = drag.current;
    drag.current = null;
    setBrush(null);
    if (cancelled || current?.pointer !== event.pointerId) return;
    const index = indexAt(event.clientX);
    if (current.moved || Math.abs(event.clientX - current.x) >= 7) {
      if (event.pointerType !== 'touch' && index !== current.start) {
        onViewChange({ start: view.start + Math.min(index, current.start), end: view.start + Math.max(index, current.start) + 1 });
      }
    } else {
      onPin(visible[index].start, event.pointerType === 'touch');
    }
  }

  if (!visible.length) return <p className="execution-empty">No execution activity for this range.</p>;

  const showHover = hovered && activeIndex >= 0 && !brush && !direct;
  return (
    <div className="execution-stage">
      <ExecutionCanvas dataset={dataset} visible={visible} mode={mode} visibility={visibility} emphasis={emphasis}
        reducedMotion={reducedMotion} maximum={maximum} directManipulation={direct} />
      <p id={helpId} className="sr-only">Use Left and Right to explore periods, Home or End to jump, and Enter or Space to pin a period.</p>
      <div className="execution-plot" style={plotBounds} ref={plot} tabIndex={0} role="group"
        aria-label="Execution timeline" aria-describedby={helpId}
        onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerLeave={() => setHover(null)}
        onPointerUp={event => pointerEnd(event)} onPointerCancel={event => pointerEnd(event, true)}
        onLostPointerCapture={event => pointerEnd(event, true)}
        onBlur={() => { if (keyboardActive) setHover(null); setKeyboardActive(false); }}
        onKeyDown={event => {
          const current = activeIndex < 0 ? -1 : activeIndex;
          let next: number;
          switch (event.key) {
            case 'Home': next = 0; break;
            case 'End': next = visible.length - 1; break;
            case 'ArrowLeft': next = current < 0 ? 0 : Math.max(0, current - 1); break;
            case 'ArrowRight': next = Math.min(visible.length - 1, current + 1); break;
            case 'Enter':
            case ' ':
              event.preventDefault();
              onPin(visible[Math.max(0, current)].start, true);
              return;
            default: return;
          }
          event.preventDefault();
          if (pinned) onPin(pinned.start);
          setKeyboardActive(true);
          setHover(visible[next].start);
        }}>
        {!visibility.successful && !visibility.failed && <span className="execution-plot-message">Both series are hidden</span>}
        {brush && (
          <div className="execution-brush" aria-hidden="true" style={{
            left: `${brush.start / visible.length * 100}%`, width: `${(brush.end - brush.start) / visible.length * 100}%`,
          }} />
        )}
        {showHover && (
          <div className="execution-crosshair" style={{ left: `${activeFraction * 100}%` }} aria-hidden="true">
            {executionSeries.map(({ key }) => {
              if (!visibility[key]) return null;
              const offset = mode === 'bars' && key === 'failed' && visibility.successful ? hovered.successful : 0;
              return <span key={key} className="execution-marker" data-series={key}
                style={{ top: `${(1 - (hovered[key] + offset) / maximum) * 100}%` }} />;
            })}
          </div>
        )}
        <div className="sr-only" aria-live="polite">
          {keyboardActive && hovered && <ExecutionTooltip bucket={hovered} resolution={dataset.resolution} />}
        </div>
      </div>
      <AnimatePresence>
        {showHover && !pinned && (
          <motion.div className="execution-tooltip-rail" style={plotBounds} aria-hidden="true"
            initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.13 }}>
            <div className="execution-tooltip" data-side={activeFraction <= 0.5 ? 'right' : 'left'} style={{
              '--point-x': `${activeFraction * 100}%`,
              '--point-y': `${(1 - hovered.successful / maximum) * 100}%`,
            } as CSSProperties}>
              <ExecutionTooltip bucket={hovered} resolution={dataset.resolution} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ExecutionNavigator dataset={dataset} view={view} onChange={onViewChange} onDrag={setDirect} />
    </div>
  );
}
