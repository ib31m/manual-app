import type { ReactNode } from 'react';

interface BaseProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
}

export function TextField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  placeholder,
  type = 'text',
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className={`field${error ? ' error' : ''}`}>
      <label>
        {label}
        {required && <span className="text-err"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <div className="hint text-err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function NumberField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  step = 'any',
  unit,
  placeholder,
}: BaseProps & {
  value: number | '' | undefined;
  onChange: (v: string) => void;
  step?: string;
  unit?: string;
  placeholder?: string;
}) {
  return (
    <div className={`field${error ? ' error' : ''}`}>
      <label>
        {label} {unit && <span className="text-muted">({unit})</span>}
        {required && <span className="text-err"> *</span>}
      </label>
      <input
        type="number"
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <div className="hint text-err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  required,
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className={`field${error ? ' error' : ''}`}>
      <label>
        {label}
        {required && <span className="text-err"> *</span>}
      </label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <div className="hint text-err">{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function TextArea({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: BaseProps & { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: ReactNode;
}) {
  return (
    <div className="field">
      <div className="checkbox">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <label>{label}</label>
      </div>
      {hint && <div className="hint" style={{ marginLeft: 26 }}>{hint}</div>}
    </div>
  );
}
