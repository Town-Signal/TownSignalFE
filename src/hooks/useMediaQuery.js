import { useCallback, useSyncExternalStore } from 'react';

/** CSS만으로 처리할 수 없는 구조 분기에만 쓴다 (레이아웃은 미디어쿼리로) */
export function useMediaQuery(query) {
  // subscribe · getSnapshot을 query별로 고정한다 — 렌더마다 새 함수면 React가 매번 구독을 풀고 다시 건다
  const subscribe = useCallback((onChange) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot);
}

export const DESKTOP = '(min-width: 900px)';
// 목록 + 고정 상세 패널을 나란히 둘 만큼 넓은 화면(추천 2단계)
export const WIDE = '(min-width: 1040px)';
// OS '동작 줄이기' 설정 — CSS로 못 멈추는 JS 움직임(돌아가는 제목 · 부드러운 스크롤)에 쓴다
export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
