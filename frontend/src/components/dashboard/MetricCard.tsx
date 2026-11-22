import type { LucideIcon } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useEffect } from 'react';
import { moveSpotlight } from './spotlight';

type MetricCardProps = {
  label: string;
  value: number | null;
  icon: LucideIcon;
  tone: 'violet' | 'cyan' | 'green' | 'rose';
  order: number;
};

const numberFormat = new Intl.NumberFormat();

export function MetricCard({ label, value, icon: Icon, tone, order }: MetricCardProps) {
  const reducedMotion = useReducedMotion();
  const counter = useMotionValue(reducedMotion ? value ?? 0 : 0);
  const display = useTransform(counter, number => numberFormat.format(Math.round(number)));

  useEffect(() => {
    if (value === null) return;
    if (reducedMotion) {
      counter.jump(value);
      return;
    }

    const animation = animate(counter, value, { duration: .8, delay: order * .07, ease: 'easeOut' });
    return () => animation.stop();
  }, [counter, order, reducedMotion, value]);

  return (
    <motion.div
      className="dashboard-metric dashboard-surface dashboard-spotlight"
      data-tone={tone}
      onPointerMove={moveSpotlight}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : .34, delay: reducedMotion ? 0 : order * .07 }}
    >
      <dt>{label}</dt>
      <dd>
        {value === null ? <><span className="sr-only">Unavailable</span><span aria-hidden="true">?</span></> : <>
          <span className="sr-only">{numberFormat.format(value)}</span>
          <motion.span aria-hidden="true">{display}</motion.span>
        </>}
      </dd>
      <span className="dashboard-metric-icon" aria-hidden="true"><Icon size={20} /></span>
    </motion.div>
  );
}
