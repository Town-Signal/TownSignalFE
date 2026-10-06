import { useEffect, useState } from 'react';
import { loadMasters } from '../lib/masters';

/** ⑩ 업종 목록(앱에서 한 번 받아 둔 것). 받기 전 · 실패 시 null */
export function useIndustries() {
  const [industries, setIndustries] = useState(null);
  useEffect(() => {
    let alive = true;
    loadMasters().then((m) => { if (alive) setIndustries(m.industries); }, () => {});
    return () => { alive = false; };
  }, []);
  return industries;
}
