import { useId } from 'react';

import './choice.css';

type Option<T extends string> = {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
};

/** A segmented control: real radio buttons underneath, so keyboard and screen readers just work. */
export const Choice = <T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) => {
  const name = useId();
  const selected = options.find((option) => option.value === value);
  return (
    <fieldset className="choice">
      <legend className="section-label">{legend}</legend>
      <div className="choice-options">
        {options.map((option) => (
          <label key={option.value} className="choice-option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {selected?.description && (
        <p className="choice-description muted">{selected.description}</p>
      )}
    </fieldset>
  );
};
