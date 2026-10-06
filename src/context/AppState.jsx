import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LS } from '../lib/storage';
import { DEFAULT_COND, DEFAULT_FAVS, DEFAULT_FAV_SUBS, DEFAULT_SUB } from '../lib/data';
import { dongInfo } from '../lib/calc';

const AppState = createContext(null);

const loadFavs = () => {
  const v = LS.get('ts-favs', DEFAULT_FAVS);
  return Array.isArray(v) ? v.filter(dongInfo) : DEFAULT_FAVS;
};
const loadLast = () => {
  const v = LS.get('ts-last', null);
  return v && Array.isArray(v.ranked) && v.ranked.length && v.margins ? v : null;
};

export function AppStateProvider({ children }) {
  const [favs, setFavs] = useState(loadFavs);
  const [favSubs, setFavSubs] = useState(() => ({ ...DEFAULT_FAV_SUBS, ...LS.get('ts-fav-sub', {}) }));
  const [cond, setCondState] = useState(() => ({ ...DEFAULT_COND, ...LS.get('ts-cond', {}) }));
  const [last, setLast] = useState(loadLast);

  useEffect(() => LS.set('ts-favs', favs), [favs]);
  useEffect(() => LS.set('ts-fav-sub', favSubs), [favSubs]);
  useEffect(() => LS.set('ts-cond', cond), [cond]);
  useEffect(() => { if (last) LS.set('ts-last', last); }, [last]);

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
