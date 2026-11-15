import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { DEFAULT_COND, useAppState } from '../../context/AppState';
import { useToast } from '../../context/Toast';
import { api } from '../../lib/api';
import { findIndustry, hasSales, loadMasters } from '../../lib/masters';
import { requestIdText } from '../../lib/format';
import { detailPath } from '../../lib/paths';
import { useApiError } from '../../hooks/useApiError';
import { usePresence } from '../../hooks/usePresence';
import { simulatedFailure, toApiError } from '../../lib/errors';
import { MobileHeader } from '../../components/Layout';
import { BackIcon, BoxMsg, Icon } from '../../components/ui';
import Step1Input from './Step1Input';
import Step2Gu from './Step2Gu';
import Step3Dong from './Step3Dong';
import RestoreSkeleton from './RestoreSkeleton';
import { condChips, sortDongs, toBudgetRequest, toDongView, toGuView, toLast } from './view';
import './Recommend.css';

const STEPS = [['', '조건 입력'], ['자치구별 ', '예산 확인'], ['', '추천 행정동']];
// 하단 바 버튼 안에서: 계산 중(스피너) → 완료(✓) → 다음 단계 (ms). 응답이 더 빨리 와도 이만큼은 보여 준다
const LOAD_DONE = 600;
const LOAD_END = 1600; // ✓ '찾았어요'를 1초 보여 준 뒤 넘어간다
const BAR_OUT_MS = 220; // 하단 바 항목이 사라지는 애니메이션 길이(Recommend.css bar-out)
const TOP_K = 20; // 한 페이지 20개(판정 40)
const FIELD_KEYS = { age: 'age', capital: 'capital', target_area_sqm: 'area', career_years: 'career', industry_code: 'sub', certificates: 'tags' };
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
// 받침이 있으면 '을', 없으면 '를'
const objParticle = (w) => ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '을' : '를');
// 다른 화면에 다녀와도 보던 단계 · 결과를 그대로 연다(메모리에만 — 새로고침하면 사라지고, 2 · 3단계는 URL의 step으로 복원)
let kept = null;


/**
 * 저장된 조건의 업종을 ⑩ 목록에 맞춘다: 코드 → 이름 → 같은 대분류 첫 업종 순.
 * 빈 폼(업종 미선택)이면 아무것도 고르지 않는다. 맞는 것이 없으면 선택을 비운다.
 */
function resolveIndustry(cond, industries) {
  if (!cond.industry_code && !cond.sub && !cond.big) return null;
  const pick = industries.find((i) => i.industry_code === cond.industry_code)
    ?? industries.find((i) => i.name === cond.sub)
    ?? industries.find((i) => i.category === cond.big);
  if (!pick) return { industry_code: null, sub: null, big: null };
  return pick.industry_code !== cond.industry_code || pick.name !== cond.sub || pick.category !== cond.big
    ? { industry_code: pick.industry_code, sub: pick.name, big: pick.category }
    : null;
}

export default function Recommend() {
  const { cond, setCond, last, setLast } = useAppState();
  const handleError = useApiError();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const stepParam = Number(params.get('step'));
  const step = stepParam === 2 || stepParam === 3 ? stepParam : 1;

  const [dir, setDir] = useState(null); // 단계 전환 슬라이드 방향
  const [loading, setLoading] = useState(null); // { to, done }
  const [view, setView] = useState(kept?.view ?? 'list');
  const [sort, setSort] = useState(kept?.sort ?? 'score'); // 3단계 정렬 탭
  const [fieldErrors, setFieldErrors] = useState({});
  const [masters, setMasters] = useState(null); // { industries, certificates }
  const [mastersError, setMastersError] = useState(false);
  const [budget, setBudget] = useState(kept?.budget ?? null); // ② data
  const [warnings, setWarnings] = useState(kept?.warnings ?? []); // ② warnings
  const [rec, setRec] = useState(kept?.rec ?? null); // ④ data
  // ② 계산에 쓴 조건 — 2 · 3단계의 '입력한 조건' 칩 · 나이 안내 · 면적 기준은 이 값으로(1단계에서 입력을 고쳐도 결과 화면과 어긋나지 않게)
  const [calcCond, setCalcCond] = useState(kept?.calcCond ?? null);
  const runId = useRef(0); // 진행 중인 요청을 취소(뒤로 가기 · 화면 이탈)할 때 올린다
  useEffect(() => () => { runId.current += 1; }, []);
  // 메뉴 '추천받기'처럼 step 없이 들어오면 보던 단계로(그리기 전에 바꿔 1단계가 비치지 않게)
  const hasStep = params.has('step');
  useLayoutEffect(() => {
    if (!hasStep && kept?.search) setParams(new URLSearchParams(kept.search), { replace: true });
  }, [hasStep, setParams]);
  useEffect(() => {
    kept = { budget, warnings, rec, calcCond, view, sort, search: hasStep ? params.toString() : null };
  }, [budget, warnings, rec, calcCond, view, sort, params, hasStep]);

  // ⑩ · ⑰
  const fetchMasters = useCallback(() => {
    setMastersError(false);
    // 매출 데이터가 없는 업종은 추천할 수 없어 뺀다(직접찾기에는 남김). 저장된 조건이 그 업종이면 resolveIndustry가 같은 대분류 첫 업종으로 맞춘다
    loadMasters().then((m) => setMasters({ ...m, industries: m.industries.filter((i) => hasSales(i.industry_code)) })).catch((e) => { setMastersError(true); handleError(e); });
  }, [handleError]);
  useEffect(() => { fetchMasters(); }, [fetchMasters]);
  useEffect(() => {
    const fix = masters && resolveIndustry(cond, masters.industries);
    if (fix) setCond(fix);
  }, [masters, cond, setCond]);

  const guView = useMemo(() => (budget ? toGuView(budget) : null), [budget]);
  const dongs = useMemo(() => (rec ? rec.recommendations.map(toDongView) : []), [rec]);
  // 3단계: 받은 목록 재정렬만 한다(7.8). 순번은 현재 탭 기준. 고른 동은 URL sel(dong_code), 없으면 1위
  const sorted = useMemo(() => sortDongs(dongs, sort).map((d, i) => ({ ...d, rank: i + 1 })), [dongs, sort]);
  const selDong = sorted.find((d) => d.code === params.get('sel')) ?? sorted[0];
  const passCount = guView?.eligibleCount ?? 0;
  // 2 · 3단계에 보여 줄 조건: 계산에 쓴 값(복원했으면 업종 이름은 ⑩ 목록 · 추천 결과에서 찾는다), 없으면 지금 입력값
  const shownCond = useMemo(() => {
    if (!calcCond) return cond;
    const sub = calcCond.sub ?? findIndustry(masters?.industries, calcCond.industry_code)?.name ?? rec?.industry_name ?? cond.sub;
    return { ...cond, ...calcCond, sub };
  }, [calcCond, cond, masters, rec]);

  const { capital, area, age } = cond;
  const ageN = parseInt(age, 10);
  const ageOk = ageN >= 15 && ageN <= 99;
  const ageBad = String(age ?? '') !== '' && !ageOk; // 빈 칸은 오류로 보이지 않고 버튼만 막는다
  // 1단계 계산을 막는 빈 칸 — 하단 바(모바일은 카드 맨 아래)에서 이유를 알려 준다
  const needLabels = step === 1
    ? [[!ageOk, '나이'], [!(capital > 0), '자본금'], [!(parseInt(area, 10) > 0), '희망 면적'], [!cond.industry_code, '업종']]
      .filter(([missing]) => missing).map(([, label]) => label)
    : [];
  const needText = needLabels.length ? `${needLabels.join(' · ')}${objParticle(needLabels.at(-1))} 채우면 계산할 수 있어요` : '';
  const ctaOff = needLabels.length > 0 || (step === 2 && !passCount);
  // 하단 바 항목: 사라질 때도 애니메이션이 끝날 때까지 붙잡아 둔다([보여 줄 값, 나가는 중])
  const [barStatus, statusLeaving] = usePresence(needText || null, BAR_OUT_MS);
  const [barConds, condsLeaving] = usePresence(step >= 2 ? 'conds' : null, BAR_OUT_MS);
  const [barBack, backLeaving] = usePresence(step >= 2 ? 'back' : null, BAR_OUT_MS);

  const editCond = (patch) => {
    setCond(patch);
    setFieldErrors((cur) => Object.fromEntries(Object.entries(cur).filter(([k]) => !(k in patch))));
  };
  const showFieldErrors = (errors) => {
    const mapped = {};
    errors.forEach((e) => {
      const key = FIELD_KEYS[String(e.field).split('.')[0]];
      if (key && !mapped[key]) mapped[key] = e.message;
    });
    setFieldErrors(mapped);
    return Object.keys(mapped).length > 0;
  };

  const go = useCallback((n, { replace = true } = {}) => {
    setDir(n > step ? 'fwd' : 'back');
    setParams((p) => { p.set('step', n); return p; }, { replace });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step, setParams]);

  /** ② 또는 ④를 부르고 로딩 연출이 끝나면 다음 단계로 */
  const run = async (to) => {
    const id = ++runId.current;
    const started = Date.now();
    setLoading({ to, done: false });
    try {
      const forced = simulatedFailure(); // 개발용 ?fail= 미리보기
      if (forced) throw forced;
      if (to === 2) {
        const json = await api('/programs/calculate-budgets', { method: 'POST', body: toBudgetRequest(cond) });
        if (id !== runId.current) return;
        setBudget(json.data);
        setCalcCond(cond);
        setWarnings(json.warnings);
        setRec(null);
      } else {
        const json = await api('/recommendations', { method: 'POST', body: { rec_id: budget.rec_id, top_k: TOP_K } });
        if (id !== runId.current) return;
        setRec(json.data);
        setSort('score'); // 새 추천은 늘 종합점수순으로 연다(이전 결과에서 바꾼 정렬이 남지 않게)
        setLast(toLast({
          recId: json.data.rec_id, industryCode: json.data.industry_code, sub: json.data.industry_name,
          eligibleCount: passCount, recommendations: json.data.recommendations, districtBudgets: budget.district_budgets,
        }));
      }
      await wait(Math.max(0, LOAD_DONE - (Date.now() - started)));
      if (id !== runId.current) return;
      setLoading({ to, done: true });
      await wait(LOAD_END - LOAD_DONE);
      if (id !== runId.current) return;
      setLoading(null);
      go(to);
    } catch (e) {
      if (id !== runId.current) return;
      setLoading(null);
      handleError(e, { onRetry: () => run(to), onFieldErrors: to === 2 ? showFieldErrors : undefined });
    }
  };
  const next = () => {
    if (loading || ctaOff || step >= 3) return;
    run(step + 1);
  };
  const back = () => {
    if (loading) { runId.current += 1; setLoading(null); } else if (step > 1) go(step - 1);
  };
  /** 초기화 직전 상태로 되돌린다(토스트 [되돌리기]). 화면을 떠난 뒤 눌러도 kept로 다시 열린다 */
  const undoReset = (snap) => {
    kept = snap;
    setCond(snap.cond);
    setBudget(snap.budget); setWarnings(snap.warnings); setRec(snap.rec); setCalcCond(snap.calcCond);
    setSort(snap.sort); setView(snap.view);
    setDir('fwd');
    setParams(new URLSearchParams(snap.search), { replace: true });
  };
  /** 입력 · 결과를 처음 상태로 비우고 1단계로(대시보드의 최근 추천 기록은 그대로). 확인 창 대신 토스트로 되돌릴 수 있게 */
  const reset = () => {
    const snap = { cond, budget, warnings, rec, calcCond, sort, view, search: params.toString() };
    toast.show({ message: '입력과 결과를 초기화했어요', actionLabel: '되돌리기', onAction: () => undoReset(snap), duration: 6000 });
    runId.current += 1;
    setLoading(null);
    setBudget(null); setWarnings([]); setRec(null); setCalcCond(null);
    setSort('score'); setView('list'); setFieldErrors({});
    setCond(DEFAULT_COND);
    go(1);
  };

  // 새로고침 · 대시보드 '전체 결과 보기'로 2 · 3단계에 바로 들어온 경우 — 저장된 rec_id로 복원한다.
  // 취소는 effect cleanup(alive)으로만 한다. StrictMode의 effect 재실행 · 단계 이동에도 로딩이 남지 않게.
  const [restoreError, setRestoreError] = useState(null);
  const [restoreTry, setRestoreTry] = useState(0);
  const needRestore = step !== 1 && !loading && !(budget && (step === 2 || rec));
  const restoreId = budget?.rec_id ?? last?.rec_id ?? null;
  useEffect(() => {
    if (!needRestore) return undefined;
    if (!restoreId) { go(1); return undefined; } // 저장된 결과가 없으면 1단계로
    let alive = true;
    setRestoreError(null);
    (async () => {
      try {
        if (!budget) {
          const snap = (await api(`/recommendations/${restoreId}`)).data; // ⑤
          if (!alive) return;
          setBudget({
            rec_id: snap.rec_id, base_quarter: snap.base_quarter, own_capital: snap.input_condition.capital,
            degraded: snap.degraded, summary: snap.summary, district_budgets: snap.district_budgets,
          });
          // 저장된 입력 조건(② 요청과 같은 이름). 빠진 값은 지금 입력값으로 채운다(shownCond)
          const ic = snap.input_condition;
          setCalcCond({
            ...(ic.age != null && { age: String(ic.age) }),
            ...(ic.career_years != null && { career: ic.career_years }),
            ...(ic.target_area_sqm != null && { area: String(ic.target_area_sqm) }),
            ...(Array.isArray(ic.certificates) && { tags: ic.certificates }),
            ...(ic.industry_code && { industry_code: ic.industry_code, sub: null }),
          });
        }
        if (step === 3) {
          // ⑤ items에는 점수 분해가 없어 ④를 같은 rec_id로 다시 실행해 복원한다(같은 결과를 다시 저장)
          const json = await api('/recommendations', { method: 'POST', body: { rec_id: restoreId, top_k: TOP_K } });
          if (!alive) return;
          setRec(json.data);
        }
      } catch (e) {
        if (!alive) return;
        const err = toApiError(e);
        if (err.code === 'REC_NOT_FOUND') {
          handleError(err); // ts-last의 rec_id만 지운다
          go(1);
        } else {
          setRestoreError(err); // 화면 안에 오류 문구 + 다시 시도
        }
      }
    })();
    return () => { alive = false; };
    // budget은 ⑤로 채운 뒤 ④만 이어서 부르므로 의존성에서 뺀다(채우는 순간 진행 중인 ④를 취소하지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needRestore, restoreId, step, restoreTry, go, handleError]);

  const ctaLabel = loading
    ? (loading.to === 2 ? (loading.done ? '지원금을 찾았어요' : '지원금 계산 중…') : (loading.done ? '동네를 골랐어요' : '동네 찾는 중…'))
    : step === 1 ? '지원금 계산하기' : `${passCount}개 구에서 동네 추천받기`;
  const ready = step === 1 || (step === 2 && guView) || (step === 3 && guView && rec);

  return (
    <>
      <MobileHeader
        title="조건으로 추천받기"
        left={<button type="button" className="mob-header-btn" aria-label="이전 단계" disabled={step === 1 && !loading} onClick={back}>‹</button>}
        right={step >= 2 && <button type="button" className="rec-reset-m" onClick={reset}>초기화</button>}
      />
      <main className={`page rec ${step < 3 ? 'has-cta' : 'is-s3'} ${step === 2 ? 'is-s2' : ''}`}>
        {/* 단계 표시는 보여 주기만 한다(눌러서 이동하지 않음). 되돌아가기는 하단 바 [이전] · 모바일 상단 바 ‹ */}
        <ol className="rec-steps">
          {STEPS.map(([prefix, label], i) => {
            const n = i + 1;
            const state = n < step ? 'done' : n === step ? 'cur' : '';
            return (
              <li key={label} className={state} aria-current={state === 'cur' ? 'step' : undefined}>
                <i />
                <span className="lbl">
                  {/* ✓로 바뀔 때 다시 그려 톡 나타나게(key) */}
                  <b key={state === 'done' ? 'done' : 'todo'} className="no desk-only" aria-hidden="true">{state === 'done' ? '✓' : n}</b>
                  <span>{prefix && <span className={state === 'cur' ? '' : 'desk-only'}>{prefix}</span>}{label}</span>
                </span>
              </li>
            );
          })}
        </ol>

        {/* 계산 중에는 본문을 살짝 흐리게 하고 잠근다(입력이 바뀌면 결과가 어긋나므로). 진행 표시는 하단 바 버튼 안에 */}
        <div key={step} className={`rec-step ${dir ? `slide-${dir}` : ''}`} inert={loading ? '' : undefined} aria-busy={!!loading}>
          {!ready && (restoreError ? (
            <div className="card rec-restoring">
              <BoxMsg
                title="최근 추천 결과를 불러오지 못했어요"
                desc={`잠시 후 다시 시도해 주세요.${requestIdText(restoreError)}`}
                onRetry={() => setRestoreTry((n) => n + 1)}
              />
            </div>
          ) : (
            <><span className="sr-only" role="status">최근 추천 결과를 불러오는 중…</span><RestoreSkeleton step={step} /></>
          ))}
          {step === 1 && (
            <Step1Input
              cond={cond} setCond={editCond} errors={fieldErrors} ageBad={ageBad} needText={needText}
              masters={masters} mastersError={mastersError} onRetryMasters={fetchMasters}
            />
          )}
          {step === 2 && guView && (
            <Step2Gu
              cond={shownCond} budgets={guView} warnings={warnings} view={view} setView={setView} onRecalc={() => run(2)}
            />
          )}
          {step === 3 && guView && rec && (
            <Step3Dong
              sub={rec.industry_name} industryCode={rec.industry_code} budgets={guView} passCount={passCount} disclaimer={rec.disclaimer}
              sorted={sorted} sel={selDong} sort={sort} onSort={setSort}
              view={view} setView={setView} onBack={back}
            />
          )}
        </div>
      </main>

      {/* 다음 동작 버튼은 모든 단계에서 화면 아래 같은 자리(모바일은 탭바 위, 데스크톱은 맨 아래 바의 오른쪽).
          데스크톱은 왼쪽에 1단계 빈 칸 안내 · 2 · 3단계 입력한 조건(같은 자리에 겹쳐 바뀜), 오른쪽에 [이전](2 · 3단계) + 버튼.
          3단계 버튼은 고른 동의 [상세 분석 보기](모바일도 카드를 눌러 고른다). 추천할 동이 없으면 모바일은 바를 숨긴다(빈 바).
          단계가 바뀌어도 바는 그대로 남고, 안의 항목만 은은하게 생기고 사라진다 */}
      {/* 결과를 복원하는 중(2 · 3단계 새로고침 등)에는 바를 띄우지 않는다 — '0개 구에서…'처럼 결과로 오해할 문구가 보이지 않게 */}
      {ready && (
        <div className={`rec-bar ${step === 3 && !selDong ? 'desk-only' : ''}`}>
          <div className="rec-bar-in">
            <div className="rec-bar-left desk-only">
              {barStatus && <p key={barStatus} className={`s1-status ${statusLeaving ? 'leaving' : ''}`} role="status">{barStatus}</p>}
              {barConds && guView && (
                <div className={`rec-bar-conds ${condsLeaving ? 'leaving' : ''}`}>
                  <span className="cap-label">입력한 조건</span>
                  <div className="conds">{condChips(shownCond, guView.capital).map((c) => <span key={c}>{c}</span>)}</div>
                </div>
              )}
            </div>
            <div className="rec-bar-act">
              {barBack && (
                <button
                  type="button" className={`rec-bar-reset desk-only ${backLeaving ? 'leaving' : ''}`}
                  tabIndex={backLeaving ? -1 : undefined} onClick={reset}
                >초기화</button>
              )}
              {barBack && (
                <button
                  type="button" className={`btn-ghost rec-bar-back desk-only ${backLeaving ? 'leaving' : ''}`}
                  aria-label="이전 단계" tabIndex={backLeaving ? -1 : undefined} onClick={back}
                ><BackIcon />이전</button>
              )}
              {step < 3 ? (
                // 계산 중에도 파란 버튼 그대로(비활성 회색으로 바꾸지 않음) — 스피너 → ✓ 로 바뀌고 다시 눌리지 않는다
                <button
                  type="button" className={`btn-primary rec-cta ${loading ? 'is-loading' : ''}`} disabled={ctaOff && !loading}
                  aria-busy={!!loading} onClick={next}
                >
                  {loading && (loading.done
                    ? <Icon name="check" size={18} className="cta-done" />
                    : <span className="cta-spin" aria-hidden="true" />)}
                  <span key={ctaLabel} className="cta-lbl" aria-live="polite">{ctaLabel}</span>
                  {!loading && <Icon name="arrowRight" size={18} />}
                </button>
              ) : selDong && (
                <Link to={detailPath(selDong.code, { industryCode: rec.industry_code, from: 'rec' })} className="btn-primary rec-cta">
                  <span className="t">{selDong.name} 상세 분석 보기</span><Icon name="arrowRight" size={18} />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

    </>
  );
}
