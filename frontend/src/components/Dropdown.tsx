import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import './dropdown.css';

export type DropdownOption<Value extends string> = {
  value: Value;
  label: string;
  icon?: LucideIcon;
  tone?: 'neutral' | 'violet' | 'green' | 'muted';
};

type DropdownProps<Value extends string> = {
  label: string;
  value: Value;
  options: readonly DropdownOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
  disabled?: boolean;
};

export function Dropdown<Value extends string>({ label, value, options, onChange, className, disabled }: DropdownProps<Value>) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listbox = useRef<HTMLUListElement>(null);
  const search = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState({ side: 'below', space: 256 });
  const reducedMotion = useReducedMotion();
  const selectedIndex = options.findIndex(option => option.value === value);
  const selected = options[selectedIndex];
  const SelectedIcon = selected?.icon;
  const unavailable = disabled || options.length === 0;
  const expanded = open && !unavailable;

  useLayoutEffect(() => {
    if (!expanded) return;
    const button = trigger.current;
    const menu = listbox.current;
    if (!button || !menu) return;

    function positionMenu() {
      if (!button || !menu) return;
      const bounds = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const below = Math.max(0, Math.floor(bottom - bounds.bottom - 14));
      const above = Math.max(0, Math.floor(bounds.top - top - 14));
      const needed = Math.min(256, menu.scrollHeight + 2);
      const placeAbove = below < needed && above > below;
      const next = { side: placeAbove ? 'above' : 'below', space: placeAbove ? above : below };
      setPlacement(previous => previous.side === next.side && previous.space === next.space ? previous : next);
    }

    positionMenu();
    menu.focus({ preventScroll: true });
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    window.visualViewport?.addEventListener('resize', positionMenu);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
      window.visualViewport?.removeEventListener('resize', positionMenu);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    if (!expanded) return;
    const menu = listbox.current;
    const item = menu?.children.item(activeIndex);
    if (!(item instanceof HTMLElement) || !menu) return;
    if (item.offsetTop < menu.scrollTop) menu.scrollTop = item.offsetTop;
    const itemBottom = item.offsetTop + item.offsetHeight;
    if (itemBottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = itemBottom - menu.clientHeight;
  }, [activeIndex, expanded, placement.space]);

  useEffect(() => {
    if (!expanded) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }

    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);

  function show(index = selectedIndex >= 0 ? selectedIndex : 0) {
    search.current = { text: '', at: 0 };
    setActiveIndex(index);
    setOpen(true);
  }

  function closeWithFocus() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function select(index: number) {
    const option = options[index];
    if (!option) return;
    closeWithFocus();
    if (option.value !== value) onChange(option.value);
  }

  function move(event: KeyboardEvent<HTMLUListElement>) {
    const last = options.length - 1;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        event.preventDefault();
        setActiveIndex(index => Math.min(last, Math.max(0, index + direction)));
        break;
      }
      case 'Home':
      case 'End':
        event.preventDefault();
        setActiveIndex(event.key === 'Home' ? 0 : last);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        select(activeIndex);
        break;
      case 'Tab':
        setOpen(false);
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        closeWithFocus();
        break;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing) return;
        event.preventDefault();
        const at = performance.now();
        const letter = event.key.toLocaleLowerCase();
        const previous = at - search.current.at < 550 ? search.current.text : '';
        const term = previous + letter;
        const find = (prefix: string) => {
          for (let offset = 1; offset <= options.length; offset++) {
            const index = (activeIndex + offset) % options.length;
            if (options[index]?.label.toLocaleLowerCase().startsWith(prefix)) return index;
          }
          return -1;
        };
        const match = find(term);
        const nextIndex = match === -1 ? find(letter) : match;
        search.current = { text: match === -1 ? letter : term, at };
        if (nextIndex !== -1) setActiveIndex(nextIndex);
      }
    }
  }

  const offset = reducedMotion ? 0 : placement.side === 'above' ? 5 : -5;
  const optionId = (index: number) => id + '-option-' + index;

  return (
    <div ref={root} className={['nx-dropdown', className].filter(Boolean).join(' ')} data-open={expanded}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button ref={trigger} type="button" className="nx-dropdown-trigger" disabled={unavailable}
        aria-label={selected ? label + ': ' + selected.label : label}
        aria-haspopup="listbox" aria-expanded={expanded} aria-controls={id}
        onClick={() => { if (expanded) closeWithFocus(); else show(); }}
        onKeyDown={event => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          show(selectedIndex >= 0 ? selectedIndex : event.key === 'ArrowUp' ? options.length - 1 : 0);
        }}>
        {SelectedIcon && <span className="nx-dropdown-icon" data-tone={selected?.tone}><SelectedIcon size={16} aria-hidden="true" /></span>}
        <span className="nx-dropdown-label">{selected?.label ?? label}</span>
        <motion.span className="nx-dropdown-chevron" aria-hidden="true" initial={false}
          animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: reducedMotion ? 0 : .19 }}>
          <ChevronDown size={15} />
        </motion.span>
      </button>
      <motion.ul id={id} ref={listbox} className="nx-dropdown-list" role="listbox" aria-label={label}
        aria-activedescendant={expanded && options[activeIndex] ? optionId(activeIndex) : undefined}
        aria-hidden={!expanded} tabIndex={-1} inert={!expanded} data-side={placement.side}
        style={{ maxHeight: Math.min(256, placement.space) }}
        initial={false}
        animate={expanded
          ? { opacity: 1, y: 0 }
          : { opacity: 0, y: offset }}
        transition={{ duration: reducedMotion ? 0 : .16, ease: 'easeOut' }}
        onKeyDown={move}
      >
        {options.map((option, index) => {
          const Icon = option.icon;
          const checked = option.value === value;
          return (
            <li key={option.value} id={optionId(index)} role="option" aria-selected={checked} data-active={index === activeIndex}
              className="nx-dropdown-option"
              onPointerMove={event => { if (event.pointerType === 'mouse') setActiveIndex(index); }}
              onMouseDown={event => event.preventDefault()}
              onClick={() => select(index)}>
              {Icon && <span className="nx-dropdown-icon" data-tone={option.tone}><Icon size={16} aria-hidden="true" /></span>}
              <span className="nx-dropdown-label">{option.label}</span>
              {checked && <Check className="nx-dropdown-check" size={16} aria-hidden="true" />}
            </li>
          );
        })}
      </motion.ul>
    </div>
  );
}

