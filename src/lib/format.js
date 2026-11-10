// 화면 표기용 변환만 둔다. 예산 · 점수 · 예측은 계산하지 않고 서버 값을 옮겨 적기만 한다(명세 10.8).

export const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
export const signed = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + '만';

/** 원 → 만 원(반올림). 결측은 0이 아니라 null 그대로 */
export const manwon = (won) => (won == null ? null : Math.round(won / 10000));

/** 희망 면적 기본값(㎡, 명세 7.1). 서버 DEFAULT_AREA_SQM과 같다 */
export const DEFAULT_AREA_SQM = 33;
/** 희망 면적 입력값 → ㎡ 숫자. 비었거나 0 이하면 기본 33㎡ */
export const areaSqm = (v) => (Number(v) > 0 ? Number(v) : DEFAULT_AREA_SQM);
/** 면적 표기 — '33㎡'. 평 환산은 1단계 입력 힌트에만 둔다 */
export const areaText = (v) => `${areaSqm(v)}㎡`;

/** 성장률(0.045) → '+4.5%'. 없으면 null */
export const growthText = (rate) => {
  if (rate == null) return null;
  const pct = Math.round(rate * 1000) / 10;
  return `${pct > 0 ? '+' : ''}${pct}%`;
};

/** 증감률 색 — 상승 초록 · 하락 빨강, 없으면 흐리게(성장세 · 점포 수 증감 공통) */
export const rateColor = (rate) => (rate == null ? 'var(--muted)' : rate >= 0 ? 'var(--green)' : 'var(--down)');

/** 영업 유지 확률(0.793) → '79%'. 없으면 null */
export const probText = (p) => (p == null ? null : `${Math.round(p * 100)}%`);

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

/** 상권 지표 분기 '20252' → '25.2Q' */
export const quarterShort = (yq) => (yq ? `${yq.slice(2, 4)}.${yq.slice(4)}Q` : '');
/** 상권 지표 분기 '20252' → '2025년 2분기' */
export const quarterText = (yq) => (yq ? `${yq.slice(0, 4)}년 ${yq.slice(4)}분기` : '');
/** 임대료 기준 분기 '2026Q2' → '2026년 2분기' */
export const rentQuarterText = (bq) => (bq ? bq.replace(/^(\d{4})Q(\d)$/, '$1년 $2분기') : '');
