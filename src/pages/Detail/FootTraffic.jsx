import { useState } from 'react';
import { fmt } from '../../lib/format';

const AGES = [['age_10', '10대'], ['age_20', '20대'], ['age_30', '30대'], ['age_40', '40대'], ['age_50', '50대'], ['age_60', '60대+']];
const SLOTS = ['00-06', '06-11', '11-14', '14-17', '17-21', '21-24'];
const slotText = (s) => s.replace(/^0?(\d+)-0?(\d+)$/, '$1~$2시');

/** 막대 6개 묶음(시간대 · 연령대). 높이는 그리기용 배율, 툴팁은 인구 수와 비율(표시용) */
function Bars({ items, strongKey, label }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...items.map((x) => x.v ?? 0));
  const sum = items.reduce((a, x) => a + (x.v ?? 0), 0) || 1;
  return (
    <>
      <div className="foot-bars" role="img" aria-label={label}>
        {items.map((x, i) => (
          <div
            key={x.key} className={`foot-col ${x.key === strongKey || hover === i ? 'strong' : ''} ${hover === i ? 'hover' : ''}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}
          >
            <div className="bar" style={{ height: `${((x.v ?? 0) / max) * 100}%`, animationDelay: `${150 + i * 70}ms` }} />
            {hover === i && (
              <div className="chart-tip above">
                <b>{x.label}</b>
                <span className="main">{x.v == null ? '데이터 없음' : `${fmt(x.v)}명 · ${Math.round((x.v / sum) * 100)}%`}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="foot-labels">{items.map((x) => <span key={x.key}>{x.label}</span>)}</div>
    </>
  );
}

/**
 * 유동 인구(10.5 9): ⑪ population_latest — 시간대 6구간(피크 강조) + 성별 비율 + 연령대('전체 보기'로 펼침).
 * ⑪에는 성별 × 연령 교차값이 없어 성별 필터는 두지 않는다(QUESTIONS).
 */
export default function FootTraffic({ pop, empty }) {
  const [open, setOpen] = useState(false);
  const head = (sub) => (
    <div className="detail-card-head">
      <h2 className="card-title">유동 인구</h2>
      {sub && <span className="sub">{sub}</span>}
    </div>
  );
  if (!pop) return <section className="card detail-card foot">{head()}{empty}</section>;

  const slots = SLOTS.map((k) => ({ key: k, label: slotText(k), v: pop.time_slots?.[k] ?? null }));
  const ages = AGES.map(([k, label]) => {
    const v = pop[k] ?? null;
    return { key: k, label, v };
  });
  const peakAge = ages.reduce((a, x) => ((x.v ?? -1) > (a.v ?? -1) ? x : a), ages[0]);
  const gTotal = (pop.male ?? 0) + (pop.female ?? 0);
  const malePct = gTotal ? Math.round((pop.male / gTotal) * 100) : null;

  return (
    <section className="card detail-card foot">
      {head(pop.peak_time_slot ? `${slotText(pop.peak_time_slot)}에 가장 많아요` : null)}
      {pop.time_slots
        ? <Bars items={slots} strongKey={pop.peak_time_slot} label="시간대별 유동 인구" />
        : <span className="sub">시간대 데이터가 없어요</span>}
      {malePct != null && (
        <div className="foot-gender">
          <div className="foot-split" aria-hidden="true">
            <div className="m" style={{ width: `${malePct}%` }} />
            <div className="f" style={{ width: `${100 - malePct}%` }} />
          </div>
          <div className="foot-chips">
            <span className="foot-chip m"><i />남성 {malePct}%</span>
            <button type="button" className="foot-all" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? '접기' : '연령대 전체 보기'}</button>
            <span className="foot-chip f"><i />여성 {100 - malePct}%</span>
          </div>
        </div>
      )}
      {open && (
        <>
          <span className="sub">{peakAge.v != null && `${peakAge.label}가 가장 많아요`}</span>
          <Bars items={ages} strongKey={peakAge.key} label="연령대별 유동 인구" />
        </>
      )}
    </section>
  );
}
