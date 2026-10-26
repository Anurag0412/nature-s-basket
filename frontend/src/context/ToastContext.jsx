import { useState, useCallback, useMemo } from 'react';
import { ToastContext } from './ToastContextCore';
import { ToastContainer } from '../components/feedback/Toast';

/**
 * Toast Provider supplying application-wide notifications.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'info', title = null, message = '', duration = 4000 }) => {
      const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const newToast = { id, type, title, message };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const success = useCallback(
    (message, title = 'Success', duration = 4000) => {
      return addToast({ type: 'success', title, message, duration });
    },
    [addToast]
  );

  const error = useCallback(
    (message, title = 'Error', duration = 5000) => {
      return addToast({ type: 'error', title, message, duration });
    },
    [addToast]
  );

  const info = useCallback(
    (message, title = 'Notice', duration = 4000) => {
      return addToast({ type: 'info', title, message, duration });
    },
    [addToast]
  );

  const contextValue = useMemo(
    () => ({
      toasts,
      addToast,
      removeToast,
      success,
      error,
      info,
    }),
    [toasts, addToast, removeToast, success, error, info]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}
