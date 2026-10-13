// 화면의 '생존' 칸 표시 규칙 — 대시보드 · 추천 · 상세 · 직접 찾아보기 · 비교가 같이 쓴다(명세 10.8 · 판정 6 · 42).
// 서버 값(④ · ⑤ items, ⑫, ⑭, ts-last.top)을 옮겨 적기만 한다. 점수 · 정렬에는 쓰지 않는다.
import { fmt, growthText, probText, rateColor } from './format';

// TODO(가정): 10.8 가정 문구에서 '생존 기간'을 '생존 확률'로만 바꿈(15장 13번)
export const TREND_NOTE = '인허가 자료가 없는 업종이라 생존 확률 대신 점포 수 변화를 보여줘요';

/**
 * 생존 칸 하나의 표시값.
 * 1. 3년 생존 확률이 있으면 → '3년 생존 확률' 79% · 보조 '1년 93%'
 * 2. 확률이 없고 예측 불가가 아니면(생존 대상이 아닌 업종) → '점포 수 증감' +4.5% · 보조 '최근 1년 · 최근 분기 N곳'
 * 3. data_status '예측 불가' → '예측 불가', 그 밖에 둘 다 없으면 '정보 없음'
 * @returns {{ kind: 'prob'|'trend'|'nopred'|'none', label: string, main: string, sub?: string,
 *   shortLabel: string, short: string, rate?: number, low?: boolean, note?: string }}
 * shortLabel · short는 한 줄 요약용(추천 목록 행: '생존 3년 79%' · '점포 수 +4.5%')
 */
export function survivalView(x) {
  if (x?.data_status === '예측 불가') return { kind: 'nopred', label: '3년 생존 확률', main: '예측 불가', shortLabel: '생존', short: '예측 불가' };
  if (x?.survival_prob_3y != null) {
    const main = probText(x.survival_prob_3y);
    const one = probText(x.survival_prob_1y);
    return { kind: 'prob', label: '3년 생존 확률', main, sub: one && `1년 ${one}`, shortLabel: '생존', short: `3년 ${main}` };
  }
  const t = x?.store_trend;
  if (t?.change_rate != null) {
    const main = growthText(t.change_rate);
    return {
      kind: 'trend', label: '점포 수 증감', main, sub: `최근 1년 · 최근 분기 ${fmt(t.latest_count)}곳`,
      shortLabel: '점포 수', short: main, rate: t.change_rate, low: t.confidence === '낮음', note: TREND_NOTE,
    };
  }
  return { kind: 'none', label: '3년 생존 확률', main: '정보 없음', shortLabel: '생존', short: '정보 없음' };
}

/** 값이 있는 칸(확률 · 점포 수 증감)인지 — 없으면 화면은 회색 배지로 그린다 */
export const hasSurvival = (v) => v.kind === 'prob' || v.kind === 'trend';

/** 점포 수 증감이면 성장세와 같은 증감 색(10.8). 확률은 기본 글자색 */
export const survStyle = (v) => (v.kind === 'trend' ? { color: rateColor(v.rate) } : undefined);
