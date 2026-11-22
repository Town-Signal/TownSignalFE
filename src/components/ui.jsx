// 여러 화면이 공유하는 작은 표현 컴포넌트 모음
import { useEffect, useRef, useState } from 'react';
import { hasSurvival, survStyle } from '../lib/survival';

const GROWTH_LOW_TIP = '확보 분기 4개 미만 또는 2024년 상권 기준 변경으로 증감률을 믿기 어려워요';

// 선 아이콘(24 viewBox, stroke=currentColor). 한 path에 하위 경로를 이어 쓴다
export const ICONS = {
  spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  sparkle: 'M12 2c.6 4.9 2.6 8.4 10 10-7.4 1.6-9.4 5.1-10 10-.6-4.9-2.6-8.4-10-10 7.4-1.6 9.4-5.1 10-10z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  external: 'M7 17L17 7M9 7h8v8',
  compare: 'M8 4L4 8l4 4M4 8h12M16 20l4-4-4-4M20 16H8',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  chart: 'M4 20h16M7 16v-5M12 16V6M17 16v-8',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1 7.8 7.7 7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z',
  calendar: 'M8 3v3M16 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
  plus: 'M12 5v14M5 12h14',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  umbrella: 'M22 12a10 10 0 0 0-20 0zM12 12v8a2 2 0 0 0 4 0M12 2v1',
};

/** 선 아이콘. filled면 안을 채운다(켜진 하트 · 장식 반짝이) */
export function Icon({ name, size = 20, filled = false, className = '' }) {
  return (
    <svg
      className={`svg-icon ${className}`} width={size} height={size} viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

/** 관심 하트. 눌러서 켤 때만 톡 튀는 애니메이션(pop) — 처음부터 켜진 하트는 조용히 그린다 */
export function HeartButton({ on, onClick, className = '' }) {
  const [pop, setPop] = useState(false);
  return (
    <button
      type="button"
      className={`heart ${on ? 'on' : ''} ${pop ? 'pop' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? '관심 등록됨' : '관심 등록'}
      title={on ? '관심 등록됨' : '관심 등록'}
      onClick={(e) => { if (!on) setPop(true); onClick?.(e); }}
      onAnimationEnd={() => setPop(false)}
    >
      <Icon name="heart" filled={on} />
    </button>
  );
}

/** 불러오는 동안 실제 값 자리에 두는 회색 막대(스켈레톤). 폭 · 높이는 그 자리 글자에 맞추고, 칩 자리는 r로 둥글게 */
/**
 * 안 내용의 높이가 바뀔 때 바깥 높이를 부드럽게 따라가게 한다(아래 항목이 밀려 내려가며 나타남).
 * height: auto에는 transition이 안 돼서 ResizeObserver로 잰 높이를 바깥 상자에 넣는다. 처음 잴 때는 애니메이션 없이 그 높이로
 */
export function SmoothHeight({ className, wrapClassName = '', children }) {
  const inner = useRef(null);
  const [h, setH] = useState();
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setH(e.borderBoxSize[0].blockSize));
    ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);
  return <div className={`smooth-h ${wrapClassName}`} style={{ height: h }}><div ref={inner} className={className}>{children}</div></div>;
}

export const Sk = ({ w = '100%', h = 14, r, className = '' }) => (
  <i className={`sk ${className}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />
);
/** 지표 타일(.kpi) 자리의 스켈레톤 — 이름 · 값 · 설명 세 줄 */
export const SkKpi = () => <div className="kpi" aria-hidden="true"><Sk w="45%" h={14} /><Sk w="60%" h={30} /><Sk w="85%" h={12} /></div>;
export const ResidentialBadge = ({ lg }) => <span className={`badge badge-res ${lg ? 'lg' : ''}`}>주거지역</span>;
export const GrowthLowBadge = ({ title = GROWTH_LOW_TIP }) => <span className="badge badge-warn" title={title}>신뢰도 낮음</span>;
/**
 * '신뢰도 낮음' 작은 점 — 좁은 칸에서 배지 대신 항목 이름 옆에 붙인다. 마우스를 올리면 이유가 보인다.
 * 옆에 '신뢰도 낮음' 글자를 함께 쓰면 decorative로 화면 읽기에서 뺀다
 */
export const LowDot = ({ title = GROWTH_LOW_TIP, decorative = false }) => (
  decorative
    ? <i className="low-dot" title={title} aria-hidden="true" />
    : <i className="low-dot" title={title} role="img" aria-label="신뢰도 낮음" />
);

/**
 * 영업 유지 칸 값(lib/survival의 survivalView 결과). 확률 · 점포 수 증감은 굵게, 없으면 회색 배지.
 * 점포 수 증감은 성장세와 같은 색 · '신뢰도 낮음' 배지 · 안내 툴팁(명세 10.8)
 */
export function SurvivalValue({ v }) {
  if (!hasSurvival(v)) return <span className="badge badge-gray">{v.main}</span>;
  return (
    <>
      <b style={survStyle(v)} title={v.note}>{v.main}</b>
      {v.low && <GrowthLowBadge />}
    </>
  );
}

/** 80% 확률 범위 막대: 하한~상한 bar + 중앙값 눈금. ends를 주면 아래에 하한/상한 라벨, legend면 그 아래에 범례(구간 · 눈금)를 단다 */
export function RangeBar({ range: [lo, mid, hi], max, ends, legend = false }) {
  const pct = (v) => `${(v / max) * 100}%`;
  return (
    <>
      <div className="rangebar">
        <div className="track" />
        <div className="range" style={{ left: pct(lo), width: pct(hi - lo) }} />
        <div className="mid" style={{ left: pct(mid) }} />
      </div>
      {ends && (
        <div className="range-ends">
          <span style={{ flexBasis: pct(lo) }}>{ends[0]}</span>
          <i style={{ flexBasis: pct(hi - lo) }} />
          <span>{ends[1]}</span>
        </div>
      )}
      {legend && (
        <div className="range-legend">
          <span><i className="lg-range" />80% 확률 범위</span>
          <span><i className="lg-mid" />예상값</span>
        </div>
      )}
    </>
  );
}

const VIEW_ICONS = {
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  map: 'M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11zM12 12a2 2 0 100-4 2 2 0 000 4z',
};

/** 리스트 ↔ 지도 전환 */
export function ViewToggle({ view, onChange, className = '' }) {
  return (
    <div className={`seg ${className}`} data-pos={view === 'map' ? 1 : 0} role="group" aria-label="보기 방식">
      {[['list', '리스트'], ['map', '지도']].map(([k, label]) => (
        <button key={k} type="button" aria-pressed={view === k} onClick={() => onChange(k)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={VIEW_ICONS[k]} /></svg>
          {label}
        </button>
      ))}
    </div>
  );
}

export const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
);

/** 하단 토스트. leaving이면 아래로 내려가며 사라지는 중(usePresence와 함께 쓴다) */
export function Toast({ message, kind, actionLabel, onAction, leaving = false }) {
  const isError = kind === 'error';
  return (
    <div className={`toast ${isError ? 'error' : ''} ${leaving ? 'leaving' : ''}`} role={isError ? 'alert' : 'status'}>
      <div>
        {isError && <i aria-hidden="true">!</i>}
        <span>{message}</span>
        {actionLabel && <button type="button" onClick={onAction}>{actionLabel}</button>}
      </div>
    </div>
  );
}

export function BoxMsg({ title, desc, onRetry, retrying }) {
  return (
    <div className="box-msg" role="alert">
      <b>{title}</b>
      {desc && <span>{desc}</span>}
      {onRetry && <button type="button" className="btn-ghost" disabled={retrying} onClick={onRetry}>{retrying ? '불러오는 중…' : '다시 시도'}</button>}
    </div>
  );
}

export function MapMsg({ error, onRetry }) {
  if (!error) return <div className="map-msg map-loading" role="status"><span className="sr-only">지도를 불러오는 중…</span></div>;
  return (
    <div className="map-msg error" role="alert">
      <b>{error === 'network' ? '인터넷 연결을 확인해 주세요' : '지도 데이터를 불러오지 못했어요'}</b>
      <span>리스트로도 확인할 수 있어요.</span>
      <button type="button" className="btn-ghost" onClick={onRetry}>다시 시도</button>
    </div>
  );
}
