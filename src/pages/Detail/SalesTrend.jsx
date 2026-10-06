import { useState } from 'react';
import { fmt, manwon, quarterShort } from '../../lib/format';

const QUARTERS = 8;

/** '20252' → 앞 분기 '20251' */
const prevQuarter = (yq) => {
  const y = Number(yq.slice(0, 4));
  const q = Number(yq.slice(4));
  return q === 1 ? `${y - 1}4` : `${y}${q - 1}`;
};

/**
 * 최근 매출 추이(10.5 8): ⑪ sales_trend 최근 8분기 막대, 값은 점포당 월평균(per_store_monthly_amount).
 * 응답에 없는 분기는 빈 막대. space_standard_break(20241) 분기 앞에 상권 기준 변경 경계선.
 */
export default function SalesTrend({ trend, breakQuarter, latest, industryName, empty }) {
  const [hover, setHover] = useState(null);
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
  const bars = keys.map((q) => ({ q, v: byQ[q] == null ? null : manwon(byQ[q]) }));
  const vals = bars.map((b) => b.v).filter((v) => v != null);
  const max = Math.max(1, ...vals);
  const top = vals.length ? Math.max(...vals) : null;
  const lastV = bars[bars.length - 1].v;

  return (
    <section className="card detail-card trend">
      {head}
      <div className="trend-bars" role="img" aria-label={`최근 ${QUARTERS}개 분기 점포당 월평균 매출`}>
        {bars.map((b, i) => (
          <div
            key={b.q}
            className={`foot-col ${b.v === top ? 'strong' : ''} ${hover === i ? 'hover' : ''} ${b.q === breakQuarter && i > 0 ? 'break' : ''}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}
          >
            {b.q === breakQuarter && i > 0 && <span className="break-label">상권 기준 변경</span>}
            {b.v == null
              ? <div className="bar empty" />
              : <div className="bar" style={{ height: `${(b.v / max) * 100}%`, animationDelay: `${100 + i * 50}ms` }} />}
            {hover === i && (
              <div className="chart-tip above">
                <b>{quarterShort(b.q)}</b>
                <span className="main">{b.v == null ? '데이터 없음' : `월 ${fmt(b.v)}만 원`}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="trend-labels">
        {bars.map((b) => <span key={b.q} className={b.v == null ? 'missing' : ''}>{quarterShort(b.q)}</span>)}
      </div>
      <span className="sub">
        {lastV == null ? '최근 분기 데이터가 없어요' : <>최근 분기 점포당 월평균이에요 <b>{fmt(lastV)}만 원</b></>}
      </span>
    </section>
  );
}
