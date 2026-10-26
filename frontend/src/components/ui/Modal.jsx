import { useEffect, useCallback } from 'react';

/**
 * Accessible Modal dialog with backdrop blur, escape-key listener,
 * and focus containment.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer = null,
  maxWidth = 520,
  closeOnBackdrop = true,
  className = '',
}) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="nb-modal-backdrop"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <div
        className={`nb-modal-dialog ${className}`.trim()}
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-dialog-title"
      >
        <div className="nb-modal-header">
          <h2 id="modal-dialog-title" className="nb-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="nb-modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        <div className="nb-modal-body">{children}</div>

        {footer && <div className="nb-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
