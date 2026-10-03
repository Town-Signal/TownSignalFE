import { useState } from 'react';

const BASE_Y = 118; // viewBox 320×130에서 x축 위치

/** 최근 매출 추이: 분기별 점포당 월평균 (꺾은선 + 영역). 점에 올리거나 누르면 값 표시 */
export default function SalesTrend({ quarters, lastQ, sub }) {
  const [hover, setHover] = useState(null);
  const pts = quarters.filter((p) => !p.missing);
  const line = pts.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${BASE_Y} ${line} ${pts[pts.length - 1].x},${BASE_Y}`;
  const hq = pts[hover];

  return (
    <section className="card detail-card trend">
      <div className="detail-card-head">
        <h2 className="card-title">최근 매출 추이</h2>
        <span className="sub">{sub} 평균 · 분기</span>
      </div>
      <div className="trend-chart">
        <svg viewBox="0 0 320 130" role="img" aria-label={`최근 ${pts.length}개 분기 매출 추이`}>
          <defs>
            <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="oklch(0.47 0.17 262)" stopOpacity="0.22" />
              <stop offset="1" stopColor="oklch(0.47 0.17 262)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon className="trend-rise" points={area} fill="url(#trend-area)" />
          <line x1="0" y1={BASE_Y} x2="320" y2={BASE_Y} stroke="oklch(0.92 0.006 262)" />
          <polyline className="trend-rise trend-line" points={line} />
          {hq && <line className="trend-guide" x1={hq.x} y1={hq.y} x2={hq.x} y2={BASE_Y} />}
          {pts.map((p, i) => (
            <g
              key={p.q} className="trend-dot"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}
            >
              {/* 터치하기 쉽게 투명한 큰 원으로 히트 영역 확보 */}
              <circle cx={p.x} cy={p.y} r="18" fill="transparent" />
              <circle cx={p.x} cy={p.y} r={hover === i ? 5.5 : 3.5} fill={hover === i ? 'oklch(0.47 0.17 262)' : '#fff'} stroke="oklch(0.47 0.17 262)" strokeWidth="2" />
            </g>
          ))}
        </svg>
        {hq && (
          <div className="chart-tip" style={{ left: `${Math.min(84, Math.max(16, (hq.x / 320) * 100))}%`, top: `${(hq.y / 130) * 100}%` }}>
            <span>{hq.q}</span><b>{hq.v}만 원</b>
          </div>
        )}
      </div>
      <div className="trend-labels">
        {quarters.map((p) => <span key={p.q} className={p.missing ? 'missing' : ''}>{p.q}</span>)}
      </div>
      <span className="sub">최근 분기 점포당 월평균이에요 <b>{lastQ}만 원</b></span>
    </section>
  );
}
