import { useEffect, useState } from 'react';

/**
 * 값이 사라져도 나가는 애니메이션 동안(exitMs) 마지막 값을 붙잡아 둔다.
 * value가 있으면 [value, false], 막 없어졌으면 [직전 값, true], 애니메이션이 끝나면 [null, false].
 * 나가는 중에 새 값이 오면 바로 새 값으로 바꾼다.
 */
export function usePresence(value, exitMs = 260) {
  const [kept, setKept] = useState(value ?? null);
  // 렌더 중에 이전 값을 기억하는 패턴(React 문서 'Storing information from previous renders')
  if (value != null && value !== kept) setKept(value);
  const leaving = value == null && kept != null;

  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => setKept(null), exitMs);
    return () => clearTimeout(t);
  }, [leaving, exitMs]);

  return [value ?? kept, leaving];
}
