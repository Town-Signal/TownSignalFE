import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt } from '../../lib/format';
import { BoxMsg } from '../../components/ui';
import { groupIndustries } from '../../lib/masters';

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


/** 1단계: 나이 · 경력 · 자본금 · 희망 면적 · 업종(⑩) · 자격증(⑰) 입력 */
export default function Step1Input({ cond, setCond, errors = {}, ageBad, ctaOff, onNext, masters, mastersError, onRetryMasters }) {
  const { age, career, capital, area, sub, tags } = cond;
  const cats = useMemo(() => (masters ? groupIndustries(masters.industries) : null), [masters]);
  const big = cats?.[cond.big] ? cond.big : null; // 빈 폼이면 대분류도 고르지 않은 상태
  const [query, setQuery] = useState('');
  const [leaving, setLeaving] = useState(null);
  const leaveTimer = useRef(null);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  const areaN = parseInt(area, 10);
  const q = query.trim();
  // ⑰ 표준명 · 동의어로 거른다(프론트 코드: 일치 항목 최대 4개)
  const suggestions = q && masters
    ? masters.certificates
      .filter((c) => !tags.includes(c.name) && [c.name, ...c.aliases].some((n) => n.includes(q)))
      .map((c) => c.name)
      .slice(0, 4)
    : [];

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
            <div className={`s1-input ${ageBad || errors.age ? 'invalid' : ''}`}>
              <input
                value={age} inputMode="numeric" aria-invalid={ageBad}
                onChange={(e) => { const a = digits(e.target.value, 3); setCond({ age: a, career: Math.min(career, careerMax(a)) }); }}
              />
              <span>세</span>
            </div>
            {ageBad
              ? <span className="hint error" role="alert">15~99세만 가능해요</span>
              : errors.age
                ? <span className="hint error server" role="alert">{errors.age}</span>
                : !age && <span className="hint">만 나이로 입력해 주세요</span>}
          </label>

          <div className="s1-field career">
            <span className="label" id="career-label">경력</span>
            <div className={`s1-input stepper ${errors.career ? 'invalid' : ''}`}>
              <button type="button" aria-label="경력 1년 줄이기" onClick={() => setCareer(career - 1)}>−</button>
              <span>
                <input value={career} inputMode="numeric" aria-labelledby="career-label" onChange={(e) => setCareer(parseInt(digits(e.target.value, 2) || '0', 10))} />
                <span>년</span>
              </span>
              <button type="button" className="plus" aria-label="경력 1년 늘리기" onClick={() => setCareer(career + 1)}>+</button>
            </div>
            {errors.career && <span className="hint error server" role="alert">{errors.career}</span>}
          </div>

          <label className="s1-field capital">
            <span className="label">자본금</span>
            <div className={`s1-input ${errors.capital ? 'invalid' : ''}`}>
              <input value={capital ? fmt(capital) : ''} inputMode="numeric" onChange={(e) => setCond({ capital: parseInt(digits(e.target.value, 7) || '0', 10) })} />
              <span>만 원</span>
            </div>
            {errors.capital
              ? <span className="hint error server" role="alert">{errors.capital}</span>
              : <span className="hint">{capitalInKorean(capital)}</span>}
          </label>

          <label className="s1-field area">
            <span className="label">희망 면적</span>
            <div className={`s1-input ${areaN > 0 && !errors.area ? '' : 'invalid'}`}>
              <input value={area} inputMode="numeric" onChange={(e) => setCond({ area: digits(e.target.value, 4) })} />
              <span>㎡</span>
            </div>
            {areaN > 0 && errors.area
              ? <span className="hint error server" role="alert">{errors.area}</span>
              : <span className={`hint ${areaN > 0 ? '' : 'error'}`}>{areaN > 0 ? `약 ${Math.round((areaN / 3.3058) * 10) / 10}평` : '㎡ 단위로 입력해 주세요'}</span>}
          </label>
        </div>

        <div className="s1-group">
          <span className="label">희망 업종</span>
          {!cats ? (
            mastersError
              ? <BoxMsg title="업종 목록을 불러오지 못했어요" desc="조건 문제는 아니에요." onRetry={onRetryMasters} />
              : <span className="hint">업종 목록을 불러오는 중…</span>
          ) : (
            <>
              <div className="s1-chips">
                {Object.keys(cats).map((k) => (
                  <button
                    key={k} type="button" className={`chip ${big === k ? 'on' : ''}`} aria-pressed={big === k}
                    onClick={() => setCond({ big: k, sub: cats[k][0].name, industry_code: cats[k][0].code })}
                  >{k}</button>
                ))}
              </div>
              {big ? (
                <div className="s1-subs">
                  <span>{big} › 세부 업종</span>
                  <div className="s1-chips" key={big}>
                    {cats[big].map((s) => (
                      <button
                        key={s.code} type="button" className={`chip sub ${cond.industry_code === s.code ? 'on' : ''}`}
                        aria-pressed={cond.industry_code === s.code} onClick={() => setCond({ sub: s.name, industry_code: s.code })}
                      >{s.name}</button>
                    ))}
                  </div>
                </div>
              ) : <span className="hint">대분류를 고르면 세부 업종이 보여요</span>}
            </>
          )}
          {errors.sub && <span className="s1-group-error" role="alert">{errors.sub}</span>}
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
          {errors.tags && <span className="s1-group-error" role="alert">{errors.tags}</span>}
        </div>
      </div>

      <aside className="rec-aside desk-only">
        <div className="card s1-summary">
          <b>입력한 조건</b>
          <dl>
            <div><dt>나이</dt><dd>{age ? `${age}세` : '—'}</dd></div>
            <div><dt>자본금</dt><dd>{capital ? `${fmt(capital)}만 원` : '—'}</dd></div>
            <div><dt>희망 면적</dt><dd>{area ? `${area}㎡` : '—'}</dd></div>
            <div><dt>경력</dt><dd>{career}년</dd></div>
            <div><dt>업종</dt><dd>{big && sub ? `${big} › ${sub}` : '—'}</dd></div>
            <div><dt>자격증</dt><dd>{tags.length}개</dd></div>
          </dl>
          <p>다음 단계에서 서울 25개 자치구 각각의 지원 사업을 찾아 가용 예산을 계산해요.</p>
        </div>
        <button type="button" className="btn-primary rec-cta" disabled={ctaOff} onClick={onNext}>지원금 계산하기</button>
      </aside>
    </div>
  );
}
