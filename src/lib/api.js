import { ApiError } from './errors';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';
const TIMEOUT_MS = 10000;

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  // AbortSignal.timeout()은 Safari 16 미만(iOS 15)에 없어 모든 요청이 실패하므로 AbortController + 타이머로 끊는다
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, TIMEOUT_MS);
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    // 시간 초과는 서버가 늦은 것이라 '인터넷 연결 확인'이 아니라 '잠시 후 다시'로 안내한다
    throw new ApiError({ code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR' });
  } finally {
    clearTimeout(timer);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ApiError({ code: 'INTERNAL_ERROR', status: res.status });
  }

  if (json.status !== 'SUCCESS') {
    throw new ApiError({
      code: json.code ?? 'INTERNAL_ERROR',
      message: json.message,
      status: res.status,
      errors: json.errors ?? [],
      requestId: json.meta?.request_id ?? null,
    });
  }
  return json;
}
