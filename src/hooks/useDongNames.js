import { useEffect, useState } from 'react';
import { loadDongNames } from '../lib/dongNames';

/** dong_code 목록 → { [dong_code]: { dong_name, district_name, geo_code } }. 받는 동안 · 실패 시 빈 항목 */
export function useDongNames(codes) {
  const key = codes.join(',');
  const [names, setNames] = useState({});
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    loadDongNames(key.split(',')).then((n) => { if (alive) setNames((cur) => ({ ...cur, ...n })); }, () => {});
    return () => { alive = false; };
  }, [key]);
  return names;
}
