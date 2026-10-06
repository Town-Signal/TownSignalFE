// 화면 경로. 상세는 행정동 이름이 아니라 dong_code(8자리)로 연다(명세 10.1 — 신사동처럼 이름이 같은 동이 있다).

export const isDongCode = (s) => /^\d{8}$/.test(String(s ?? ''));

/** /dong/{dong_code}?industry_code=…&from=rec|search */
export function detailPath(dongCode, { industryCode, from } = {}) {
  const q = new URLSearchParams();
  if (industryCode) q.set('industry_code', industryCode);
  if (from) q.set('from', from);
  const qs = q.toString();
  return `/dong/${dongCode}${qs ? `?${qs}` : ''}`;
}
