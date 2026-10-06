import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { api } from '../../lib/api';
import { fmt, requestIdText } from '../../lib/format';
import { useApiError } from '../../hooks/useApiError';
import { simulatedFailure, toApiError } from '../../lib/errors';
import { MobileHeader } from '../../components/Layout';
import { BoxMsg } from '../../components/ui';
import Step1Input from './Step1Input';
import Step2Gu from './Step2Gu';
import Step3Dong from './Step3Dong';
import { toBudgetRequest, toDongView, toGuView, toLast } from './view';
import './Recommend.css';

const STEPS = [['', '조건 입력'], ['자치구별 ', '예산 확인'], ['', '추천 행정동']];
// 계산 중 → 완료 표시 → 다음 단계 (ms). 응답이 더 빨리 와도 이만큼은 보여 준다
const LOAD_DONE = 900;
const LOAD_END = 1700;
const TOP_K = 20; // 한 페이지 20개(판정 40)
const FIELD_KEYS = { age: 'age', capital: 'capital', target_area_sqm: 'area', career_years: 'career', industry_code: 'sub', certificates: 'tags' };
const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });

// ⑩ 업종 · ⑰ 자격증은 앱에서 한 번만 받는다(명세 8.6 ⑰)
let mastersPromise = null;
function loadMasters() {
  mastersPromise ??= Promise.all([api('/regions/industries'), api('/certificates')])
    .then(([industries, certificates]) => ({ industries: industries.data.items, certificates: certificates.data.items }))
    .catch((e) => { mastersPromise = null; throw e; });
  return mastersPromise;
}

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
  const [params, setParams] = useSearchParams();
  const stepParam = Number(params.get('step'));
  const step = stepParam === 2 || stepParam === 3 ? stepParam : 1;

  const [dir, setDir] = useState(null); // 단계 전환 슬라이드 방향
  const [loading, setLoading] = useState(null); // { to, done }
  const [view, setView] = useState('list');
  const [fieldErrors, setFieldErrors] = useState({});
  const [masters, setMasters] = useState(null); // { industries, certificates }
  const [mastersError, setMastersError] = useState(false);
  const [budget, setBudget] = useState(null); // ② data
  const [warnings, setWarnings] = useState([]); // ② warnings
  const [rec, setRec] = useState(null); // ④ data
  const runId = useRef(0); // 진행 중인 요청을 취소(뒤로 가기 · 화면 이탈)할 때 올린다
  useEffect(() => () => { runId.current += 1; }, []);

  // ⑩ · ⑰
  const fetchMasters = useCallback(() => {
    setMastersError(false);
    loadMasters().then(setMasters).catch((e) => { setMastersError(true); handleError(e); });
  }, [handleError]);
  useEffect(() => { fetchMasters(); }, [fetchMasters]);
  useEffect(() => {
    const fix = masters && resolveIndustry(cond, masters.industries);
    if (fix) setCond(fix);
  }, [masters, cond, setCond]);

  const guView = useMemo(() => (budget ? toGuView(budget) : null), [budget]);
  const dongs = useMemo(() => (rec ? rec.recommendations.map(toDongView) : []), [rec]);
  const passCount = guView?.eligibleCount ?? 0;

  const { capital, area, age, sub } = cond;
  const ageN = parseInt(age, 10);
  const ageOk = ageN >= 15 && ageN <= 99;
  const ageBad = String(age ?? '') !== '' && !ageOk; // 빈 칸은 오류로 보이지 않고 버튼만 막는다
  const ctaOff = step === 1 && (!ageOk || !(capital > 0) || !(parseInt(area, 10) > 0) || !cond.industry_code)
    || (step === 2 && !passCount);

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
        setWarnings(json.warnings);
        setRec(null);
      } else {
        const json = await api('/recommendations', { method: 'POST', body: { rec_id: budget.rec_id, top_k: TOP_K } });
        if (id !== runId.current) return;
        setRec(json.data);
        setLast(toLast({
          recId: json.data.rec_id, industryCode: json.data.industry_code, sub: json.data.industry_name,
          eligibleCount: passCount, recommendations: json.data.recommendations, guView,
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

  const condLine = `${age}세 · 자본금 ${fmt(capital)}만 원 · ${sub}`;
  const ctaLabel = loading ? (loading.to === 2 ? '지원금 계산 중…' : '동네 찾는 중…') : step === 1 ? '지원금 계산하기' : `${passCount}개 구에서 동네 추천받기`;
  const ready = step === 1 || (step === 2 && guView) || (step === 3 && guView && rec);

  return (
    <>
      <MobileHeader
        title="조건으로 추천받기"
        left={<button type="button" className="mob-header-btn" aria-label="이전 단계" disabled={step === 1 && !loading} onClick={back}>‹</button>}
        right={<span className="rec-stepno">{step}/3</span>}
      />
      <main className={`page rec ${step < 3 ? 'has-cta' : ''}`}>
        <ol className="rec-steps">
          {STEPS.map(([prefix, label], i) => {
            const n = i + 1;
            const state = n < step ? 'done' : n === step ? 'cur' : '';
            return (
              <li key={label} className={state}>
                <button type="button" disabled={state !== 'done'} aria-current={state === 'cur' ? 'step' : undefined} onClick={() => go(n)}>
                  <i />
                  <span><span className="desk-only">{n} </span>{prefix && <span className={state === 'cur' ? '' : 'desk-only'}>{prefix}</span>}{label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div key={step} className={`rec-step ${dir ? `slide-${dir}` : ''}`}>
          {!ready && (restoreError ? (
            <div className="card rec-restoring">
              <BoxMsg
                title="최근 추천 결과를 불러오지 못했어요"
                desc={`잠시 후 다시 시도해 주세요.${requestIdText(restoreError)}`}
                onRetry={() => setRestoreTry((n) => n + 1)}
              />
            </div>
          ) : (
            <div className="card rec-restoring" role="status">최근 추천 결과를 불러오는 중…</div>
          ))}
          {step === 1 && (
            <Step1Input
              cond={cond} setCond={editCond} errors={fieldErrors} ageBad={ageBad} ctaOff={ctaOff} onNext={next}
              masters={masters} mastersError={mastersError} onRetryMasters={fetchMasters}
            />
          )}
          {step === 2 && guView && (
            <Step2Gu
              cond={cond} budgets={guView} warnings={warnings} passCount={passCount} view={view} setView={setView}
              onBack={back} onNext={next} onRecalc={() => run(2)} ctaOff={ctaOff}
            />
          )}
          {step === 3 && guView && rec && (
            <Step3Dong
              sub={rec.industry_name} budgets={guView} dongs={dongs} passCount={passCount} disclaimer={rec.disclaimer}
              view={view} setView={setView} onBack={back}
            />
          )}
        </div>
      </main>

      {step < 3 && (
        <div className="rec-mob-cta mob-only">
          <button type="button" className="btn-primary" disabled={ctaOff || !!loading} onClick={next}>{ctaLabel}</button>
        </div>
      )}

      {loading && (
        <div className="rec-loading">
          <div role="dialog" aria-modal="true" aria-live="polite">
            {loading.done ? <span className="check" aria-hidden="true">✓</span> : <span className="spinner" aria-hidden="true" />}
            <h2>
              {loading.to === 2
                ? (loading.done ? '받을 수 있는 지원금을 찾았어요!' : '지원금을 계산하고 있어요...')
                : (loading.done ? '나에게 맞는 동네를 골랐어요!' : '딱 맞는 동네를 찾고 있어요...')}
            </h2>
            <p>{loading.to === 2 ? condLine : `예산이 되는 ${passCount}개 구에서 ${sub} 창업지를 고르는 중`}</p>
          </div>
        </div>
      )}
    </>
  );
}
