/**
 * Individual Toast item and ToastContainer for real-time notifications.
 */
export function ToastItem({ toast, onDismiss }) {
  const { id, type = 'info', title, message } = toast;

  const typeClass =
    type === 'success'
      ? 'nb-toast--success'
      : type === 'error'
      ? 'nb-toast--error'
      : 'nb-toast--info';

  const icon =
    type === 'success' ? (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-forest)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 2 }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ) : type === 'error' ? (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-danger)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 2 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ) : (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-burgundy)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 2 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    );

  return (
    <div className={`nb-toast ${typeClass}`} role="alert">
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {icon}
        <div>
          {title && (
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: message ? 2 : 0 }}>
              {title}
            </div>
          )}
          {message && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{message}</div>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          padding: 2,
          lineHeight: 1,
          fontSize: 16,
          marginLeft: 8,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="nb-toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
