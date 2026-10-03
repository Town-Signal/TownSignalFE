import { useState } from 'react';

const GENDERS = [['m', '남성'], ['f', '여성']];

/** 유동 인구: 성별 비율 막대 + 연령대 막대. 성별 칩으로 필터, 막대에 올리거나 누르면 비율 표시 */
export default function FootTraffic({ male, female, ages }) {
  const [gender, setGender] = useState('all');
  const [hover, setHover] = useState(null);

  const vals = ages.map((a) => (gender === 'all' ? a.m + a.f : a[gender]));
  const max = Math.max(...vals);
  const peak = vals.indexOf(max);
  const sum = vals.reduce((s, v) => s + v, 0) || 1;
  const genderLabel = gender === 'm' ? '남성' : '여성';
  const pick = (g) => { setGender(gender === g ? 'all' : g); setHover(null); };

  return (
    <section className="card detail-card foot">
      <div className="detail-card-head">
        <h2 className="card-title">유동 인구</h2>
        <span className="sub">{ages[peak].label}{gender === 'all' ? '가' : ` ${genderLabel}이`} 가장 많아요</span>
      </div>
      <div className="foot-gender">
        <div className="foot-split" aria-hidden="true">
          <div className="m" style={{ width: `${male}%` }} />
          <div className="f" style={{ width: `${female}%` }} />
        </div>
        <div className="foot-chips">
          {GENDERS.map(([g, label]) => (
            <button key={g} type="button" className={`foot-chip ${g} ${gender === g ? 'on' : ''}`} aria-pressed={gender === g} onClick={() => pick(g)}>
              <i />{label} {g === 'm' ? male : female}%
            </button>
          ))}
          {gender !== 'all' && <button type="button" className="foot-all" onClick={() => setGender('all')}>전체 보기</button>}
        </div>
      </div>
      <div className={`foot-bars ${gender}`}>
        {ages.map((a, i) => (
          <div
            key={a.label} className={`foot-col ${i === peak || hover === i ? 'strong' : ''} ${hover === i ? 'hover' : ''}`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}
          >
            <div className="bar" style={{ height: `${(vals[i] / max) * 100}%`, animationDelay: `${150 + i * 70}ms` }} />
            {hover === i && (
              <div className="chart-tip above">
                <b>{a.label}</b>
                <span className="main">{gender === 'all' ? `전체의 ${vals[i]}%` : `${genderLabel} 중 ${Math.round((vals[i] / sum) * 100)}%`}</span>
                {gender === 'all' && <span>남성 {a.m}% · 여성 {a.f}%</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="foot-labels">{ages.map((a) => <span key={a.label}>{a.label}</span>)}</div>
    </section>
  );
}
