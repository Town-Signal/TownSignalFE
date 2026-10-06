import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Toast } from '../components/ui';
import { errorToast } from '../lib/errors';

const ToastContext = createContext(null);
const TOAST_MS = 4000;

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const hide = useCallback(() => { clearTimeout(timer.current); setToast(null); }, []);
  const show = useCallback((t) => {
    clearTimeout(timer.current);
    setToast({ ...t, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), t.duration ?? TOAST_MS);
  }, []);
  const error = useCallback((e, { message, onRetry } = {}) => {
    const t = errorToast(e);
    if (!t) return;
    show({
      kind: 'error',
      message: message ?? t.message,
      ...(t.retry && onRetry ? { actionLabel: '다시 시도', onAction: onRetry } : {}),
    });
  }, [show]);

  const value = useMemo(() => ({ show, error, hide }), [show, error, hide]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Toast
          key={toast.id} message={toast.message} kind={toast.kind} actionLabel={toast.actionLabel}
          onAction={() => { hide(); toast.onAction?.(); }}
        />
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
