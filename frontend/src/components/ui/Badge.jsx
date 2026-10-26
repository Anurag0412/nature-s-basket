/**
 * Semantic Badge pill for active/inactive and stock states.
 */
export default function Badge({
  variant = 'active',
  children,
  className = '',
  style = {},
}) {
  const variantClass = {
    'in-stock': 'nb-badge--in-stock',
    active: 'nb-badge--active',
    'low-stock': 'nb-badge--low-stock',
    'out-of-stock': 'nb-badge--out-of-stock',
    danger: 'nb-badge--out-of-stock',
    inactive: 'nb-badge--inactive',
    neutral: 'nb-badge--inactive',
  }[variant] || 'nb-badge--active';

  return (
    <span className={`nb-badge ${variantClass} ${className}`.trim()} style={style}>
      {children}
    </span>
  );
}
