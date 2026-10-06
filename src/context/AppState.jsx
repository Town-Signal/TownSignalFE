import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LS } from '../lib/storage';
import { EMPTY_COND, LEGACY_DEMO_COND } from '../lib/data';

const AppState = createContext(null);

const NO_FAVS = [];
const NO_FAV_SUBS = {};
const isDongCode = (s) => typeof s === 'string' && /^\d{8}$/.test(s);
const isIndustryCode = (s) => typeof s === 'string' && /^CS\d{6}$/.test(s);

/** 정리한 값이 저장된 값과 다르면 다시 쓰고, 비었으면 키를 지운다 */
const rewrite = (key, raw, clean, empty) => {
  if (JSON.stringify(raw) === JSON.stringify(clean)) return;
  if (empty) LS.remove(key); else LS.set(key, clean);
};

// ts-favs: dong_code(8자리) 배열, 기본값 [](10.7). 8자리 숫자가 아닌 예전 값(동 이름 · 데모 3곳)은 버린다
const loadFavs = () => {
  const v = LS.get('ts-favs', null);
  if (v == null) return NO_FAVS;
  const clean = Array.isArray(v) ? [...new Set(v.filter(isDongCode))] : [];
  rewrite('ts-favs', v, clean, !clean.length);
  return clean.length ? clean : NO_FAVS;
};
// ts-fav-sub: { dong_code: industry_code }, 기본값 {}(10.7). 예전 { 동명: 업종명 }은 버린다
const loadFavSubs = () => {
  const v = LS.get('ts-fav-sub', null);
  if (v == null) return NO_FAV_SUBS;
  const ok = typeof v === 'object' && !Array.isArray(v);
  const clean = ok ? Object.fromEntries(Object.entries(v).filter(([k, ic]) => isDongCode(k) && isIndustryCode(ic))) : {};
  const empty = !Object.keys(clean).length;
  rewrite('ts-fav-sub', v, clean, empty);
  return empty ? NO_FAV_SUBS : clean;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isTopItem = (t) => t && typeof t === 'object' && !Array.isArray(t) && typeof t.dong_code === 'string';

// ts-last(10.7): { rec_id, created_at, date, industry_code, sub, passCount, top[5], margins }
// rec_id(UUID)가 없거나 top이 dong_code를 가진 객체가 아니면(목업 시절 [동명, 구명, 점수] 배열 · ranked 등) 버리고 지운다.
// margins(구 이름 → 만 원)는 아직 목업인 상세 · 비교용 임시 값(F3에서 정리)
const loadLast = () => {
  const v = LS.get('ts-last', null);
  const ok = v && typeof v === 'object' && typeof v.rec_id === 'string' && UUID_RE.test(v.rec_id)
    && Array.isArray(v.top) && v.top.length > 0 && v.top.every(isTopItem) && v.margins;
  if (v != null && !ok) LS.remove('ts-last');
  return ok ? v : null;
};

// ts-cond: 기본값 null(빈 폼, 10.7). 목업 시절 자동 저장된 데모 조건은 버리고 지운다.
// 목업 시절 값에는 industry_code가 없다 → null로 두고, 추천 화면이 ⑩ 목록을 받은 뒤 업종 이름으로 맞춘다
const isLegacyDemo = (v) => Object.entries(LEGACY_DEMO_COND).every(([k, d]) => JSON.stringify(v[k]) === JSON.stringify(d));
const loadCond = () => {
  const v = LS.get('ts-cond', null);
  let saved = v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  if (v != null && (!saved || isLegacyDemo(saved))) { LS.remove('ts-cond'); saved = null; }
  if (!saved) return EMPTY_COND;
  return {
    ...EMPTY_COND, ...saved,
    tags: Array.isArray(saved.tags) ? saved.tags : [],
    industry_code: typeof saved.industry_code === 'string' ? saved.industry_code : null,
  };
};

/** 처음 읽은 값(같은 참조)이면 저장하지 않는다 — 사용자가 실제로 바꿨을 때만 localStorage에 쓴다 */
function usePersist(key, value) {
  const initial = useRef(value);
  useEffect(() => {
    if (value !== initial.current && value != null) LS.set(key, value);
  }, [key, value]);
}

export function AppStateProvider({ children }) {
  const [favs, setFavs] = useState(loadFavs);
  const [favSubs, setFavSubs] = useState(loadFavSubs);
  const [cond, setCondState] = useState(loadCond);
  const [last, setLast] = useState(loadLast);

  usePersist('ts-favs', favs);
  usePersist('ts-fav-sub', favSubs);
  usePersist('ts-cond', cond);
  usePersist('ts-last', last);

  // 관심 등록 · 해제는 dong_code로. 등록 때 보던 업종(industry_code)을 함께 기억하고(비교 기준), 해제하면 같이 지운다(10.7)
  const addFav = useCallback((code, industryCode, at) => {
    setFavs((cur) => {
      if (cur.includes(code)) return cur;
      const next = [...cur];
      next.splice(at == null ? next.length : Math.min(at, next.length), 0, code);
      return next;
    });
    if (industryCode) setFavSubs((cur) => (cur[code] === industryCode ? cur : { ...cur, [code]: industryCode }));
  }, []);
  const removeFav = useCallback((code) => {
    setFavs((cur) => (cur.includes(code) ? cur.filter((x) => x !== code) : cur));
    setFavSubs((cur) => {
      if (!(code in cur)) return cur;
      const rest = { ...cur };
      delete rest[code];
      return rest;
    });
  }, []);
  const toggleFav = useCallback((code, industryCode) => {
    if (favs.includes(code)) removeFav(code); else addFav(code, industryCode);
  }, [favs, addFav, removeFav]);
  const setCond = useCallback((patch) => setCondState((cur) => ({ ...cur, ...patch })), []);

  const clearRecId = useCallback(() => setLast((cur) => (cur?.rec_id ? { ...cur, rec_id: null } : cur)), []);

  // 관심 동네의 업종: ts-fav-sub → 최근 입력 조건 → 최근 추천. 셋 다 없으면 null(기본 업종 폐지, 10.7)
  const favIndustry = useCallback(
    (code) => favSubs[code] ?? cond.industry_code ?? last?.industry_code ?? null,
    [favSubs, cond.industry_code, last?.industry_code],
  );

  const value = useMemo(() => ({
    favs, toggleFav, addFav, removeFav, favIndustry, cond, setCond, last, setLast, clearRecId,
  }), [favs, toggleFav, addFav, removeFav, favIndustry, cond, setCond, last, clearRecId]);

  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}

export const useAppState = () => useContext(AppState);
