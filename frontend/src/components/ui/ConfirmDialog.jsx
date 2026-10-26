import Modal from './Modal';
import Button from './Button';

/**
 * Standard confirmation dialog for critical or destructive operations.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Please Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
  maxWidth = 460,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth={maxWidth}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
        {typeof message === 'string' ? <p>{message}</p> : message}
      </div>
    </Modal>
  );
}
