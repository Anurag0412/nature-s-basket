/**
 * Operational loading state container with botanical-tinted spinner.
 */
export default function LoadingState({
  message = 'Loading data...',
  inline = false,
  className = '',
  style = {},
}) {
  if (inline) {
    return (
      <div
        className={`nb-loading-inline ${className}`.trim()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--text-muted)',
          fontSize: 13,
          ...style,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            border: '2px solid var(--color-forest-tint)',
            borderTopColor: 'var(--color-forest)',
            borderRadius: '50%',
            animation: 'nbSpin 0.6s linear infinite',
          }}
        />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className={`nb-state-container ${className}`.trim()} style={style} role="status">
      <div className="nb-loading-spinner" />
      <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 500 }}>
        {message}
      </div>
    </div>
  );
}
