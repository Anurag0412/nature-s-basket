import { useState } from 'react';

/**
 * Enhanced Input component supporting search icons and password visibility toggles.
 */
export default function Input({
  type = 'text',
  id,
  name,
  value,
  onChange,
  placeholder,
  error = false,
  disabled = false,
  readOnly = false,
  autoComplete,
  className = '',
  style = {},
  prefix = null,
  suffix = null,
  allowPasswordToggle = true,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const isSearch = type === 'search';
  const effectiveType = isPassword && showPassword ? 'text' : type;

  // Search prefix icon if not overridden
  const effectivePrefix =
    prefix ||
    (isSearch ? (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ) : null);

  // Password toggle suffix if not overridden
  const effectiveSuffix =
    suffix ||
    (isPassword && allowPasswordToggle ? (
      <button
        type="button"
        className="nb-input-suffix-btn"
        onClick={() => setShowPassword((prev) => !prev)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {showPassword ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    ) : null);

  const wrapperClass = [
    'nb-input-wrapper',
    effectivePrefix ? 'nb-input-wrapper--has-prefix' : '',
    effectiveSuffix ? 'nb-input-wrapper--has-suffix' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const inputClass = [
    'nb-input',
    error ? 'nb-input--error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapperClass} style={style}>
      {effectivePrefix && <span className="nb-input-prefix">{effectivePrefix}</span>}
      <input
        id={id}
        name={name}
        type={effectiveType}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        autoComplete={autoComplete}
        className={inputClass}
        {...props}
      />
      {effectiveSuffix && <span className="nb-input-suffix">{effectiveSuffix}</span>}
    </div>
  );
}
