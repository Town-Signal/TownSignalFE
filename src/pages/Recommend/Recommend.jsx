import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { ALL_DONGS, fmt, guBudgets } from '../../lib/calc';
import { useToast } from '../../context/Toast';
import { simulatedFailure } from '../../lib/errors';
import { MobileHeader } from '../../components/Layout';
import Step1Input from './Step1Input';
import Step2Gu from './Step2Gu';
import Step3Dong from './Step3Dong';
import './Recommend.css';

const STEPS = [['', '조건 입력'], ['자치구별 ', '예산 확인'], ['', '추천 행정동']];
// 계산 중 → 완료 표시 → 다음 단계 (ms)
const LOAD_DONE = 1200;
const LOAD_END = 2200;

export default function Recommend() {
  const { cond, setCond, setLast } = useAppState();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const stepParam = Number(params.get('step'));
  const step = stepParam === 2 || stepParam === 3 ? stepParam : 1;

  const [dir, setDir] = useState(null); // 단계 전환 슬라이드 방향
  const [loading, setLoading] = useState(null); // { to, done }
  const [view, setView] = useState('list');
  const timers = useRef([]);
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  const { capital, area, age, sub } = cond;
  const budgets = useMemo(() => guBudgets(capital, area), [capital, area]);
  // 추천 대상: 예산이 되는(또는 임대료 정보가 없는) 구에 속하고 예측이 가능한 동
  const dongs = useMemo(() => ALL_DONGS.filter((d) => !d.noPred && budgets.passNames.has(d.gu)), [budgets]);
  const passCount = budgets.passNames.size;

  const ageN = parseInt(age, 10);
  const ageBad = !(ageN >= 15 && ageN <= 99);
  const ctaOff = step === 1 && (ageBad || !(capital > 0) || !(parseInt(area, 10) > 0));

  const go = (n) => {
    setDir(n > step ? 'fwd' : 'back');
    setParams((p) => { p.set('step', n); return p; }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };
  const run = (to) => {
    clearTimers();
    setLoading({ to, done: false });
    timers.current = [setTimeout(() => {
      const error = simulatedFailure();
      if (error) {
        setLoading(null);
        toast.error(error, { onRetry: () => run(to) });
        return;
      }
      setLoading({ to, done: true });
      timers.current = [setTimeout(() => { setLoading(null); go(to); }, LOAD_END - LOAD_DONE)];
    }, LOAD_DONE)];
  };
  const next = () => {
    if (loading || ctaOff || step >= 3) return;
    run(step + 1);
  };
  const back = () => {
    if (loading) { clearTimers(); setLoading(null); } else if (step > 1) go(step - 1);
  };

  // 3단계에 도달하면 결과를 저장 → 대시보드 '최근 추천 결과', 상세·비교의 '예산 여유'
  useEffect(() => {
    if (step !== 3 || !dongs.length) return;
    const now = new Date();
    setLast({
      date: `${now.getMonth() + 1}월 ${now.getDate()}일`,
      sub,
      passCount: budgets.okCount,
      ranked: [...dongs].sort((a, b) => b.score - a.score).slice(0, 5).map((d) => ({ name: d.name, gu: d.gu, score: d.score })),
      margins: budgets.margins,
    });
  }, [step, dongs, budgets, sub, setLast]);

  const condLine = `${age}세 · 자본금 ${fmt(capital)}만 원 · ${sub}`;
  const ctaLabel = loading ? (loading.to === 2 ? '지원금 계산 중…' : '동네 찾는 중…') : step === 1 ? '지원금 계산하기' : `${passCount}개 구에서 동네 추천받기`;

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
          {step === 1 && <Step1Input cond={cond} setCond={setCond} ageBad={ageBad} ctaOff={ctaOff} onNext={next} />}
          {step === 2 && <Step2Gu cond={cond} budgets={budgets} passCount={passCount} view={view} setView={setView} onBack={back} onNext={next} />}
          {step === 3 && <Step3Dong cond={cond} budgets={budgets} dongs={dongs} passCount={passCount} view={view} setView={setView} onBack={back} />}
        </div>
      </main>

      {step < 3 && (
        <div className="rec-mob-cta mob-only">
          <button type="button" className="btn-primary" disabled={ctaOff} onClick={next}>{ctaLabel}</button>
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
