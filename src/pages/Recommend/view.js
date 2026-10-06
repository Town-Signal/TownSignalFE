// 추천 1 · 2 · 3단계 — API 응답을 화면 모양으로 옮긴다. 예산 · 점수 · 예측은 계산하지 않는다(명세 10.8).
import { fmt, growthText, manwon, signed } from '../../lib/format';

const MANWON = 10000;

/**
 * ② 요청 본문. 자본금 만 원 → 원 변환은 여기 한 곳에서만 한다(CLAUDE.md 7절).
 */
export function toBudgetRequest(cond) {
  return {
    age: parseInt(cond.age, 10),
    capital: (Number(cond.capital) || 0) * MANWON,
    industry_code: cond.industry_code,
    career_years: Number(cond.career) || 0,
    certificates: cond.tags,
    target_area_sqm: Number(cond.area) || 33,
  };
}

const programRow = (p) => ({ id: p.program_id, name: p.name, amt: `${fmt(manwon(p.amount))}만` });

/**
 * ② district_budgets → 2단계 화면 모양. 순서는 서버 순서(available_budget 내림차순, 8.2) 그대로.
 * 막대 폭(capW · subW · rentL)은 그리기용 배율일 뿐 판정에 쓰지 않는다.
 */
export function toGuView(budget) {
  const capital = budget.own_capital;
  const list = budget.district_budgets.map((d) => {
    const isError = d.unavailable_reason === 'SUPPORT_DATA_ERROR';
    const margin = manwon(d.budget_margin);
    return {
      code: d.district_code,
      name: d.district_name,
      sub: manwon(d.support_fund_max),
      budget: manwon(d.available_budget),
      rent: manwon(d.estimated_rent_cost),
      monthlyRent: manwon(d.monthly_rent),
      margin,
      marginTxt: margin == null ? '' : signed(margin),
      programs: d.matched_programs.map(programRow),
      excluded: d.excluded_programs.map((p) => ({ ...programRow(p), reason: p.exclude_reason })),
      isError,
      isFail: d.passed === '제외',
      isNoRent: d.passed === '확인불가',
      isOk: d.passed === '통과',
      isNone: !isError && d.support_fund_max === 0,
      rentLow: d.rent_confidence === '낮음',
    };
  });
  const scale = Math.max(1, ...list.map((g) => Math.max(g.budget, g.rent || 0))) * 1.04;
  list.forEach((g) => {
    g.capW = (manwon(capital) / scale) * 100;
    g.subW = (g.sub / scale) * 100;
    g.rentL = ((g.rent || 0) / scale) * 100;
  });
  return {
    list,
    capital: manwon(capital),
    eligibleCount: budget.summary.eligible_district_count,
    passNames: new Set(list.filter((g) => g.isOk || g.isNoRent).map((g) => g.name)),
  };
}

const FACTOR_COLORS = { sales: 'oklch(0.6 0.13 262)', survival: 'oklch(0.6 0.13 170)', growth: 'oklch(0.6 0.13 80)' };
const FACTOR_LABELS = { sales: '매출', survival: '생존', growth: '성장세' };

const scoreColor = (score) =>
  score == null ? 'var(--muted-2)'
    : score >= 80 ? 'oklch(0.5 0.13 165)'
      : score >= 70 ? 'var(--primary)'
        : score >= 60 ? 'oklch(0.6 0.14 70)'
          : 'var(--down)';

/**
 * '왜 추천됐나요?' 표시값. 명세 10.3 2.3-5의 표시 공식 그대로:
 * 점수 = 적용 가중치 × 백분위 × 100, 배점 = 적용 가중치 × 100, 서울 상위 N% = ⌈(1 − 백분위) × 100⌉.
 */
function factors(d) {
  const b = d.score_breakdown;
  const pct = { sales: b.sales_percentile, survival: b.survival_percentile, growth: b.growth_percentile };
  const raw = {
    sales: d.sales_monthly_p50 == null ? '—' : `월 ${fmt(manwon(d.sales_monthly_p50))}만 원`,
    survival: d.survival_p50 == null ? '—' : `${d.survival_p50}개월`,
    growth: growthText(d.growth_rate) ?? '데이터 없음',
  };
  return ['sales', 'survival', 'growth'].map((k) => {
    const weight = Math.round((b.applied_weights[k] ?? 0) * 100);
    const contrib = pct[k] == null ? 0 : (b.applied_weights[k] ?? 0) * pct[k] * 100;
    return {
      label: FACTOR_LABELS[k], color: FACTOR_COLORS[k], weight, contrib,
      fill: weight ? (contrib / weight) * 100 : 0,
      raw: raw[k], top: pct[k] == null ? '—' : `서울 상위 ${Math.ceil((1 - pct[k]) * 100)}%`,
    };
  });
}

const rangeOrNull = (lo, mid, hi) => (lo == null || mid == null || hi == null ? null : [lo, mid, hi]);

/** ④ recommendations[] → 3단계 카드 모양 */
export function toDongView(d) {
  const sv = rangeOrNull(d.survival_range[0], d.survival_p50, d.survival_range[1]);
  const sl = rangeOrNull(
    manwon(d.sales_monthly_range[0]), manwon(d.sales_monthly_p50), manwon(d.sales_monthly_range[1]),
  );
  const weights = d.score_breakdown.applied_weights;
  const hasGrowth = d.growth_rate != null;
  const score = d.score_breakdown.total_score;
  const margin = manwon(d.budget_margin);
  return {
    code: d.dong_code,
    name: d.dong_name,
    gu: d.district_name,
    rankNo: d.rank_no,
    score,
    scoreTxt: score == null ? '—' : String(score),
    scoreColor: scoreColor(score),
    residential: d.is_residential,
    sampleShort: d.data_status === '표본 부족',
    sv, sl,
    survRange: sv ? `${sv[0]}~${sv[2]}개월` : '예측 불가',
    salesRange: sl ? `${fmt(sl[0])}~${fmt(sl[2])}만` : '예측 불가',
    margin,
    growth: d.growth_rate,
    hasGrowth,
    growthTxt: growthText(d.growth_rate) ?? '정보 없음',
    growthUp: hasGrowth && d.growth_rate >= 0,
    growthLowWhy: d.growth_confidence === '낮음' ? '확보된 분기가 적거나 상권 기준이 바뀌어 증감률을 믿기 어려워요' : undefined,
    weightsTxt: ['sales', 'survival', 'growth'].filter((k) => weights[k] > 0)
      .map((k) => `${FACTOR_LABELS[k]} ${Math.round(weights[k] * 100)}`).join(' · '),
    factors: factors(d),
    // 정렬 탭용 원값(서버 값 그대로)
    sortKeys: {
      score, surv: d.survival_p50, sales: d.sales_quarterly_p50, growth: d.growth_rate,
    },
  };
}

/** 정렬 탭 4종(판정 14). 받은 목록 재정렬만 — null 맨 뒤, 동률 total_score↓ → dong_code↑(7.8) */
export const SORTS = [
  ['score', '종합점수순'],
  ['surv', '생존순'],
  ['sales', '매출순'],
  ['growth', '성장세순'],
];

export function sortDongs(list, key) {
  const desc = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : b - a);
  return [...list].sort((a, b) => desc(a.sortKeys[key], b.sortKeys[key])
    || desc(a.sortKeys.score, b.sortKeys.score)
    || a.code.localeCompare(b.code));
}

/** ④ 성공 → ts-last(10.7). margins(구 이름 → 만 원)는 아직 목업인 상세 · 비교용 임시 값(F3에서 정리) */
export function toLast({ recId, industryCode, sub, eligibleCount, recommendations, guView }) {
  const now = new Date();
  return {
    rec_id: recId,
    created_at: now.toISOString(),
    date: `${now.getMonth() + 1}월 ${now.getDate()}일`,
    industry_code: industryCode,
    sub,
    passCount: eligibleCount,
    top: recommendations.slice(0, 5).map(lastTopItem),
    margins: guView ? Object.fromEntries(guView.list.map((g) => [g.name, g.margin])) : {},
  };
}

/** ④ recommendations[] 또는 ⑤ items[] → ts-last.top 한 줄 */
export const lastTopItem = (d) => ({
  dong_code: d.dong_code,
  name: d.dong_name,
  gu: d.district_name,
  score: d.score_breakdown ? d.score_breakdown.total_score : d.total_score,
  survival_p50: d.survival_p50,
  sales_monthly_p50: d.sales_monthly_p50,
  growth_rate: d.growth_rate,
});
