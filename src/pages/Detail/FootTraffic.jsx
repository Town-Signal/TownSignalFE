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
            key={x.key} className={`foot-col ${x.key === strongKey ? 'peak' : ''} ${x.key === strongKey || hover === i ? 'strong' : ''} ${hover === i ? 'hover' : ''}`}
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
 * 유동 인구(10.5 9): ⑪ population_latest — 시간대 6구간(피크 강조) + 성별 비율. 버튼 하나로 같은 그래프를 시간대 ↔ 연령대로 바꾼다(토글).
 * ⑪에는 성별 × 연령 교차값이 없어 성별 필터는 두지 않는다(QUESTIONS).
 */
export default function FootTraffic({ pop, empty }) {
  const [byAge, setByAge] = useState(false);
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
  const hasAges = ages.some((a) => a.v != null);
  const showAge = byAge && hasAges;
  // 시간대 ↔ 연령대 토글 — 성별 데이터가 없어도 연령대 값이 있으면 따로 보여 준다
  const ageToggle = hasAges && (
    <button type="button" className="foot-all" aria-pressed={byAge} onClick={() => setByAge(!byAge)}>
      {/* 토글 느낌: ⇄가 반 바퀴 돌고 글자는 새로 올라오며 바뀐다(key), 연령대를 보는 동안은 켜진 색 */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
      </svg>
      <span key={byAge ? 'age' : 'time'} className="lbl">{byAge ? '시간대 보기' : '연령대 보기'}</span>
    </button>
  );
  const sub = showAge
    ? (peakAge.v != null ? `${peakAge.label}가 가장 많아요` : null)
    : (pop.peak_time_slot ? `${slotText(pop.peak_time_slot)}에 가장 많아요` : null);

  return (
    <section className="card detail-card foot">
      {head(sub)}
      {/* 바꿀 때 key로 다시 그려 사람이 새로 솟아오른다 */}
      {showAge ? <Bars key="age" items={ages} strongKey={peakAge.key} label="연령대별 유동 인구" />
        : pop.time_slots ? <Bars key="time" items={slots} strongKey={pop.peak_time_slot} label="시간대별 유동 인구" />
          : <span className="sub">시간대 데이터가 없어요</span>}
      {malePct != null && (
        <div className="foot-gender">
          <div className="foot-split" aria-hidden="true">
            <div className="m" style={{ width: `${malePct}%` }} />
            <div className="f" style={{ width: `${100 - malePct}%` }} />
          </div>
          <div className="foot-chips">
            <span className="foot-chip m"><i />남성 {malePct}%</span>
            {ageToggle}
            <span className="foot-chip f"><i />여성 {100 - malePct}%</span>
          </div>
        </div>
      )}
      {malePct == null && ageToggle && <div className="foot-chips">{ageToggle}</div>}
    </section>
  );
}
