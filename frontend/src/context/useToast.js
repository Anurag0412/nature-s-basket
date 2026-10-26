import { useContext } from 'react';
import { ToastContext } from './ToastContextCore';

/**
 * Hook to access toast dispatch methods:
 * { addToast, removeToast, success, error, info }
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
