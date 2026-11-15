import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmt, manwon, quarterShort } from '../../lib/format';
import { REDUCED_MOTION, useMediaQuery } from '../../hooks/useMediaQuery';

const QUARTERS = 8;
const MORPH_DELAY = 0.3; // 초 — 카드가 나타난 뒤에 모양 잡기(점의 CSS animation-delay와 같게)

/** '20252' → 앞 분기 '20251' */
const prevQuarter = (yq) => {
  const y = Number(yq.slice(0, 4));
  const q = Number(yq.slice(4));
  return q === 1 ? `${y - 1}4` : `${y}${q - 1}`;
};

/**
 * 최근 매출 추이(10.5 8): ⑪ sales_trend 최근 8분기 꺾은선, 값은 점포당 월평균(per_store_monthly_amount).
 * 꺾은선이라 0부터 시작하지 않고 값이 있는 구간만 확대한다(최고 · 최저 기준선에 값 표시).
 * space_standard_break(20241) 분기 앞은 점선 경계 + 선을 끊는다(기준이 다른 값을 한 선으로 잇지 않게). 응답에 없는 분기는 선을 비운다.
 */
export default function SalesTrend({ trend, breakQuarter, latest, industryName, empty }) {
  const [hover, setHover] = useState(null);
  const reduce = useMediaQuery(REDUCED_MOTION);
  // 모양 잡기는 그래프가 화면에 보일 때 한 번(모바일에선 아래에 있어 보기 전에 끝나지 않게). 선 · 점을 같은 순간에 시작
  const plotRef = useRef(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const el = plotRef.current;
    if (!el || play || reduce) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setPlay(true); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [play, reduce]);
  useLayoutEffect(() => {
    if (play) plotRef.current?.querySelectorAll('animate').forEach((a) => a.beginElementAt(MORPH_DELAY));
  }, [play]);
  const head = (
    <div className="detail-card-head">
      <h2 className="card-title">최근 매출 추이</h2>
      <span className="sub">{industryName ? `${industryName} 평균` : '전 업종'} · 분기</span>
    </div>
  );
  if (!trend?.length) return <section className="card detail-card trend">{head}{empty}</section>;

  // 최근 분기부터 8개 분기를 거꾸로 채운다(빠진 분기는 null)
  const byQ = Object.fromEntries(trend.map((t) => [t.year_quarter, t.per_store_monthly_amount]));
  const keys = [];
  for (let q = latest ?? trend[trend.length - 1].year_quarter; keys.length < QUARTERS; q = prevQuarter(q)) keys.unshift(q);
  const points = keys.map((q) => ({ q, v: byQ[q] == null ? null : manwon(byQ[q]) }));
  const vals = points.map((p) => p.v).filter((v) => v != null);
  if (!vals.length) return <section className="card detail-card trend">{head}{empty}</section>;
  const lastV = points[QUARTERS - 1].v;

  // 세로 배율(그리기용): 최저~최고에 위아래 25% 여유. 값이 하나뿐이거나 모두 같으면 그 값 ±10%
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.max(1, max * 0.2);
  const lo = min - span * 0.25;
  const hi = max + span * 0.25;
  const x = (i) => ((i + 0.5) / QUARTERS) * 100;
  const y = (v) => (1 - (v - lo) / (hi - lo)) * 100;

  // 처음엔 평균 높이의 평평한 선으로 나왔다가 점마다 제 높이로 움직여 모양을 잡는다(선은 SVG <animate>, 점은 CSS --flat → --y, 같은 시간 · 가속)
  const flatY = y(vals.reduce((a, v) => a + v, 0) / vals.length);
  // 선 조각: 빠진 분기 · 상권 기준 변경 분기 앞에서 끊는다(점 하나뿐인 조각은 점만)
  const brk = points.findIndex((p, i) => i > 0 && p.q === breakQuarter);
  const segs = [[]];
  points.forEach((p, i) => {
    if (i === brk || p.v == null) segs.push([]);
    if (p.v != null) segs[segs.length - 1].push([x(i), y(p.v)]);
  });
  const toD = (s, flat) => `M${s.map(([px, py]) => `${px} ${flat ? flatY : py}`).join('L')}`;
  const paths = segs.filter((s) => s.length > 1).map((s) => ({ d: toD(s), flat: toD(s, true) }));
  const hp = hover == null ? null : points[hover];

  return (
    <section className="card detail-card trend">
      {head}
      <div ref={plotRef} className={`trend-plot ${reduce ? 'still' : play ? 'play' : ''}`} style={{ '--flat': `${flatY}%` }} role="img" aria-label={`최근 ${QUARTERS}개 분기 점포당 월평균 매출 · 최저 ${fmt(min)}만 원 · 최고 ${fmt(max)}만 원`}>
        {/* 최고 · 최저 기준선 — 0부터 시작하지 않는 확대 그래프임을 값으로 알린다 */}
        {[...new Set([max, min])].map((v) => (
          <div key={v} className="trend-grid" style={{ top: `${y(v)}%` }}><span>{fmt(v)}만</span></div>
        ))}
        {brk > 0 && <div className="trend-break" style={{ left: `${(brk / QUARTERS) * 100}%` }}><span>상권 기준 변경</span></div>}
        {hp?.v != null && <div key={`cross-${hover}`} className="trend-cross" style={{ left: `${x(hover)}%` }} />}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {paths.map(({ d, flat }) => (
            // 시작 전에는 평평한 선(d = flat), 보이면 <animate>로 실제 모양까지 가서 멈춘다(fill freeze)
            <path key={d} d={reduce ? d : flat} className="trend-line" vectorEffect="non-scaling-stroke">
              {!reduce && <animate attributeName="d" values={`${flat};${d}`} dur=".9s" begin="indefinite" calcMode="spline" keyTimes="0;1" keySplines=".22 .8 .3 1" fill="freeze" />}
            </path>
          ))}
        </svg>
        {points.map((p, i) => p.v != null && (
          <i
            key={p.q} className={`trend-dot ${i === QUARTERS - 1 ? 'last' : ''} ${hover === i ? 'on' : ''}`}
            style={{ left: `${x(i)}%`, '--y': `${y(p.v)}%` }}
          />
        ))}
        {/* 분기마다 보이지 않는 세로 칸(마우스 · 탭 영역) */}
        <div className="trend-hits">
          {points.map((p, i) => (
            <div key={p.q} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)} />
          ))}
        </div>
        {hp && (
          // 점을 옮길 때마다 새로 그려(key) 떠오르는 애니메이션을 다시 재생한다
          <div key={hover} className="chart-tip" style={{ left: `${x(hover)}%`, top: hp.v == null ? '50%' : `${y(hp.v)}%` }}>
            <span>{quarterShort(hp.q)}</span>
            <b>{hp.v == null ? '데이터 없음' : `월 ${fmt(hp.v)}만 원`}</b>
          </div>
        )}
      </div>
      <div className="trend-labels">
        {points.map((p) => <span key={p.q} className={p.v == null ? 'missing' : ''}>{quarterShort(p.q)}</span>)}
      </div>
      <span className="sub">
        {lastV == null ? '최근 분기 데이터가 없어요' : <>최근 분기 점포당 월평균이에요 <b>{fmt(lastV)}만 원</b></>}
      </span>
    </section>
  );
}
