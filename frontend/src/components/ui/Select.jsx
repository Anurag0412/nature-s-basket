/**
 * Standardized Select component matching the botanical hairline aesthetic.
 */
export default function Select({
  id,
  name,
  value,
  onChange,
  options = [],
  placeholder = null,
  disabled = false,
  error = false,
  className = '',
  style = {},
  ...props
}) {
  const selectClass = [
    'nb-select',
    error ? 'nb-input--error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={selectClass}
      style={{ width: '100%', cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} disabled={opt.disabled}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
