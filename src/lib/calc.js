// 목업 계산 — 아직 API로 바꾸지 않은 화면(비교 · 대시보드 관심 카드)만 쓴다. F4에서 연동이 끝나면 지운다.
import { GU_ROWS, rentPerMonth, LOW_RENT_RELIABILITY, GROWTH_LOW, DONG_ROWS } from './data';
import { fmt } from './format';

export { fmt, signed } from './format';

const FACTOR_COLORS = ['oklch(0.6 0.13 262)', 'oklch(0.6 0.13 170)', 'oklch(0.6 0.13 80)'];

const scoreColor = (score) =>
  score == null ? 'var(--muted-2)'
    : score >= 80 ? 'oklch(0.5 0.13 165)'
      : score >= 70 ? 'var(--primary)'
        : score >= 60 ? 'oklch(0.6 0.14 70)'
          : 'var(--down)';

function buildDong([name, gu, sv, sl, growth, tops, flag]) {
  const noPred = flag === 'nopred' || !sv;
  const hasGrowth = growth != null;
  const growthTxt = hasGrowth ? `${growth > 0 ? '+' : ''}${growth}%` : '정보 없음';
  // 성장세 데이터가 없으면 매출 50 · 생존 50으로 재배분
  const weights = hasGrowth ? [40, 40, 20] : [50, 50, 0];
  const raws = noPred
    ? ['—', '—', hasGrowth ? growthTxt : '—']
    : [`월 ${fmt(sl[1])}만 원`, `${sv[1]}개월`, hasGrowth ? growthTxt : '데이터 없음'];
  const factors = ['매출', '생존', '성장세'].map((label, i) => {
    const contrib = tops[i] == null ? 0 : (weights[i] * (100 - tops[i])) / 100;
    return {
      label, color: FACTOR_COLORS[i], weight: weights[i], contrib,
      fill: weights[i] ? (contrib / weights[i]) * 100 : 0,
      raw: raws[i], top: tops[i] == null ? '—' : `서울 상위 ${tops[i]}%`,
    };
  });
  const score = noPred ? null : Math.round(factors.reduce((a, x) => a + x.contrib, 0));
  const rent = rentPerMonth(GU_ROWS.find((g) => g[0] === gu)[2]);
  return {
    name, gu, score, scoreTxt: noPred ? '—' : String(score), scoreColor: scoreColor(score),
    noPred, residential: flag === 'res',
    growth, growthTxt, hasGrowth, growthUp: hasGrowth && growth >= 0, growthLowWhy: hasGrowth ? GROWTH_LOW[name] : undefined,
    weightsTxt: hasGrowth ? '매출 40 · 생존 40 · 성장세 20' : '매출 50 · 생존 50', factors,
    rent, rentLow: LOW_RENT_RELIABILITY.includes(gu),
    sv, sl,
    survRange: noPred ? '예측 불가' : `${sv[0]}~${sv[2]}개월`,
    salesRange: noPred ? '예측 불가' : `${fmt(sl[0])}~${fmt(sl[2])}만`,
  };
}

const DONG_INFO = new Map(DONG_ROWS.map((row) => [row[0], buildDong(row)]));
/** 예측 데이터가 있는 동의 정보. 없는 이름이면 null */
export const dongInfo = (name) => DONG_INFO.get(name) ?? null;

export const growthColor = (d) => (!d.hasGrowth ? 'var(--muted)' : d.growthUp ? 'var(--green)' : 'var(--down)');

/** 구 기준 예산 여유. undefined = 추천 이력 없음, null = 임대료 정보 없음 */
export const marginOf = (last, gu) => (last ? last.margins[gu] : undefined);

export function dongPath(name, { from, sub } = {}) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (sub) q.set('sub', sub);
  const qs = q.toString();
  return `/dong/${encodeURIComponent(name)}${qs ? `?${qs}` : ''}`;
}
