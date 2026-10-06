// 저장 실패·형식 오류는 무시하고 기본값으로 동작한다 (사파리 프라이빗 모드 등)
export const LS = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* 무시 */ }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch { /* 무시 */ }
  },
};
