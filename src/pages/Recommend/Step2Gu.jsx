import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/Toast';
import { fmt } from '../../lib/calc';
import { simulatedFailure } from '../../lib/errors';
import { BackIcon, ViewToggle } from '../../components/ui';

const GuVectorMap = lazy(() => import('../../components/GuVectorMap'));

const dotClass = (g) => (g.isError ? 'error' : g.isFail ? 'fail' : g.isNoRent ? 'unknown' : 'ok');

/** 자본금(파랑) + 지원금(초록) 누적 막대와 추정 초기 임대비용 눈금 */
function BudgetBar({ g }) {
  return (
    <div className="budget-bar">
      <div className="fill"><i className="cap" style={{ width: `${g.capW}%` }} /><i className="sub" style={{ width: `${g.subW}%` }} /></div>
      {g.rent != null && <i className="rent" style={{ left: `${g.rentL}%` }} />}
    </div>
  );
}

const Programs = ({ list }) => list.map((p) => <div key={p.name} className="program"><span>{p.name}</span><b>{p.amt}</b></div>);

/** 2단계: 자치구별 지원금과 예산 여유 (리스트 ↔ 지도) */
export default function Step2Gu({ cond, budgets, passCount, view, setView, onBack, onNext }) {
  const { age, capital, area, career, sub, tags } = cond;
  const [openGu, setOpenGu] = useState('관악구');
  const toast = useToast();
  const [retrying, setRetrying] = useState(null);
  const retryTimer = useRef(null);
  useEffect(() => () => clearTimeout(retryTimer.current), []);
  const retry = (name) => {
    setRetrying(name);
    retryTimer.current = setTimeout(() => {
      setRetrying(null);
      toast.error(simulatedFailure() || 'DB_UNAVAILABLE', { message: `${name} 지원 사업 정보를 아직 불러오지 못했어요. 잠시 후 다시 시도해 주세요` });
    }, 900);
  };
  const formula = (g) => `${fmt(capital)} + ${fmt(g.sub)} = ${fmt(g.budget)}만 원`;
  const failReason = (g) => `추정 초기 임대비용이 가용 예산보다 ${fmt(-g.margin)}만 원 많아요`;

  // 지도 색: 예산 여유가 클수록 진한 초록
  const mapGus = useMemo(() => {
    const maxMargin = Math.max(1, ...budgets.list.filter((g) => g.isOk).map((g) => g.margin));
    return Object.fromEntries(budgets.list.map((g) => {
      const t = g.isOk ? g.margin / maxMargin : 0;
      return [g.name, {
        hatch: g.isNoRent, dark: g.isOk && t > 0.6,
        fill: g.isError ? 'oklch(0.9 0.05 25)' : g.isFail ? 'oklch(0.93 0.004 262)' : `oklch(${(0.9 - t * 0.28).toFixed(3)} ${(0.06 + t * 0.05).toFixed(3)} 170)`,
        tip: g.isError ? '데이터 오류' : g.isNoRent ? '임대료 정보가 없어 통과시켰어요' : g.isFail ? `탈락 ${g.marginTxt}` : `예산 여유 ${g.marginTxt}`,
      }];
    }));
  }, [budgets]);

  const sel = budgets.list.find((g) => g.name === openGu);

  return (
    <>
      {+age > 39 && (
        <div className="s2-warn"><b>!</b><span>입력한 나이({age}세)가 청년창업 지원 기준(만 39세 이하)을 넘어서, 받을 수 있는 지원 사업이 적을 수 있어요.</span></div>
      )}
      <div className="rec-cols s2">
        <aside className="rec-aside">
          <div className="card s2-summary">
            <h1>25개 구 중 <em>{budgets.okCount}곳</em>에서<br />임대료를 감당할 수 있어요</h1>
            <div className="dots" aria-hidden="true">{budgets.list.map((g) => <i key={g.name} className={dotClass(g)} />)}</div>
            <div className="conds">
              {[`${age}세`, `자본금 ${fmt(capital)}만 원`, `${area}㎡`, career ? `경력 ${career}년` : '경력 없음', sub, `자격증 ${tags.length}개`].map((c) => <span key={c}>{c}</span>)}
            </div>
            <div className="legend">
              <span><i className="cap" />자본금</span><span><i className="sub" />지원금</span><span><i className="rent" />추정 초기 임대비용</span>
            </div>
            <p>예산 여유 = 가용 예산 − 추정 초기 임대비용(보증금 + 월세 3개월)</p>
          </div>
          <ViewToggle view={view} onChange={setView} />
          <div className="s2-actions desk-only">
            <button type="button" className="btn-ghost" aria-label="이전 단계" onClick={onBack}><BackIcon />이전</button>
            <button type="button" className="btn-primary rec-cta" onClick={onNext}>{passCount}개 구에서 동네 추천받기</button>
          </div>
        </aside>

        <div className="s2-main">
          {view === 'map' ? (
            <>
              <div className="card s2-map">
                <Suspense fallback={<div className="map-msg">지도를 불러오는 중…</div>}>
                  <GuVectorMap gus={mapGus} selGu={openGu} onPick={setOpenGu} />
                </Suspense>
                <div className="s2-map-legend">
                  <span><i className="scale" />예산 여유 적음 → 많음</span>
                  <span><i className="fail" />탈락<i className="hatch" />정보 없음<i className="error" />오류</span>
                </div>
              </div>
              <span className="s2-hint">구를 누르면 아래에 지원 사업과 예산이 보여요</span>
              {sel && (
                <div className="card s2-sel" key={sel.name}>
                  <div className="head">
                    <b>{sel.name}</b>
                    <span>
                      {!sel.isError && <b>{fmt(sel.budget)}만</b>}
                      <span className={sel.isOk ? 'ok' : sel.isFail || sel.isError ? 'bad' : ''}>
                        {sel.isError ? '데이터 오류' : sel.isNoRent ? '임대료 정보가 없어 통과시켰어요' : sel.isFail ? `탈락 ${sel.marginTxt}` : `여유 ${sel.marginTxt}`}
                      </span>
                    </span>
                  </div>
                  {!sel.isError && <BudgetBar g={sel} />}
                  <Programs list={sel.programs} />
                  <span className="note">
                    {sel.isError ? '지원 사업 데이터를 불러오지 못했어요. 조건 문제는 아니에요.'
                      : sel.isNone ? '매칭된 지원 사업이 없어 자본금만으로 계산했어요.'
                        : sel.isFail ? failReason(sel)
                          : `자본금 + 지원금 = ${formula(sel)} · 추정 초기 임대비용 ${sel.rent == null ? '정보 없음' : `${fmt(sel.rent)}만 원`}`}
                  </span>
                </div>
              )}
            </>
          ) : (
            <ul className="card s2-list">
              {budgets.list.map((g) => {
                const open = openGu === g.name && !g.isError;
                return (
                  <li key={g.name}>
                    <button type="button" className={`s2-row ${g.isFail ? 'fail' : ''}`} aria-expanded={open} disabled={g.isError} onClick={() => setOpenGu(open ? null : g.name)}>
                      <div className="top">
                        <span className="name">{g.name}{g.isNoRent && <span className="badge badge-gray">임대료 정보 없음</span>}</span>
                        <span className="nums">
                          {!g.isError && <b>{fmt(g.budget)}만</b>}
                          {g.isNoRent ? <span className="pass">통과</span> : <span className={g.isFail ? 'bad' : 'ok'}>{g.marginTxt}</span>}
                          {!g.isError && <i className="chev" aria-hidden="true">▾</i>}
                        </span>
                      </div>
                      {!g.isError && <BudgetBar g={g} />}
                      {g.isFail && <span className="why">탈락 · {failReason(g)}</span>}
                      {g.isNone && <span className="why">매칭된 지원 사업이 없어 자본금만으로 계산했어요</span>}
                    </button>
                    {g.isError && (
                      <div className="s2-error">
                        <span><b>지원 사업 정보를 불러오지 못했어요.</b><br />데이터 오류이며, 조건 문제는 아니에요.</span>
                        <button type="button" disabled={retrying === g.name} onClick={() => retry(g.name)}>{retrying === g.name ? '불러오는 중…' : '다시 시도'}</button>
                      </div>
                    )}
                    {open && (
                      <div className="s2-detail">
                        <div>
                          <span className="h ok">받을 수 있는 지원 사업</span>
                          <Programs list={g.programs} />
                          {g.isNone && <span className="muted">현재 조건에 맞는 사업이 없어요. 나이·업종 조건을 확인해 보세요.</span>}
                        </div>
                        {g.excluded.length > 0 && (
                          <div>
                            <span className="h">중복 수혜로 제외</span>
                            {g.excluded.map((p) => (
                              <div key={p.name} className="excluded">
                                <div className="program"><span>{p.name}</span><span>{p.amt}</span></div>
                                <span>{p.reason}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="foot">
                          <span>자본금 + 지원금 = {formula(g)}</span>
                          <span>추정 초기 임대비용 {g.rent == null ? '정보 없음' : `${fmt(g.rent)}만 원`} (보증금 + 월세 3개월 · {parseInt(area, 10) || 33}㎡ 기준)</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
