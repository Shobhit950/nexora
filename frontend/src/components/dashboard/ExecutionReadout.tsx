import { X } from 'lucide-react';
import { useId, type Ref } from 'react';
import {
  executionSeries, executionTotals, formatCount, formatPeriod, formatRate, type ExecutionBucket, type ExecutionResolution,
} from './executionData';

type ReadoutProps = { bucket: ExecutionBucket; resolution: ExecutionResolution };

function ReadoutValues({ bucket }: Pick<ReadoutProps, 'bucket'>) {
  const values = executionTotals(bucket.successful, bucket.failed);
  return (
    <dl className="execution-readout-values">
      {executionSeries.map(({ key, label }) => (
        <div key={key}><dt><span className="execution-dot" data-series={key} />{label}</dt>
          <dd>{formatCount(values[key])}</dd></div>
      ))}
      <div><dt>Total executions</dt><dd>{formatCount(values.total)}</dd></div>
      <div><dt>Success rate</dt><dd>{formatRate(values.successRate)}</dd></div>
    </dl>
  );
}

export function ExecutionTooltip({ bucket, resolution }: ReadoutProps) {
  return (
    <>
      <p className="execution-readout-title">{formatPeriod(bucket.start, resolution)}</p>
      <ReadoutValues bucket={bucket} />
    </>
  );
}

export function ExecutionDetail({ bucket, resolution, onClose, closeRef, demo }: ReadoutProps & {
  onClose: () => void;
  closeRef: Ref<HTMLButtonElement>;
  demo: boolean;
}) {
  const title = useId();
  const values = executionTotals(bucket.successful, bucket.failed);
  const success = (values.successRate ?? 0) * 100;
  return (
    <section className="execution-detail" aria-labelledby={title}>
      <div className="execution-detail-heading">
        <div>
          <p className="execution-detail-label">{demo ? 'Demo period' : 'Inspected period'}</p>
          <h3 id={title} className="execution-readout-title">{formatPeriod(bucket.start, resolution)}</h3>
        </div>
        <button ref={closeRef} type="button" className="execution-icon-button" aria-label="Close period details" onClick={onClose}>
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      {values.total > 0 && (
        <div className="execution-breakdown" aria-hidden="true">
          <span style={{ width: `${success}%` }} /><span style={{ width: `${100 - success}%` }} />
        </div>
      )}
      <ReadoutValues bucket={bucket} />
    </section>
  );
}
