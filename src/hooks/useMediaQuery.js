import { useSyncExternalStore } from 'react';

/** CSS만으로 처리할 수 없는 구조 분기에만 쓴다 (레이아웃은 미디어쿼리로) */
export function useMediaQuery(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export const DESKTOP = '(min-width: 900px)';
