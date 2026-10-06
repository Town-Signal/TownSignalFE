export class ApiError extends Error {
  constructor({ code, message = null, status = null, errors = [], requestId = null }) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
    this.userMessage = message;
    this.status = status;
    this.errors = errors;
    this.requestId = requestId;
  }
}

const COMMON_MESSAGE = '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요';
const COMMON = {};

const ERROR_TOASTS = {
  NETWORK_ERROR: { message: '인터넷 연결을 확인해 주세요', retry: true },
  DB_UNAVAILABLE: { message: '잠시 후 다시 시도해 주세요', retry: true },
  INTERNAL_ERROR: { requestId: true },
  BAD_REQUEST: COMMON,
  NOT_FOUND: COMMON,
  METHOD_NOT_ALLOWED: COMMON,
  UNAUTHORIZED: COMMON,
  VALIDATION_ERROR: { fallback: '입력한 값을 다시 확인해 주세요' },
  DONG_NOT_FOUND: { message: '찾을 수 없는 동네예요' },
  INDUSTRY_NOT_FOUND: { message: '업종을 다시 선택해 주세요' },
  PROGRAM_NOT_FOUND: null,
  REC_NOT_FOUND: null,
};

export const ERROR_CODES = Object.keys(ERROR_TOASTS);

const FAIL_ALIASES = { NETWORK: 'NETWORK_ERROR', SERVER: 'INTERNAL_ERROR' };

export function toApiError(e) {
  if (e instanceof ApiError) return e;
  if (typeof e === 'string') return new ApiError({ code: e });
  const offline = !navigator.onLine || /Failed to fetch|dynamically imported|NetworkError|Load failed/i.test(e?.message);
  return new ApiError({ code: offline ? 'NETWORK_ERROR' : 'INTERNAL_ERROR', status: e?.status ?? null });
}

export function errorToast(e) {
  const err = toApiError(e);
  const def = err.code in ERROR_TOASTS ? ERROR_TOASTS[err.code] : COMMON;
  if (!def) return null;
  let message = def.message ?? err.userMessage ?? def.fallback ?? COMMON_MESSAGE;
  if (def.requestId && err.requestId) message += ` (오류 번호 ${err.requestId})`;
  return { message, retry: !!def.retry };
}

export const errorKind = (e) => (toApiError(e).code === 'NETWORK_ERROR' ? 'network' : 'server');

export function forcedFailure() {
  if (!import.meta.env.DEV) return null;
  const fail = new URLSearchParams(window.location.search).get('fail')?.toUpperCase();
  const code = FAIL_ALIASES[fail] ?? fail;
  return code in ERROR_TOASTS ? code : null;
}

const SAMPLES = {
  INTERNAL_ERROR: { requestId: 'req_7f3a9c1e2b' },
  VALIDATION_ERROR: {
    message: '입력한 값을 다시 확인해 주세요.',
    errors: [
      { field: 'age', reason: 'OUT_OF_RANGE', message: '나이는 15~99세 사이로 입력해 주세요.' },
      { field: 'industry_code', reason: 'REQUIRED', message: '희망 업종을 선택해 주세요.' },
    ],
  },
};

export const sampleError = (code) => new ApiError({ code, ...SAMPLES[code] });

export function simulatedFailure() {
  const code = navigator.onLine ? forcedFailure() : 'NETWORK_ERROR';
  return code ? sampleError(code) : null;
}
