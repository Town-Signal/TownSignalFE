// 화면 표기용 변환만 둔다. 예산 · 점수 · 예측은 계산하지 않고 서버 값을 옮겨 적기만 한다(명세 10.8).

export const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
export const signed = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + '만';

/** 원 → 만 원(반올림). 결측은 0이 아니라 null 그대로 */
export const manwon = (won) => (won == null ? null : Math.round(won / 10000));

/** 성장률(0.045) → '+4.5%'. 없으면 null */
export const growthText = (rate) => {
  if (rate == null) return null;
  const pct = Math.round(rate * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
};

/** 'YYYY-MM-DD' → 'MM.DD' */
export const shortDate = (iso) => (iso ? iso.slice(5).replace('-', '.') : '');

/** 오늘(로컬)부터 마감일까지 남은 날 수. 표시용 D-day */
export function daysUntil(iso, today = new Date()) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const end = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - start) / 864e5);
}

/** 오류 화면에 요청 번호를 작게 붙일 때 */
export const requestIdText = (err) => (err?.requestId ? ` (오류 번호 ${err.requestId})` : '');
