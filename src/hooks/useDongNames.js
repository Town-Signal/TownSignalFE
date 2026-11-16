import { useEffect, useState } from 'react';
import { loadDongNames } from '../lib/dongNames';

/**
 * [[dong_code, industry_code | null], …] → { [dong_code]: { dong_name, district_name } }.
 * 업종이 있으면 ⑫, 없으면 ⑧ · ⑨(lib/dongNames). 받는 동안은 항목 없음(undefined), 실패하면 null — 화면이 막대 · 코드로 가른다
 */
export function useDongNames(pairs) {
  const key = JSON.stringify(pairs);
  const [names, setNames] = useState({});
  useEffect(() => {
    const list = JSON.parse(key);
    if (!list.length) return undefined;
    let alive = true;
    loadDongNames(list).then(
      (n) => { if (alive) setNames((cur) => ({ ...cur, ...n })); },
      () => { if (alive) setNames((cur) => ({ ...Object.fromEntries(list.map(([c]) => [c, null])), ...cur })); },
    );
    return () => { alive = false; };
  }, [key]);
  return names;
}
