import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Toast } from '../components/ui';
import { usePresence } from '../hooks/usePresence';
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
  const [shown, leaving] = usePresence(toast); // 닫힌 뒤에도 내려가는 동안 그린다

  return (
    <ToastContext.Provider value={value}>
      {children}
      {shown && (
        <Toast
          key={shown.id} message={shown.message} kind={shown.kind} actionLabel={shown.actionLabel} leaving={leaving}
          onAction={() => { if (leaving) return; hide(); shown.onAction?.(); }}
        />
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
