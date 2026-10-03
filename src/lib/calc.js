import {
  GU_ROWS, rentPerMonth, LOW_RENT_RELIABILITY, GROWTH_LOW, QUARTER_LIMIT, DONG_ROWS, DONG_GU,
  ALL_SUBS, TYPICAL_STORES, GU_CENTER, NOTICE_ROWS, NOTICE_URL, NOTICE_TODAY,
} from './data';

export const fmt = (n) => Math.round(n).toLocaleString('ko-KR');
export const signed = (n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + '만';

// 범위 막대(RangeBar)의 축 최댓값
export const SURV_MAX = 80;
export const SALES_MAX = 5800;

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
export const ALL_DONGS = [...DONG_INFO.values()];
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

/**
 * 자치구별 가용 예산과 예산 여유.
 * 추정 초기 임대비용 = 보증금(월세 15개월) + 월세 3개월 = 월세 × 18. 월세는 33㎡ 기준이라 희망 면적에 비례시킨다.
 */
export function guBudgets(capital, area) {
  const areaK = Math.max(1, parseInt(area, 10) || 33) / 33;
  const list = GU_ROWS.map(([name, sub, rentIdx, err]) => {
    const rentM = rentPerMonth(rentIdx);
    const rent = rentM == null ? null : Math.round(rentM * areaK) * 18;
    const isError = !!err;
    const noRent = rent == null;
    const budget = capital + (sub || 0);
    const margin = noRent || isError ? null : budget - rent;
    const isFail = margin != null && margin < 0;
    let programs = [];
    let excluded = [];
    if (name === '관악구') {
      programs = [{ name: '관악구 청년 창업 초기자금', amt: '800만' }, { name: '서울시 청년 창업공간 임대료 지원', amt: '600만' }];
      excluded = [
        { name: '관악구 소상공인 시설개선 보조', amt: '300만', reason: '청년 창업 초기자금과 목적이 같아 함께 받을 수 없어요' },
        { name: '서울시 청년 창업 초기지원', amt: '700만', reason: '구 초기자금을 이미 받으면 신청할 수 없어요' },
      ];
    } else if (sub > 0) {
      const a = Math.round((sub * 0.6) / 100) * 100;
      programs = [{ name: `${name} 청년 창업 초기자금`, amt: fmt(a) + '만' }, { name: `${name} 창업공간 임대료 지원`, amt: fmt(sub - a) + '만' }];
      excluded = [{ name: `${name} 소상공인 시설개선 보조`, amt: '300만', reason: '청년 창업 초기자금과 목적이 같아 함께 받을 수 없어요' }];
    }
    return {
      name, sub: sub || 0, budget, rent, margin, programs, excluded,
      isError, isFail, isNoRent: noRent && !isError, isOk: !isError && !isFail && !noRent, isNone: sub === 0,
      // 정렬 우선순위: 통과 → 임대료 정보 없음 → 오류 → 탈락
      kind: isError ? 3 : isFail ? 4 : noRent ? 2 : 1,
      marginTxt: margin == null ? '' : signed(margin),
    };
  });
  const scale = Math.max(...list.map((g) => Math.max(g.budget, g.rent || 0))) * 1.04;
  list.forEach((g) => {
    g.capW = (capital / scale) * 100;
    g.subW = (g.sub / scale) * 100;
    g.rentL = ((g.rent || 0) / scale) * 100;
  });
  list.sort((a, b) => a.kind - b.kind || (b.margin ?? 0) - (a.margin ?? 0));
  return {
    list,
    okCount: list.filter((g) => g.isOk).length, // 감당 가능 = 통과만
    passNames: new Set(list.filter((g) => g.isOk || g.isNoRent).map((g) => g.name)), // 추천 대상 = 통과 + 임대료 정보 없음
    margins: Object.fromEntries(list.map((g) => [g.name, g.margin])),
  };
}

const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const QUARTERS = ['24.3Q', '24.4Q', '25.1Q', '25.2Q', '25.3Q', '25.4Q', '26.1Q', '26.2Q'];
const AGES = ['10대', '20대', '30대', '40대', '50대', '60대+'];
const extraCache = new Map();

/** 상세 화면용 부가 데이터(업종 분포 · 분기 매출 · 유동 인구). 목업이라 이름+업종 해시로 결정적 생성 */
export function detailExtra(name, sub) {
  const key = `${name}|${sub}`;
  if (extraCache.has(key)) return extraCache.get(key);

  const row = DONG_ROWS.find((x) => x[0] === name);
  const r = rng(hash(name + sub));
  const rd = rng(hash(name + '#dist'));
  const base = row[3] ? row[3][1] : 2200;
  const gr = row[4] ?? 3;

  // 세부 업종별 점포 수. w = 업종별 서울 평균 대비 비율(50 = 평균)
  const typ = (label) => TYPICAL_STORES[label] || 6;
  const stores = ALL_SUBS.map((label) => {
    let n = Math.round(typ(label) * (0.35 + rd() * 1.5));
    if (row[6] === 'res') n = Math.max(1, Math.round(n * 0.2));
    return { label, n, w: Math.min(100, (n / typ(label)) * 50), sel: label === sub };
  }).sort((a, b) => b.n - a.n);
  const dist = stores.slice(0, 8);
  const selStore = stores.find((x) => x.sel);
  if (selStore && !dist.includes(selStore)) dist.push(selStore);

  // 분기별 점포당 월평균 매출 → 320×130 viewBox 좌표
  const vals = QUARTERS.map((_, i) => base * (1 - ((gr / 100) * (7 - i)) / 4) * (0.93 + r() * 0.14));
  const vmax = Math.max(...vals) * 1.1;
  const vmin = Math.min(...vals) * 0.8;
  const have = QUARTER_LIMIT[name] ?? QUARTERS.length;
  const quarters = vals.map((v, i) => ({
    q: QUARTERS[i], v: fmt(v), x: 20 + i * 40, y: 110 - ((v - vmin) / (vmax - vmin)) * 95,
    missing: i < QUARTERS.length - have,
  }));

  const male = Math.round(44 + r() * 12);
  const aw = [8, 30 + r() * 12, 22 + r() * 8, 16, 12, 9].map((x) => x * (0.8 + r() * 0.4));
  const total = aw.reduce((a, b) => a + b, 0);
  const split = aw.map((v) => {
    const s = Math.min(0.75, Math.max(0.25, male / 100 + (r() - 0.5) * 0.24));
    return [v * s, v * (1 - s)];
  });

  const out = {
    dist, distShort: stores.slice(0, 4), selStoreCount: selStore ? selStore.n : null,
    quarters, lastQ: quarters[7].v,
    male, female: 100 - male,
    peakAge: AGES[aw.indexOf(Math.max(...aw))],
    ages: split.map(([m, f], i) => ({ label: AGES[i], m: Math.round((m / total) * 100), f: Math.round((f / total) * 100) })),
  };
  extraCache.set(key, out);
  return out;
}

/** 점포 수 수준: 0 적음 · 1 보통 · 2 많음 */
export const storeLevel = (w) => (w >= 70 ? 2 : w <= 35 ? 0 : 1);

const km = (a, b) => Math.hypot((a[1] - b[1]) * 88.2, (a[0] - b[0]) * 111);

/**
 * 점포 데이터가 없는 동 → 가까운 동네 최대 n곳.
 * 목업: 동 좌표가 없어 구 중심 거리로 근사(같은 구 우선, 그다음 중심 간 7km 이내 이웃 구).
 */
export function nearDongs(name, n = 3) {
  const gu = DONG_GU[name];
  const origin = GU_CENTER[gu];
  if (!origin) return [];
  return ALL_DONGS
    .filter((d) => d.name !== name && !d.noPred)
    .map((d) => ({ name: d.name, gu: d.gu, d: d.gu === gu ? 0 : km(origin, GU_CENTER[d.gu]) }))
    .filter((x) => x.d <= 7)
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => ({ name: x.name, gu: x.gu, kmTxt: x.d === 0 ? '같은 구' : '이웃 구' }));
}

/** 지원 공고 목록 (마감 임박 순, 상시모집은 맨 뒤) */
export function notices() {
  const today = new Date(NOTICE_TODAY);
  return NOTICE_ROWS.map(([title, org, deadline, amt]) => {
    const dday = deadline ? Math.round((new Date(deadline) - today) / 864e5) : null;
    return {
      title, org, amt, href: NOTICE_URL, dday,
      urgent: dday != null && dday <= 7,
      deadlineTxt: deadline ? deadline.slice(5).replace('-', '.') + ' 마감' : '',
    };
  }).sort((a, b) => (a.dday ?? 9999) - (b.dday ?? 9999));
}

const subHash = (s) => { let x = 7; for (const ch of s) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };
/** 직접찾기: 업종별 점수 (목업 — 종합점수에 업종 해시로 ±8점 보정) */
export const subScore = (d, sub) =>
  d.score == null ? null : Math.max(20, Math.min(98, d.score + (subHash(d.name + sub) % 17) - 8));
