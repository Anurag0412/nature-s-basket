/**
 * Restrained hairline metric cell for KPI compartments.
 * Adheres strictly to tabular numerals and editorial serif typography.
 */
export default function MetricCard({
  label,
  value,
  hint = null,
  variant = 'default',
  className = '',
  style = {},
}) {
  const valueColor = {
    forest: 'var(--color-forest)',
    burgundy: 'var(--color-burgundy)',
    danger: 'var(--color-danger)',
    default: 'var(--text-primary)',
  }[variant] || 'var(--text-primary)';

  return (
    <div className={`nb-metric-cell ${className}`.trim()} style={style}>
      <div className="nb-metric-label">{label}</div>
      <div className="nb-metric-value" style={{ color: valueColor }}>
        {value}
      </div>
      {hint && <div className="nb-metric-hint">{hint}</div>}
    </div>
  );
}
