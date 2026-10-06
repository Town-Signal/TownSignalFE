import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../context/AppState';
import { useToast } from '../context/Toast';
import { toApiError } from '../lib/errors';

export function useApiError() {
  const toast = useToast();
  const navigate = useNavigate();
  const { clearRecId } = useAppState();

  return useCallback((e, { onRetry, onFieldErrors } = {}) => {
    const err = toApiError(e);

    if (err.code === 'REC_NOT_FOUND') {
      clearRecId();
      return err;
    }
    if (err.code === 'VALIDATION_ERROR' && err.errors.length && onFieldErrors?.(err.errors)) return err;
    if (err.code === 'METHOD_NOT_ALLOWED' || err.code === 'UNAUTHORIZED') console.error(err);

    toast.error(err, { onRetry });
    if (err.code === 'DONG_NOT_FOUND') navigate('/', { replace: true });
    return err;
  }, [toast, navigate, clearRecId]);
}
