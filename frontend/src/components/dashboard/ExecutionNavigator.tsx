import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { navigatorBounds } from './executionChartOptions';
import { clamp, formatPeriod, panWindow, type ExecutionDataset, type ExecutionWindow } from './executionData';

type DragTarget = 'start' | 'end' | 'window';
type NavigatorProps = {
  dataset: ExecutionDataset;
  view: ExecutionWindow;
  onChange: (view: ExecutionWindow) => void;
  onDrag: (dragging: boolean) => void;
};

export function ExecutionNavigator({ dataset, view, onChange, onDrag }: NavigatorProps) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; target: DragTarget; origin: number; view: ExecutionWindow } | null>(null);
  const length = dataset.buckets.length;
  const minimum = Math.min(2, length);
  const left = view.start / length * 100;
  const right = view.end / length * 100;

  function moveHandle(target: 'start' | 'end', value: number, previous = view) {
    return target === 'start'
      ? { ...previous, start: clamp(value, 0, previous.end - minimum) }
      : { ...previous, end: clamp(value, previous.start + minimum, length) };
  }

  function startDrag(event: PointerEvent<HTMLDivElement>, target: DragTarget) {
    if (event.button !== 0 || drag.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, target, origin: event.clientX, view };
    onDrag(true);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointer || !rail.current) return;
    const offset = Math.round((event.clientX - current.origin) / rail.current.clientWidth * length);
    onChange(current.target === 'window'
      ? panWindow(current.view, offset, length)
      : moveHandle(current.target, current.view[current.target] + offset, current.view));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    onDrag(false);
  }

  function keyMove(event: KeyboardEvent<HTMLDivElement>, target: 'start' | 'end') {
    const direction = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key];
    if (direction !== undefined) {
      event.preventDefault();
      onChange(event.shiftKey ? panWindow(view, direction, length) : moveHandle(target, view[target] + direction));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      onChange(moveHandle(target, event.key === 'Home' ? 0 : length));
    }
  }

  const pointerEvents = { onPointerMove: moveDrag, onPointerUp: endDrag, onLostPointerCapture: endDrag, onPointerCancel: endDrag };

  return (
    <>
      <span className="execution-navigator-label" style={{ left: navigatorBounds.left }}>Timeline navigator</span>
      <div className="execution-navigator" style={navigatorBounds} ref={rail} role="group" aria-label="Timeline navigator">
        <div className="execution-navigator-shade" style={{ right: `${100 - left}%` }} />
        <div className="execution-navigator-shade" style={{ left: `${right}%` }} />
        <div className="execution-navigator-window" style={{ left: `${left}%`, right: `${100 - right}%` }}
          onPointerDown={event => startDrag(event, 'window')} {...pointerEvents} />
        {(['start', 'end'] as const).map(target => {
          const isStart = target === 'start';
          const index = isStart ? view.start : view.end - 1;
          const position = isStart ? left : right;
          return (
            <div key={target} className="execution-navigator-handle" data-edge={target} style={{ left: `${position}%` }}
              role="slider" tabIndex={0} aria-label={isStart ? 'Visible range start' : 'Visible range end'}
              aria-valuemin={isStart ? 1 : view.start + minimum}
              aria-valuemax={isStart ? view.end - minimum + 1 : length}
              aria-valuenow={index + 1} aria-valuetext={formatPeriod(dataset.buckets[index].start, dataset.resolution)}
              onPointerDown={event => startDrag(event, target)} onKeyDown={event => keyMove(event, target)} {...pointerEvents}>
              <span aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </>
  );
}
