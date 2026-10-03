import { useEffect, useRef, useState } from 'react';
import { CATS, CERTS } from '../../lib/data';
import { fmt } from '../../lib/calc';

const digits = (v, max) => v.replace(/\D/g, '').slice(0, max);
// 경력은 만 15세부터 쌓을 수 있다고 본다
const careerMax = (age) => { const n = parseInt(age, 10); return n >= 15 ? n - 15 : n > 0 ? 0 : 80; };
const TAG_OUT_MS = 190;

function capitalInKorean(cap) {
  if (!cap) return '만원 단위로 입력해 주세요';
  const eok = Math.floor(cap / 10000);
  const rest = cap % 10000;
  if (!eok) return '';
  return `${eok}억${rest ? ` ${fmt(rest)}만` : ''}원`;
}

/** 1단계: 나이 · 경력 · 자본금 · 희망 면적 · 업종 · 자격증 입력 */
export default function Step1Input({ cond, setCond, ageBad, ctaOff, onNext }) {
  const { age, career, capital, area, sub, tags } = cond;
  const big = CATS[cond.big] ? cond.big : Object.keys(CATS)[0];
  const [query, setQuery] = useState('');
  const [leaving, setLeaving] = useState(null);
  const leaveTimer = useRef(null);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const areaN = parseInt(area, 10);
  const q = query.trim();
  const suggestions = q ? CERTS.filter((c) => c.includes(q) && !tags.includes(c)).slice(0, 4) : [];

  const setCareer = (v) => setCond({ career: Math.max(0, Math.min(careerMax(age), v)) });
  const addTag = (t) => { if (!tags.includes(t)) setCond({ tags: [...tags, t] }); setQuery(''); };
  const removeTag = (t) => {
    setLeaving(t);
    leaveTimer.current = setTimeout(() => { setLeaving(null); setCond({ tags: tags.filter((x) => x !== t) }); }, TAG_OUT_MS);
  };

  return (
    <div className="rec-cols">
      <div className="card s1-form">
        <div className="page-head">
          <h1 className="page-title">내 조건을 알려주세요</h1>
          <p className="page-sub">받을 수 있는 지원금을 자치구마다 계산해 드려요.</p>
        </div>

        <div className="s1-fields">
          <label className="s1-field age">
            <span className="label">나이</span>
            <div className={`s1-input ${ageBad ? 'invalid' : ''}`}>
              <input
                value={age} inputMode="numeric" aria-invalid={ageBad}
                onChange={(e) => { const a = digits(e.target.value, 3); setCond({ age: a, career: Math.min(career, careerMax(a)) }); }}
              />
              <span>세</span>
            </div>
            {ageBad && <span className="hint error" role="alert">15~99세만 가능해요</span>}
          </label>

          <div className="s1-field career">
            <span className="label" id="career-label">경력</span>
            <div className="s1-input stepper">
              <button type="button" aria-label="경력 1년 줄이기" onClick={() => setCareer(career - 1)}>−</button>
              <span>
                <input value={career} inputMode="numeric" aria-labelledby="career-label" onChange={(e) => setCareer(parseInt(digits(e.target.value, 2) || '0', 10))} />
                <span>년</span>
              </span>
              <button type="button" className="plus" aria-label="경력 1년 늘리기" onClick={() => setCareer(career + 1)}>+</button>
            </div>
          </div>

          <label className="s1-field capital">
            <span className="label">자본금</span>
            <div className="s1-input">
              <input value={fmt(capital)} inputMode="numeric" onChange={(e) => setCond({ capital: parseInt(digits(e.target.value, 7) || '0', 10) })} />
              <span>만 원</span>
            </div>
            <span className="hint">{capitalInKorean(capital)}</span>
          </label>

          <label className="s1-field area">
            <span className="label">희망 면적</span>
            <div className={`s1-input ${areaN > 0 ? '' : 'invalid'}`}>
              <input value={area} inputMode="numeric" onChange={(e) => setCond({ area: digits(e.target.value, 4) })} />
              <span>㎡</span>
            </div>
            <span className={`hint ${areaN > 0 ? '' : 'error'}`}>{areaN > 0 ? `약 ${Math.round((areaN / 3.3058) * 10) / 10}평` : '㎡ 단위로 입력해 주세요'}</span>
          </label>
        </div>

        <div className="s1-group">
          <span className="label">희망 업종</span>
          <div className="s1-chips">
            {Object.keys(CATS).map((k) => (
              <button key={k} type="button" className={`chip ${big === k ? 'on' : ''}`} aria-pressed={big === k} onClick={() => setCond({ big: k, sub: CATS[k][0] })}>{k}</button>
            ))}
          </div>
          <div className="s1-subs">
            <span>{big} › 세부 업종</span>
            <div className="s1-chips" key={big}>
              {CATS[big].map((s) => (
                <button key={s} type="button" className={`chip sub ${sub === s ? 'on' : ''}`} aria-pressed={sub === s} onClick={() => setCond({ sub: s })}>{s}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="s1-group">
          <span className="label">자격증 <span>골라 주세요. 목록에 없으면 직접 추가할 수 있어요</span></span>
          <div className="s1-tags">
            {tags.map((t) => (
              <span key={t} className={`tag ${leaving === t ? 'leaving' : ''}`}>
                {t}<button type="button" aria-label={`${t} 삭제`} onClick={() => removeTag(t)}>×</button>
              </span>
            ))}
            <input
              value={query} placeholder="자격증 검색" aria-label="자격증 검색" enterKeyHint="done"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && q) { e.preventDefault(); addTag(suggestions[0] || q); } }}
            />
          </div>
          {q && (
            <div className="s1-sugs">
              {suggestions.map((c, i) => (
                <button key={c} type="button" style={{ animationDelay: `${i * 25}ms` }} onClick={() => addTag(c)}>{c}</button>
              ))}
              <button type="button" className="custom" style={{ animationDelay: `${suggestions.length * 25}ms` }} onClick={() => addTag(q)}>+ ‘{q}’ 직접 추가</button>
            </div>
          )}
        </div>
      </div>

      <aside className="rec-aside desk-only">
        <div className="card s1-summary">
          <b>입력한 조건</b>
          <dl>
            <div><dt>나이</dt><dd>{age}세</dd></div>
            <div><dt>자본금</dt><dd>{fmt(capital)}만 원</dd></div>
            <div><dt>희망 면적</dt><dd>{area}㎡</dd></div>
            <div><dt>경력</dt><dd>{career}년</dd></div>
            <div><dt>업종</dt><dd>{big} › {sub}</dd></div>
            <div><dt>자격증</dt><dd>{tags.length}개</dd></div>
          </dl>
          <p>다음 단계에서 서울 25개 자치구 각각의 지원 사업을 찾아 가용 예산을 계산해요.</p>
        </div>
        <button type="button" className="btn-primary rec-cta" disabled={ctaOff} onClick={onNext}>지원금 계산하기</button>
      </aside>
    </div>
  );
}
