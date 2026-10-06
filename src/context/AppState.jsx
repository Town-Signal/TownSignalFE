import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { LS } from '../lib/storage';
import { DEFAULT_FAVS, DEFAULT_FAV_SUBS, DEFAULT_SUB, EMPTY_COND, LEGACY_DEMO_COND } from '../lib/data';
import { dongInfo } from '../lib/calc';

const AppState = createContext(null);

const loadFavs = () => {
  const v = LS.get('ts-favs', DEFAULT_FAVS);
  return Array.isArray(v) ? v.filter(dongInfo) : DEFAULT_FAVS;
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
  const [favSubs, setFavSubs] = useState(() => ({ ...DEFAULT_FAV_SUBS, ...LS.get('ts-fav-sub', {}) }));
  const [cond, setCondState] = useState(loadCond);
  const [last, setLast] = useState(loadLast);

  usePersist('ts-favs', favs);
  usePersist('ts-fav-sub', favSubs);
  usePersist('ts-cond', cond);
  usePersist('ts-last', last);

  // 관심 등록 시 그때 보던 업종을 함께 기억한다 (비교하기의 업종 기준)
  const toggleFav = useCallback((name, sub) => {
    const on = !favs.includes(name);
    setFavs(on ? [...favs, name] : favs.filter((x) => x !== name));
    if (on && sub) setFavSubs((cur) => ({ ...cur, [name]: sub }));
  }, [favs]);
  const setCond = useCallback((patch) => setCondState((cur) => ({ ...cur, ...patch })), []);

  const clearRecId = useCallback(() => setLast((cur) => (cur?.rec_id ? { ...cur, rec_id: null } : cur)), []);

  const value = useMemo(() => ({
    favs, toggleFav, cond, setCond, last, setLast, clearRecId,
    favSub: (name) => favSubs[name] || cond.sub || DEFAULT_SUB,
  }), [favs, favSubs, cond, last, toggleFav, setCond, clearRecId]);

  return <AppState.Provider value={value}>{children}</AppState.Provider>;
}

export const useAppState = () => useContext(AppState);
