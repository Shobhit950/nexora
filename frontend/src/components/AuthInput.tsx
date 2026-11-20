import { Eye, EyeOff, X } from 'lucide-react';
import { useId, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';

type Props = ComponentPropsWithoutRef<'input'> & {
  label: string;
  error?: string;
  icon: ReactNode;
  onClear?: () => void;
};

export function AuthInput({ label, error, icon, type, onClear, ...props }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const description = [props['aria-describedby'], error ? id + '-error' : ''].filter(Boolean).join(' ');

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <span className="input-icon" aria-hidden="true">{icon}</span>
        <input {...props} ref={inputRef} id={id} type={isPassword && visible ? 'text' : type} aria-invalid={Boolean(error)} aria-describedby={description || undefined} />
        {isPassword && <button type="button" className="input-action" aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
        {onClear && props.value && (
          <button
            type="button"
            className="input-action"
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => {
              inputRef.current?.focus();
              onClear();
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      {error && <span className="field-error" id={id + '-error'}>{error}</span>}
    </div>
  );
}
