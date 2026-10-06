import { ApiError } from './errors';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';
const TIMEOUT_MS = 10000;

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR' });
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
