/**
 * PageHeader with Playfair editorial heading, operational subtitle,
 * optional badge, and responsive actions slot.
 */
export default function PageHeader({
  title,
  subtitle = null,
  badge = null,
  actions = null,
  className = '',
  style = {},
}) {
  return (
    <header className={`nb-page-header ${className}`.trim()} style={style}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1-5)', flexWrap: 'wrap' }}>
          <h1 className="nb-page-title">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="nb-page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="nb-page-actions">{actions}</div>}
    </header>
  );
}
