import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { useMore, usePeekOnce } from '../../hooks/useScrollHint';
import { areaText, daysUntil, fmt, manwon, requestIdText, shortDate } from '../../lib/format';
import { useMediaQuery, WIDE } from '../../hooks/useMediaQuery';
import { Icon, ViewToggle } from '../../components/ui';
import { condChips } from './view';

const GuVectorMap = lazy(() => import('../../components/GuVectorMap'));

// 넓은 화면은 구 목록 · 계산서 패널이 안에서 스크롤(스크롤바 숨김) — 3단계 동 목록처럼 아래에 더 있으면 가장자리 흐림 + ⌄,
// 처음 한 번만 목록이 살짝 올라갔다 내려온다(본 기록 ts-seen-s2-hint)
const HINT_KEY = 'ts-seen-s2-hint';

const dotClass = (g) => (g.isError ? 'error' : g.isFail ? 'fail' : g.isNoRent ? 'unknown' : 'ok');
const STATUS = { ok: '통과', unknown: '임대료 정보 없음', error: '데이터 오류', fail: '탈락' };
const STATUS_ORDER = ['ok', 'unknown', 'error', 'fail'];

/** 자본금(파랑) + 지원금(초록) 누적 막대와 추정 초기 임대비용 눈금 */
function BudgetBar({ g, lg = false }) {
  return (
    <div className={`budget-bar ${lg ? 'lg' : ''}`}>
      <div className="fill"><i className="cap" style={{ width: `${g.capW}%` }} /><i className="sub" style={{ width: `${g.subW}%` }} /></div>
      {g.rent != null && <i className="rent" style={{ left: `${g.rentL}%` }} />}
    </div>
  );
}

/**
 * 한 줄에 다 안 들어가는 글자는 줄을 바꾸지 않고 천천히 왼쪽으로 흘렀다가 돌아오며 나머지를 보여 준다(마우스를 올리면 멈춤).
 * 넘치는 만큼(--shift)을 재서 그만큼만 움직이고, 길수록 오래 걸리게 해 속도를 비슷하게 맞춘다. 동작 줄이기면 말줄임(…)
 */
function Slide({ children }) {
  const box = useRef(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const el = box.current;
    const measure = () => setShift(Math.max(0, el.firstElementChild.offsetWidth - el.clientWidth));
    const ro = new ResizeObserver(measure); // 처음 한 번 + 패널 폭 · 글자가 바뀔 때
    ro.observe(el);
    ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  const run = shift > 1;
  return (
    <span ref={box} className={`slide ${run ? 'run' : ''}`} style={run ? { '--shift': `-${shift}px`, '--dur': `${3 + shift / 12}s` } : undefined}>
      <span>{children}</span>
    </span>
  );
}

/** ③ 지원사업 공고 상세 — 사업명을 누르면 그 줄 아래에 펼친다 */
function ProgramDetail({ id }) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let alive = true;
    api(`/programs/${id}`)
      .then((json) => { if (alive) setState({ data: json.data }); })
      .catch((e) => { if (alive) setState({ error: toApiError(e) }); });
    return () => { alive = false; };
  }, [id]);

  if (state.loading) return <div className="program-detail muted">공고를 불러오는 중…</div>;
  if (state.error) {
    return (
      <div className="program-detail muted" role="alert">
        {state.error.code === 'PROGRAM_NOT_FOUND' ? '공고를 찾을 수 없어요' : `공고를 불러오지 못했어요${requestIdText(state.error)}`}
      </div>
    );
  }
  const p = state.data;
  const period = p.apply_end ? `${p.apply_start ? shortDate(p.apply_start) : ''} ~ ${shortDate(p.apply_end)}` : null;
  // ③에는 모집 상태가 없어 마감일로 본다. 마감일 당일은 모집 중
  const closed = p.apply_end != null && daysUntil(p.apply_end) < 0;
  return (
    <div className="program-detail">
      <span>{p.agency ?? '주관기관 정보 없음'} · {p.district_name} · 최대 {fmt(manwon(p.amount_max))}만 원</span>
      {period && (
        <span className="program-period">
          {closed && <span className="badge badge-closed">마감 · 매년 모집</span>}
          접수 {period}
        </span>
      )}
      {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer">공고 원문 보기 ↗</a>}
    </div>
  );
}

// 지원 사업 · 중복 수혜로 제외 · 그 밖의 지원은 공고마다 한 줄(.program). 길면 줄바꿈 대신 Slide로 흘려 보여 준다
function Programs({ list }) {
  const [open, setOpen] = useState(null);
  return list.map((p) => (
    <div key={p.id}>
      <div className="program">
        <Slide><button type="button" className="program-link" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>{p.name}</button></Slide>
        <b>{p.amt}</b>
      </div>
      {open === p.id && <ProgramDetail id={p.id} />}
    </div>
  ));
}

/** 그 밖의 지원 — 예산에 넣지 않은 현물 · 교육 등. 이름 뒤에 유형(흐린 글자), 오른쪽 끝에 공고 링크 */
function OtherSupports({ list }) {
  return (
    <div className="gu-sec">
      <span className="h">그 밖의 지원 <span className="count">{list.length}</span> <span className="sub">예산에는 넣지 않았어요</span></span>
      {list.map((o) => {
        const tags = [...o.types, ...(o.seoulWide ? ['서울 전체 · 전국'] : [])];
        return (
          <div key={o.id} className="program other">
            <Slide>{o.name}{tags.length > 0 && <span className="sub">{tags.join(', ')}</span>}</Slide>
            {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer">공고 ↗</a>}
          </div>
        );
      })}
    </div>
  );
}

const otherCountText = (counts) => Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(' · ');
const failReason = (g) => `추정 초기 임대비용이 가용 예산보다 ${fmt(-g.margin)}만 원 많아요`;

/**
 * 한 구의 예산 계산서와 지원 사업. 넓은 화면의 오른쪽 패널 · 모바일 펼침 · 모바일 지도 카드가 함께 쓴다.
 * head면 구 이름 · 상태 · 예산 막대까지 그린다(펼침은 행에 이미 있어 뺀다)
 */
function GuDetail({ g, area, capital, head = false, onRecalc }) {
  const kind = dotClass(g);
  return (
    <>
      {head && (
        <div className="gu-head">
          <b>{g.name}</b>
          <span className={`gu-status ${kind}`}>{STATUS[kind]}</span>
          {g.rentLow && <span className="badge badge-gray">추정치 · 신뢰도 낮음</span>}
        </div>
      )}
      {g.isError ? (
        <div className="s2-error">
          <span><b>지원 사업 정보를 불러오지 못했어요.</b><br />데이터 오류이며, 조건 문제는 아니에요.</span>
          <button type="button" onClick={onRecalc}>다시 계산</button>
        </div>
      ) : (
        <>
          {head && <BudgetBar g={g} lg />}
          {/* 계산서: 자본금 + 지원금 = 가용 예산, − 추정 초기 임대비용 = 예산 여유. 왼쪽 표시는 막대 색과 같다 */}
          <dl className="gu-calc">
            <div><dt><i className="cap" />자본금</dt><dd>{fmt(capital)}만 원</dd></div>
            <div><dt><i className="sub" />지원금</dt><dd>+ {fmt(g.sub)}만 원</dd></div>
            <div className="total"><dt>가용 예산</dt><dd>{fmt(g.budget)}만 원</dd></div>
            <div><dt><i className="rent" />추정 초기 임대비용</dt><dd>{g.rent == null ? '정보 없음' : `− ${fmt(g.rent)}만 원`}</dd></div>
            <div className={`result ${kind}`}>
              <dt>예산 여유</dt>
              <dd>{g.isNoRent ? '계산 불가 · 추천 대상에 포함' : `${g.marginTxt} 원`}</dd>
            </div>
          </dl>
          {g.isFail && <p className="gu-note bad">탈락 · {failReason(g)}</p>}

          <div className="gu-sec">
            <span className="h ok">받을 수 있는 지원 사업 <span className="count">{g.programs.length}</span></span>
            {g.programs.length > 0 && <Programs list={g.programs} />}
            {g.isNone && (
              <span className="muted">
                {g.others.length > 0 ? '현금 지원은 없지만 아래 다른 지원이 있어요.' : '현재 조건에 맞는 사업이 없어요. 나이·업종 조건을 확인해 보세요.'}
              </span>
            )}
          </div>
          {g.excluded.length > 0 && (
            <div className="gu-sec">
              <span className="h">중복 수혜로 제외 <span className="count">{g.excluded.length}</span></span>
              {g.excluded.map((p) => (
                <div key={p.id} className="program excluded">
                  <Slide><s>{p.name}</s><span className="sub">{p.reason}</span></Slide>
                  <s>{p.amt}</s>
                </div>
              ))}
            </div>
          )}
          {g.others.length > 0 && <OtherSupports list={g.others} />}
          <p className="gu-foot">
            추정 초기 임대비용 = 보증금 + 월세 3개월 · {areaText(area)} 기준
            {g.monthlyRent != null && ` · 월세 ${fmt(g.monthlyRent)}만 원`} · {g.name} 평균 기준 · 권리금 · 인테리어 · 집기 제외
          </p>
        </>
      )}
    </>
  );
}

const WARNING_BANNERS = {
  SUPPORT_PROGRAM_UNAVAILABLE: '지원사업 정보를 불러오지 못해 지원금 없이 계산했어요. 잠시 후 다시 계산해 보세요.',
};

/**
 * 2단계: 자치구별 지원금과 예산 여유 (리스트 ↔ 지도). 값은 ② 응답 그대로.
 * 넓은 화면(WIDE)은 위 요약 띠 + 왼쪽 목록(또는 지도) + 오른쪽 고정 계산서 패널, 그보다 좁으면 행을 눌러 펼친다
 */
export default function Step2Gu({ cond, budgets, warnings, view, setView, onRecalc }) {
  const { age, area } = cond;
  const capital = budgets.capital;
  const wide = useMediaQuery(WIDE);
  // 펼친(넓은 화면은 고른) 구는 district_code로 고른다. 지도는 geo_code로 잇는다
  const [openGu, setOpenGu] = useState(() => (budgets.list.find((g) => g.name === '관악구') ?? budgets.list[0])?.code);

  // 지도 색: 예산 여유가 클수록 진한 초록(그리기용 배율)
  const mapGus = useMemo(() => {
    const maxMargin = Math.max(1, ...budgets.list.filter((g) => g.isOk).map((g) => g.margin));
    return Object.fromEntries(budgets.list.filter((g) => g.geo).map((g) => {
      const t = g.isOk ? g.margin / maxMargin : 0;
      return [g.geo, {
        hatch: g.isNoRent, dark: g.isOk && t > 0.6,
        fill: g.isError ? 'oklch(0.9 0.05 25)' : g.isFail ? 'oklch(0.93 0.004 262)' : `oklch(${(0.9 - t * 0.28).toFixed(3)} ${(0.06 + t * 0.05).toFixed(3)} 170)`,
        tip: g.isError ? '데이터 오류' : g.isNoRent ? '임대료 정보 없음 · 추천 대상에 포함' : g.isFail ? `탈락 ${g.marginTxt}` : `예산 여유 ${g.marginTxt}`,
      }];
    }));
  }, [budgets]);

  const sel = budgets.list.find((g) => g.code === openGu);
  // 넓은 화면은 패널이 비지 않게 한다(모바일에서 접어 둔 채 화면이 넓어져도)
  const panelGu = sel ?? budgets.list.find((g) => !g.isError) ?? budgets.list[0];
  const pickGeo = (geo) => setOpenGu(budgets.list.find((g) => g.geo === geo)?.code ?? null);
  const banners = warnings.filter((w) => WARNING_BANNERS[w.code] || w.code === 'CERTIFICATE_NOT_RECOGNIZED');
  const counts = STATUS_ORDER.map((k) => [k, budgets.list.filter((g) => dotClass(g) === k).length]).filter(([, n]) => n);
  const detail = (g, head) => <GuDetail g={g} area={area} capital={capital} head={head} onRecalc={onRecalc} />;

  const listRef = useRef(null);
  const panelRef = useRef(null);
  const listMore = useMore(listRef, wide && view === 'list');
  const panelMore = useMore(panelRef, wide, panelGu?.code);
  const peek = usePeekOnce(listMore, HINT_KEY);

  return (
    <>
      {+age > 39 && (
        <div className="s2-warn"><b>!</b><span>입력한 나이({age}세)가 청년창업 지원 기준(만 39세 이하)을 넘어서, 받을 수 있는 지원 사업이 적을 수 있어요.</span></div>
      )}
      {banners.map((w) => (
        <div key={w.code} className="s2-warn" role="status"><b>!</b><span>{WARNING_BANNERS[w.code] ?? w.message}</span></div>
      ))}

      <div className={`s2-body ${wide ? 'wide' : ''}`}>
        <div className="s2-main">
          {/* 요약 띠는 왼쪽 열 맨 위 — 넓은 화면에서 오른쪽 패널이 띠 높이부터 시작한다 */}
          <section className="card s2-summary">
            <div className="s2-sum-head">
              {/* 얇은 띠: 제목 한 줄 + 옆에 개수, 아래 얇은 구 막대 */}
              <div className="s2-sum-title">
                <h1>25개 구 중 <em>{budgets.eligibleCount}곳</em>에서 임대료를 감당할 수 있어요</h1>
                <div className="dot-counts">{counts.map(([k, n]) => <span key={k}><i className={k} />{STATUS[k]} <b>{n}</b></span>)}</div>
              </div>
              <div className="dots" aria-hidden="true">{budgets.list.map((g, i) => <i key={g.code} className={dotClass(g)} style={{ animationDelay: `${i * 15}ms` }} />)}</div>
              {!budgets.eligibleCount && <p className="why">감당할 수 있는 구가 없어요. 자본금이나 업종을 조정해 보세요.</p>}
            </div>
            {/* 입력한 조건: 데스크톱은 하단 바 왼쪽(Recommend), 모바일만 여기 */}
            <div className="s2-sum-conds mob-only">
              <span className="cap-label">입력한 조건</span>
              <div className="conds">{condChips(cond, capital).map((c) => <span key={c}>{c}</span>)}</div>
            </div>
            <div className="s2-sum-side">
              <ViewToggle view={view} onChange={setView} className="compact" />
            </div>
          </section>
          {view === 'map' ? (
            <>
              <div className="card s2-map">
                <Suspense fallback={<div className="map-msg">지도를 불러오는 중…</div>}>
                  <GuVectorMap gus={mapGus} selGu={(wide ? panelGu : sel)?.geo} onPick={pickGeo} />
                </Suspense>
                <div className="s2-map-legend">
                  <span><i className="scale" />예산 여유 적음 → 많음</span>
                  <span><i className="fail" />탈락<i className="hatch" />정보 없음<i className="error" />오류</span>
                </div>
              </div>
              <span className="s2-hint">구를 누르면 {wide ? '오른쪽' : '아래'}에 지원 사업과 예산이 보여요</span>
              {!wide && sel && <div className="card s2-sel" key={sel.code}>{detail(sel, true)}</div>}
            </>
          ) : (
            <div className="card s2-list-card">
              <div className="s2-list-head">
                <div className="t">
                  <b>자치구별 가용 예산</b>
                  <span>가용 예산 큰 순 · 예산 여유 = 가용 예산 − 추정 초기 임대비용</span>
                </div>
                <div className="legend">
                  <span><i className="cap" />자본금</span><span><i className="sub" />지원금</span><span><i className="rent" />추정 초기 임대비용</span>
                </div>
              </div>
              <ul className={`s2-list ${peek ? 'peek' : ''}`} ref={listRef}>
                {budgets.list.map((g) => {
                  const on = wide && panelGu?.code === g.code;
                  const open = !wide && openGu === g.code && !g.isError;
                  return (
                    <li key={g.code}>
                      <button
                        type="button" className={`s2-row ${g.isFail ? 'fail' : ''} ${on ? 'on' : ''}`} disabled={g.isError}
                        {...(wide ? { 'aria-pressed': on } : { 'aria-expanded': open })}
                        onClick={() => setOpenGu(wide || !open ? g.code : null)}
                      >
                        <div className="top">
                          <span className="name">
                            {g.name}
                            {g.isNoRent && <span className="badge badge-gray">임대료 정보 없음</span>}
                            {g.rentLow && <span className="badge badge-gray">추정치 · 신뢰도 낮음</span>}
                          </span>
                          <span className="nums">
                            {!g.isError && <b>{fmt(g.budget)}만</b>}
                            {g.isNoRent ? <span className="m pass">정보 없음</span> : <span className={`m ${g.isFail ? 'bad' : 'ok'}`}>{g.marginTxt}</span>}
                            {!g.isError && !wide && <i className="chev" aria-hidden="true">▾</i>}
                          </span>
                        </div>
                        {!g.isError && <BudgetBar g={g} />}
                        {g.isFail && <span className="why">탈락 · {failReason(g)}</span>}
                        {g.isNone && <span className="why">매칭된 지원 사업이 없어 자본금만으로 계산했어요</span>}
                        {g.others.length > 0 && (
                          <span className="others"><b>다른 지원</b>{otherCountText(g.otherCounts) || `${g.others.length}건`}</span>
                        )}
                      </button>
                      {g.isError && (
                        <div className="s2-error">
                          <span><b>지원 사업 정보를 불러오지 못했어요.</b><br />데이터 오류이며, 조건 문제는 아니에요.</span>
                          <button type="button" onClick={onRecalc}>다시 계산</button>
                        </div>
                      )}
                      {open && <div className="s2-detail">{detail(g, false)}</div>}
                    </li>
                  );
                })}
              </ul>
              {wide && <div className={`more-hint ${listMore ? 'on' : ''} ${peek ? 'hint' : ''}`} aria-hidden="true"><Icon name="chevronDown" size={18} /></div>}
            </div>
          )}
        </div>

        {wide && (
          <aside className="s2-side">
            {panelGu && <div className="card s2-panel" key={panelGu.code} ref={panelRef}>{detail(panelGu, true)}</div>}
            <div className={`more-hint panel ${panelMore ? 'on' : ''}`} aria-hidden="true"><Icon name="chevronDown" size={18} /></div>
          </aside>
        )}
      </div>
    </>
  );
}
