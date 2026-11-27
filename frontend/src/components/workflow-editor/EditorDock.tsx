import { X } from 'lucide-react';
import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

const editorTabs = [{ id: 'settings', label: 'Node Settings' }, { id: 'results', label: 'Execution Results' }] as const;
type EditorTab = typeof editorTabs[number]['id'];

export function InspectorTabs({ tab, onChange, settings, results }: {
  tab: EditorTab;
  onChange: (tab: EditorTab) => void;
  settings: ReactNode;
  results: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <div className="editor-inspector-tabs" role="tablist" aria-label="Workflow inspector views">
        {editorTabs.map(({ id: key, label }) => (
          <button key={key} id={id + '-tab-' + key} type="button" role="tab" tabIndex={key === tab ? 0 : -1}
            aria-selected={key === tab} aria-controls={id + '-panel-' + key} onClick={() => onChange(key)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === 'Home' ? 'settings' : event.key === 'End' ? 'results' : key === 'settings' ? 'results' : 'settings';
              onChange(next);
              document.getElementById(id + '-tab-' + next)?.focus();
            }}>{label}</button>
        ))}
      </div>
      {editorTabs.map(({ id: key }) => (
        <div key={key} className="editor-tab-panel" role="tabpanel" id={id + '-panel-' + key}
          aria-labelledby={id + '-tab-' + key} hidden={key !== tab}>
          {key === 'settings' ? settings : results}
        </div>
      ))}
    </>
  );
}

export function EditorDock({ id, label, left = false, overlay, open, onClose, children }: {
  id: string;
  label: string;
  left?: boolean;
  overlay: boolean;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = dialog.current;
    if (overlay && open) element?.showModal();
    return () => element?.close();
  }, [overlay, open]);

  if (!overlay) return <aside id={id} aria-label={label} className="editor-dock" data-left={left} hidden={!open}>{children}</aside>;

  return (
    <dialog ref={dialog} id={id} aria-label={label} className="editor-dock editor-drawer" data-left={left}
      onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className="editor-drawer-bar">
        <strong>{label}</strong>
        <button type="button" className="editor-button editor-run-icon" aria-label={'Close ' + label.toLowerCase()} onClick={onClose}>
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function InspectorResize({ width, onChange }: { width: number; onChange: (width: number) => void }) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const adjust = (value: number) => onChange(Math.min(410, Math.max(275, value)));

  return (
    <div className="editor-dock-resize" role="separator" tabIndex={0} aria-label="Resize inspector" aria-orientation="vertical"
      aria-valuemin={275} aria-valuemax={410} aria-valuenow={width}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width };
      }}
      onPointerMove={event => {
        if (drag.current) adjust(drag.current.width + drag.current.x - event.clientX);
      }}
      onLostPointerCapture={() => { drag.current = null; }}
      onKeyDown={event => {
        const values = { ArrowLeft: width + 12, ArrowRight: width - 12, Home: 275, End: 410 };
        if (!Object.hasOwn(values, event.key)) return;
        event.preventDefault();
        adjust(values[event.key as keyof typeof values]);
      }}
    />
  );
}
