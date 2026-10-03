// 여러 화면이 공유하는 작은 표현 컴포넌트 모음
import { GROWTH_LOW_TIP } from '../lib/data';
import { storeLevel } from '../lib/calc';

export function HeartButton({ on, onClick, className = '' }) {
  return (
    <button
      type="button"
      className={`heart ${on ? 'on' : ''} ${className}`}
      aria-pressed={on}
      aria-label={on ? '관심 등록됨' : '관심 등록'}
      title={on ? '관심 등록됨' : '관심 등록'}
      onClick={onClick}
    >
      {on ? '♥' : '♡'}
    </button>
  );
}

export const ResidentialBadge = ({ lg }) => <span className={`badge badge-res ${lg ? 'lg' : ''}`}>주거지역</span>;
export const GrowthLowBadge = ({ title = GROWTH_LOW_TIP }) => <span className="badge badge-warn" title={title}>신뢰도 낮음</span>;

/** 80% 확률 범위 막대: 하한~상한 bar + 중앙값 눈금. ends를 주면 아래에 하한/상한 라벨을 단다 */
export function RangeBar({ range: [lo, mid, hi], max, ends }) {
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
          <span style={{ left: pct(lo) }}>{ends[0]}</span>
          <span style={{ left: pct(hi) }}>{ends[1]}</span>
        </div>
      )}
    </>
  );
}

const LEVELS = ['적음', '보통', '많음'];

export function LevelLegend({ title }) {
  return (
    <span className="lv-legend" title={title}>
      {LEVELS.map((l, i) => <span key={l}><i className={`lv-${i}`} />{l}</span>)}
    </span>
  );
}

/** 업종 점포 수 수준을 3칸 막대(적음/보통/많음)로 표시 */
export function LevelRow({ label, w, hit }) {
  const lv = storeLevel(w);
  return (
    <div className="lv-row">
      <span className={`name ${hit ? 'hit' : ''}`}>{label}</span>
      <span className="segs">{LEVELS.map((l, i) => <i key={l} className={i === lv ? `lv-${i}` : ''} />)}</span>
      <span className={`tag lv-tag-${lv}`}>{LEVELS[lv]}</span>
    </div>
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

export function Toast({ message, actionLabel, onAction }) {
  return (
    <div className="toast" role="status">
      <div>
        <span>{message}</span>
        <button type="button" onClick={onAction}>{actionLabel}</button>
      </div>
    </div>
  );
}
