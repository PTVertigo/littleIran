import { useId, type SelectHTMLAttributes } from 'react';

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder: string;
};

// A labelled drop-down whose error is announced and tied to it, like TextField
export function SelectField({ label, error, options, placeholder, ...rest }: SelectFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <select id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : undefined} {...rest}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
