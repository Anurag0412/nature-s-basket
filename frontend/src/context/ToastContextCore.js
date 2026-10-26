import { createContext } from 'react';

/**
 * Toast context core instance separated to satisfy oxlint/HMR fast-refresh rules.
 */
export const ToastContext = createContext(null);
