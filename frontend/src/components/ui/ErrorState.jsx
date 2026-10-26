import Button from './Button';

/**
 * Error state container for network failures and query errors.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while communicating with the server.',
  onRetry = null,
  retryText = 'Try Again',
  className = '',
  style = {},
}) {
  return (
    <div
      className={`nb-state-container ${className}`.trim()}
      style={{ borderColor: 'rgba(185, 28, 28, 0.3)', ...style }}
      role="alert"
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          backgroundColor: 'var(--color-danger-tint)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-danger)',
          marginBottom: 'var(--space-2)',
        }}
      >
        <svg
          width="22"
          height="22"
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
      </div>

      <h3 className="nb-empty-state-title" style={{ color: 'var(--color-danger)' }}>
        {title}
      </h3>
      <p className="nb-empty-state-desc">{message}</p>

      {onRetry && (
        <div style={{ marginTop: 'var(--space-1)' }}>
          <Button variant="secondary" size="sm" onClick={onRetry}>
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
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            {retryText}
          </Button>
        </div>
      )}
    </div>
  );
}
