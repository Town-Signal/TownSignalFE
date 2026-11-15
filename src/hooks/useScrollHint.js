import { useEffect, useRef, useState } from 'react';
import { LS } from '../lib/storage';

/**
 * 안에서 스크롤하는 상자(ref)의 아래에 더 있는지 — 스크롤바를 숨긴 목록에 '아래에 더 있어요'(.more-hint)를 띄울 때 쓴다.
 * 스크롤 · 상자나 안쪽 묶음의 크기가 바뀔 때 다시 잰다. key가 바뀌면(안쪽이 다시 그려지면) 새로 붙는다
 */
export function useMore(ref, active, key) {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!active || !el) { setMore(false); return undefined; }
    const measure = () => setMore(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
    const ro = new ResizeObserver(measure); // 처음 한 번도 잰다
    ro.observe(el);
    [...el.children].forEach((c) => ro.observe(c)); // 펼침 · 목록 불러오기 등 안쪽이 커질 때
    el.addEventListener('scroll', measure, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', measure); };
  }, [ref, active, key]);
  return more;
}

/**
 * 처음 '더 있음'이 생겼을 때 한 번만 true(목록이 살짝 올라갔다 내려오고 ⌄가 튀는 안내). 본 기록은 storageKey로 브라우저에 남긴다.
 * 안내 애니메이션(.7s 뒤 1.2s)이 끝나면 다시 false
 */
export function usePeekOnce(more, storageKey) {
  const [peek, setPeek] = useState(false);
  const seen = useRef(LS.get(storageKey, false));
  useEffect(() => {
    if (!more || seen.current) return;
    seen.current = true;
    LS.set(storageKey, true);
    setPeek(true);
  }, [more, storageKey]);
  useEffect(() => {
    if (!peek) return undefined;
    const t = setTimeout(() => setPeek(false), 2200);
    return () => clearTimeout(t);
  }, [peek]);
  return peek;
}
