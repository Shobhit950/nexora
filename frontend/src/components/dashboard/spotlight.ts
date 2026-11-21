import type { PointerEvent } from 'react';

export function moveSpotlight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return;

  const target = event.currentTarget;
  const bounds = target.getBoundingClientRect();
  target.style.setProperty('--spot-x', event.clientX - bounds.left + 'px');
  target.style.setProperty('--spot-y', event.clientY - bounds.top + 'px');
}
