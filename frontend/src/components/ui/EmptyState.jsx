/**
 * Botanical empty state container displaying heritage line art, title,
 * description, and an optional primary call-to-action button.
 */
export default function EmptyState({
  title = 'No records found',
  description = 'No matching information was discovered for this selection.',
  action = null,
  icon = null,
  className = '',
  style = {},
}) {
  return (
    <div className={`nb-state-container ${className}`.trim()} style={style}>
      {icon || (
        <svg
          className="nb-empty-state-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      )}

      <h3 className="nb-empty-state-title">{title}</h3>
      {description && <p className="nb-empty-state-desc">{description}</p>}
      {action && <div style={{ marginTop: 'var(--space-1)' }}>{action}</div>}
    </div>
  );
}
