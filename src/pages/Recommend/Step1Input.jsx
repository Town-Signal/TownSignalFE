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

/**
 * 숫자 입력 칸. 입력 글자는 투명하게 두고 같은 자리에 글자를 겹쳐 그려, 바뀐 자리의 숫자만 굴러 들어오게 한다
 * (값이 커지면 아래에서, 작아지면 위에서). 자리는 '왼쪽부터 몇 번째 + 글자'로 구분하고, 처음 그릴 때는 움직이지 않는다
 */
function NumInput({ value, ...props }) {
  const text = String(value ?? '');
  const prev = useRef(null);
  const p = prev.current;
  const n = parseInt(text.replace(/\D/g, '') || '0', 10);
  const dir = p && n < p.n ? 'down' : 'up';
  const slots = [...text].map((c, i) => {
    const k = `${i}:${c}`;
    // 이미 있던 자리는 처음 정한 방향 그대로(첫 렌더의 null 포함 — ??로 읽으면 null이 'up'이 되어 괜히 굴러 들어온다)
    return { k, c, d: p ? (p.dirs.has(k) ? p.dirs.get(k) : dir) : null };
  });
  prev.current = { n, dirs: new Map(slots.map((s) => [s.k, s.d])) };
  return (
    <span className="num">
      <input value={text} {...props} />
      <span className="num-show" aria-hidden="true">
        {slots.map((s) => <span key={s.k} className={s.d ? `in-${s.d}` : undefined}>{s.c}</span>)}
      </span>
    </span>
  );
}

/**
 * 1단계: 나이 · 경력 · 자본금 · 희망 면적 · 업종(⑩) · 자격증(⑰) 입력.
 * 카드 하나에 세 묶음 — 기본 정보 | 희망 업종 | 자격증(좁으면 위아래로 쌓는다).
 * 계산 버튼과 빈 칸 안내(needText)는 화면 아래 고정 바(Recommend)에 있다. 모바일만 안내를 카드 맨 아래에도 보여 준다
 */
export default function Step1Input({ cond, setCond, errors = {}, ageBad, needText, masters, mastersError, onRetryMasters }) {
  const { age, career, capital, area, tags } = cond;
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
    <div className="card s1-form">
      <div className="page-head">
        <h1 className="page-title">내 조건을 알려주세요</h1>
        <p className="page-sub">받을 수 있는 지원금을 자치구마다 계산해 드려요.</p>
      </div>

      <div className="s1-grid">
        <section className="s1-sec s1-basic">
          <h2 className="s1-sec-title">기본 정보</h2>
          <div className="s1-fields">
            <label className="s1-field age">
              <span className="label">나이</span>
              <div className={`s1-input ${ageBad || errors.age ? 'invalid' : ''}`}>
                <NumInput
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
                  <NumInput value={career} inputMode="numeric" aria-labelledby="career-label" onChange={(e) => setCareer(parseInt(digits(e.target.value, 2) || '0', 10))} />
                  <span>년</span>
                </span>
                <button type="button" className="plus" aria-label="경력 1년 늘리기" onClick={() => setCareer(career + 1)}>+</button>
              </div>
              {errors.career && <span className="hint error server" role="alert">{errors.career}</span>}
            </div>
  
            <label className="s1-field capital">
              <span className="label">자본금</span>
              <div className={`s1-input ${errors.capital ? 'invalid' : ''}`}>
                <NumInput value={capital ? fmt(capital) : ''} inputMode="numeric" onChange={(e) => setCond({ capital: parseInt(digits(e.target.value, 7) || '0', 10) })} />
                <span>만 원</span>
              </div>
              {errors.capital
                ? <span className="hint error server" role="alert">{errors.capital}</span>
                : <span className="hint">{capitalInKorean(capital)}</span>}
            </label>
  
            <label className="s1-field area">
              <span className="label">희망 면적</span>
              <div className={`s1-input ${areaN > 0 && !errors.area ? '' : 'invalid'}`}>
                <NumInput value={area} inputMode="numeric" onChange={(e) => setCond({ area: digits(e.target.value, 4) })} />
                <span>㎡</span>
              </div>
              {areaN > 0 && errors.area
                ? <span className="hint error server" role="alert">{errors.area}</span>
                : <span className={`hint ${areaN > 0 ? '' : 'error'}`}>{areaN > 0 ? `약 ${Math.round((areaN / 3.3058) * 10) / 10}평` : '㎡ 단위로 입력해 주세요'}</span>}
            </label>
          </div>
        </section>

        <section className="s1-sec s1-group s1-ind">
          <h2 className="s1-sec-title">
            희망 업종
            {!cond.industry_code && cats && <span className="s1-need">선택 필요</span>}
          </h2>
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
        </section>

        <section className="s1-sec s1-group s1-cert">
          <h2 className="s1-sec-title">자격증 <span className="opt">선택</span></h2>
          <span className="hint">일부 지원사업 조건에 쓰여요. 목록에 없으면 직접 추가할 수 있어요</span>
          <div className="s1-tagbox">
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
          {errors.tags && <span className="s1-group-error" role="alert">{errors.tags}</span>}
        </section>

        {/* 모바일: 빈 칸 안내를 카드 맨 아래에도(데스크톱은 하단 바에만) */}
        {needText && (
          <div className="s1-foot mob-only">
            <p key={needText} className="s1-status" role="status">{needText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
