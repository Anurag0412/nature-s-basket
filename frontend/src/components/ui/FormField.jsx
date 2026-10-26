/**
 * FormField wrapper providing standardized labels, optional hints,
 * and error messages for inputs and selects.
 */
export default function FormField({
  label,
  htmlFor,
  required = false,
  hint = null,
  error = null,
  children,
  className = '',
  style = {},
}) {
  return (
    <div className={`nb-form-field ${className}`.trim()} style={style}>
      {label && (
        <label htmlFor={htmlFor} className="nb-form-label">
          <span>
            {label}
            {required && <span className="nb-required">*</span>}
          </span>
          {hint && !error && <span className="nb-form-hint">{hint}</span>}
        </label>
      )}

      {children}

      {error && (
        <div className="nb-form-error" role="alert">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
