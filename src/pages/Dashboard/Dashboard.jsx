import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { api } from '../../lib/api';
import { detailPath } from '../../lib/paths';
import { daysUntil, fmt, growthText, manwon, rateColor, requestIdText, scoreText, shortDate, signed } from '../../lib/format';
import { survStyle, survivalView } from '../../lib/survival';
import { simulatedFailure, toApiError } from '../../lib/errors';
import { useApiError } from '../../hooks/useApiError';
import { useApiData } from '../../hooks/useApiData';
import { useDongNames } from '../../hooks/useDongNames';
import { useIndustries } from '../../hooks/useIndustries';
import { usePresence } from '../../hooks/usePresence';
import { REDUCED_MOTION, useMediaQuery } from '../../hooks/useMediaQuery';
import { findIndustry } from '../../lib/masters';
import { Brand, MobileHeader } from '../../components/Layout';
import { BoxMsg, HeartButton, Icon, LowDot, ResidentialBadge, Sk, Toast } from '../../components/ui';
import { lastTopItem } from '../Recommend/view';
import './Dashboard.css';

const UNDO_MS = 4000;
const URGENT_DAYS = 7;
const CLOSED_PREVIEW = 3; // 마감 묶음은 처음에 이만큼만 보이고 '더 보기'로 펼친다
const GU_TOTAL = 25;
const RING_R = 32;
const RING_C = 2 * Math.PI * RING_R;
// 히어로 빛 알갱이 [left %, top %, 지름 px, 한 바퀴 초, 시작 위치 초] — 글자가 없는 오른쪽에 몰아 두고,
// 주기 · 시작을 제각각 줘 같은 장면이 반복돼 보이지 않게(그리기용 고정값)
const PARTICLES = [
  [48, 70, 3, 13, 2], [54, 30, 2, 17, 9], [58, 82, 4, 15, 5], [62, 18, 2, 19, 12],
  [66, 55, 3, 14, 1], [71, 88, 2, 18, 7], [74, 36, 4, 16, 11], [79, 64, 2, 13, 4],
  [83, 22, 3, 20, 14], [86, 76, 2, 15, 8], [90, 44, 3, 17, 3], [94, 12, 2, 14, 10],
  [36, 92, 2, 18, 6], [97, 60, 3, 16, 13], [51, 48, 2, 16, 15], [69, 8, 3, 18, 3],
  [77, 92, 3, 14, 9], [88, 58, 2, 19, 16], [57, 62, 2, 15, 12], [92, 86, 4, 17, 6],
];

/** 종합점수 링(0~100). 서버 점수를 비율로 그리기만 한다. 없으면 빈 링에 '—' */
function ScoreRing({ score }) {
  const pct = score == null ? 0 : Math.min(Math.max(score, 0), 100) / 100;
  return (
    <div className="score-ring">
      <svg viewBox="0 0 76 76" aria-hidden="true">
        <defs>
          {/* 색은 Dashboard.css의 #dash-ring-grad stop 한 곳에서 정한다 */}
          <linearGradient id="dash-ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" />
            <stop offset="1" />
          </linearGradient>
        </defs>
        <circle className="track" cx="38" cy="38" r={RING_R} />
        {pct > 0 && <circle className="val" cx="38" cy="38" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - pct)} style={{ '--c': RING_C }} />}
      </svg>
      <b>{scoreText(score)}</b>
    </div>
  );
}

// 소개 띠 제목 — 몇 초마다 은은하게 바뀐다. 줄 길이는 모바일(26px)에서도 두 줄에 들어가게 맞춘다
const HEADLINES = [
  ['가게 열 동네,', '감 말고 데이터로 정해요'],
  ['지원금을 더하면', '갈 수 있는 동네가 늘어나요'],
  ['서울 25개 구,', '내 예산으로 어디까지 갈까요'],
  ['매출도 영업 유지도,', '열기 전에 미리 따져 봐요'],
  ['놓치기 쉬운 창업 지원금,', '한 번에 계산해 드려요'],
];
const HEADLINE_MS = 6000; // 한 문장을 보여 주는 시간
const HEADLINE_OUT_MS = 300; // 나가는 애니메이션 길이(CSS head-out과 맞춘다)

/**
 * 돌아가는 제목. 모든 문장을 같은 칸에 겹쳐 두고 지금 것만 보여서, 바뀔 때 아래 내용이 움직이지 않는다.
 * 마우스를 올리면 멈추고, '동작 줄이기' 설정이면 첫 문장에 머문다. 화면 읽기 프로그램은 지금 문장만 읽는다(나머지는 aria-hidden)
 */
function RotatingHeadline({ id }) {
  const reduce = useMediaQuery(REDUCED_MOTION);
  const [paused, setPaused] = useState(false);
  const [{ i, out }, setHead] = useState({ i: 0, out: false });
  useEffect(() => {
    if (reduce || paused) return undefined;
    let swap;
    const tick = setInterval(() => {
      setHead((s) => ({ ...s, out: true }));
      swap = setTimeout(() => setHead((s) => ({ i: (s.i + 1) % HEADLINES.length, out: false })), HEADLINE_OUT_MS);
    }, HEADLINE_MS);
    return () => {
      clearInterval(tick);
      clearTimeout(swap);
      setHead((s) => (s.out ? { ...s, out: false } : s)); // 나가는 도중에 멈추면 지금 문장을 다시 보인다
    };
  }, [reduce, paused]);

  return (
    <h1 id={id} className="rot-head" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {HEADLINES.map(([a, b], k) => (
        <span key={a} className={`rot${k === i ? ' on' : ''}${k === i && out ? ' out' : ''}`} aria-hidden={k !== i}>{a}<br />{b}</span>
      ))}
    </h1>
  );
}

/** 히어로 숫자 칩 — 값이 아직 없으면(불러오는 중) 숫자 자리에 막대 */
/** 숫자가 지금 값에서 목표까지 올라간다(.8초, 끝에서 느려짐 — 처음엔 0부터). 동작 줄이기면 바로 목표값 */
function CountUp({ to }) {
  const reduce = useMediaQuery(REDUCED_MOTION);
  const [n, setN] = useState(reduce ? to : 0);
  const cur = useRef(n);
  useEffect(() => {
    if (reduce) { cur.current = to; setN(to); return undefined; }
    const from = cur.current;
    const start = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 800);
      cur.current = Math.round(from + (to - from) * (1 - (1 - p) ** 3));
      setN(cur.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, reduce]);
  return n;
}

function HeroStat({ href, label, value, unit }) {
  return (
    <li>
      <a href={href}>
        <span>{label}</span>
        <b>{value == null ? <Sk w="2.4em" h="1em" className="on-dark" />
          : <span className="fade-in">{typeof value === 'number' ? <CountUp to={value} /> : value}<small>{unit}</small></span>}</b>
      </a>
    </li>
  );
}

/** ① 공고 한 줄(표시용): 모집 상태 · D-day · 마감일 · 최대 금액(만 원) */
const toNotice = (p) => {
  const dday = daysUntil(p.apply_end);
  // 옛 응답에는 status가 없고, 그때 ①은 모집 중인 공고만 보냈다
  const closed = (p.status ?? '모집 중') === '마감';
  return {
    id: p.program_id,
    title: p.name,
    org: p.agency ?? p.district_name,
    amt: `최대 ${fmt(manwon(p.amount_max))}만`,
    href: p.source_url,
    dday,
    closed,
    urgent: !closed && dday != null && dday <= URGENT_DAYS,
    // 마감 공고는 내년 같은 시기 모집을 안내한다(apply_end의 월)
    deadlineTxt: !p.apply_end ? '' : closed ? `매년 ${Number(p.apply_end.slice(5, 7))}월경` : `${shortDate(p.apply_end)} 마감`,
  };
};

/** ① 한 줄 — 모집 중은 D-n 칩, 마감은 흐린 행에 '마감' 칩 */
function NoticeRow({ n }) {
  return (
    <li className={n.closed ? 'closed' : undefined}>
      <a href={n.href} target="_blank" rel="noopener noreferrer">
        {n.closed ? <span className="dday closed">마감</span>
          : n.dday != null ? <span className={`dday ${n.urgent ? 'urgent' : ''}`}>D-{n.dday}</span>
            : <span className="dday open">모집 중</span>}
        <span className="body"><b>{n.title}</b><span>{n.org} · <span className="nw">{n.amt}</span>{n.closed && <span className="deadline-inline"> · {n.deadlineTxt}</span>}</span></span>
        <span className="deadline">{n.deadlineTxt}</span>
        <Icon name="external" size={16} className="ext" />
      </a>
    </li>
  );
}

/** ① 지원 일정을 받는 동안 — 같은 카드 · 두 묶음에 공고 줄 자리(D-day · 제목 · 기관)만 막대 */
function NoticeSkeleton() {
  const row = (i) => (
    <li key={i}><a aria-hidden="true"><Sk w={52} h={30} r={9} /><span className="body"><Sk w="65%" h={16} /><Sk w="40%" h={12} /></span></a></li>
  );
  return (
    <div className="card notice-card" aria-busy="true">
      <span className="sr-only" role="status">공고를 불러오는 중…</span>
      <div className="notice-group">
        <span className="notice-group-h"><i className="dot open" aria-hidden="true" />지금 모집 중</span>
        <ul className="notice-list">{[0, 1, 2].map(row)}</ul>
      </div>
      <div className="notice-group">
        <span className="notice-group-h"><i className="dot" aria-hidden="true" />올해 마감 · 내년 같은 시기 모집 예상</span>
        <ul className="notice-list">{[3, 4, 5].map(row)}</ul>
      </div>
    </div>
  );
}

/** ① 지원 일정 — 서버 순서 그대로 status로 '지금 모집 중' · '올해 마감' 두 묶음으로 가른다 */
function NoticeGroups({ items }) {
  const [showAll, setShowAll] = useState(false);
  const open = items.filter((n) => !n.closed);
  const closed = items.filter((n) => n.closed);
  const shown = showAll ? closed : closed.slice(0, CLOSED_PREVIEW);
  return (
    <div className="card notice-card">
      <div className="notice-group">
        <span className="notice-group-h"><i className="dot open" aria-hidden="true" />지금 모집 중</span>
        {open.length
          ? <ul className="notice-list">{open.map((n) => <NoticeRow key={n.id} n={n} />)}</ul>
          : <p className="notice-none">지금 모집 중인 공고가 없어요</p>}
      </div>
      {closed.length > 0 && (
        <div className="notice-group">
          <span className="notice-group-h"><i className="dot" aria-hidden="true" />올해 마감 · 내년 같은 시기 모집 예상</span>
          <ul className="notice-list">{shown.map((n) => <NoticeRow key={n.id} n={n} />)}</ul>
          {!showAll && closed.length > CLOSED_PREVIEW && (
            <button type="button" className="notice-more" onClick={() => setShowAll(true)}>더 보기 ({closed.length - CLOSED_PREVIEW})</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { favs, last, setLast, addFav, removeFav, favIndustry } = useAppState();
  const handleError = useApiError();

  // ① 지원 일정 — 서버 순서(모집 중 마감 가까운 순 → 마감 최근 순)
  const [notices, setNotices] = useState({ loading: true });
  const loadNotices = useCallback(() => {
    setNotices((cur) => ({ ...cur, loading: true }));
    const forced = simulatedFailure(); // 개발용 ?fail= 미리보기
    (forced ? Promise.reject(forced) : api('/programs/upcoming'))
      .then((json) => setNotices({ items: json.data.items.map(toNotice) }))
      .catch((e) => setNotices({ error: toApiError(e) }));
  }, []);
  useEffect(() => { loadNotices(); }, [loadNotices]);

  // 최근 추천 결과 — ts-last로 먼저 그리고, rec_id가 있으면 ⑤로 최신 값으로 바꾼다(판정 41)
  const refreshed = useRef(null);
  useEffect(() => {
    const recId = last?.rec_id;
    if (!recId || refreshed.current === recId) return;
    refreshed.current = recId;
    api(`/recommendations/${recId}`)
      .then((json) => setLast((cur) => (cur?.rec_id === recId ? {
        ...cur,
        passCount: json.data.summary.eligible_district_count,
        top: json.data.items.length ? json.data.items.slice(0, 5).map(lastTopItem) : cur.top,
      } : cur)))
      .catch((e) => handleError(e)); // REC_NOT_FOUND → ts-last의 rec_id만 지우고 저장된 요약은 그대로
  }, [last?.rec_id, setLast, handleError]);
  const [undo, setUndo] = useState(null);
  const [undoToast, undoLeaving] = usePresence(undo); // 닫힌 뒤에도 내려가는 동안 그린다
  const undoTimer = useRef(null);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  // 이름은 카드가 받는 ⑫에서. 업종을 모르는 카드만 ⑧ · ⑨로 찾는다
  const fallbackNames = useDongNames(favs.filter((c) => !favIndustry(c)).map((c) => [c, null]));
  const industries = useIndustries();
  const ranked = last?.top ?? [];
  const first = ranked[0];
  const firstSurv = survivalView(first); // ts-last.top → ⑤ items로 교체(영업 유지 칸 규칙은 lib/survival)
  // 히어로 칩: 받아 둔 공고를 세기만 한다(불러오는 중이면 undefined → '…')
  const openCount = notices.items?.filter((n) => !n.closed).length;
  const urgentCount = notices.items?.filter((n) => n.urgent).length;
  const industryName = findIndustry(industries, last?.industry_code)?.name ?? last?.sub ?? null;
  // 1위 동이 속한 구의 예산 여유(만 원). ts-last.margins = { district_code(동 코드 앞 5자리): 원 | null }
  // 키가 없으면(예전 기록) 칸을 숨기고, null이면 '정보 없음'
  const firstMarginWon = first ? last.margins?.[first.dong_code.slice(0, 5)] : undefined;
  const firstMargin = firstMarginWon === undefined ? undefined : manwon(firstMarginWon);

  // ♡ 해제 → 토스트 + 되돌리기(원래 위치 · 업종 그대로 복구). 연속 해제 시 마지막 건만 되돌린다(10.2)
  const unfav = (code, name) => {
    setUndo({ code, industryCode: favIndustry(code), at: favs.indexOf(code), name });
    removeFav(code);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };
  const restore = () => {
    if (!undo) return; // 토스트가 내려가는 중(이미 닫힘)
    addFav(undo.code, undo.industryCode, undo.at);
    clearTimeout(undoTimer.current);
    setUndo(null);
  };

  return (
    <>
      <MobileHeader><Brand size={24} /></MobileHeader>
      <main className="dash-main">
        {/* 헤더 바로 아래 화면 끝까지 붙은 파란 띠. 최근 추천 결과가 있으면 결과를, 없으면 소개와 계산 버튼을 보여 준다 */}
        <section className={`dash-hero ${first ? 'is-result' : 'is-intro'}`} aria-labelledby="dash-hero-title">
          <Icon name="sparkle" filled size={180} className="hero-spark big" />
          <Icon name="sparkle" filled size={36} className="hero-spark small" />
          <Icon name="sparkle" filled size={18} className="hero-spark tiny t1" />
          <Icon name="sparkle" filled size={14} className="hero-spark tiny t2" />
          <div className="hero-dots" aria-hidden="true">
            {PARTICLES.map(([x, y, s, d, at]) => (
              <i key={`${x}-${y}`} style={{ '--x': `${x}%`, '--y': `${y}%`, '--s': `${s}px`, '--d': `${d}s`, '--at': `-${at}s` }} />
            ))}
          </div>
          <div className="hero-inner">
            {first ? (
              <>
                <div className="hero-res">
                  {/* 왼쪽: 소개 화면과 같은 문법 — 1위 동네를 큰 제목으로 */}
                  <div className="hero-copy res-main">
                    <span className="hero-eyebrow">최근 추천 결과 · {last.date}</span>
                    {/* 점수 링을 이름 바로 옆에 — '82점 · 망원1동'이 한 덩어리로 읽힌다 */}
                    <div className="res-title">
                      <div className="res-score"><ScoreRing score={first.score} /><span>종합점수</span></div>
                      <div className="res-name">
                        <span className="res-label"><span className="res-rank">1위</span>{industryName ? `${industryName} 추천` : '내 조건 추천'}</span>
                        <div className="res-h">
                          <h1 id="dash-hero-title">{first.name}</h1>
                          <span className="res-gu">{first.gu}</span>
                        </div>
                      </div>
                    </div>
                    <dl className="res-stats">
                      <div>
                        {/* '신뢰도 낮음'은 값 아래가 아니라 항목 이름 옆에 — 지표 줄 높이가 들쭉날쭉하지 않게 */}
                        <dt>
                          {firstSurv.label}
                          {firstSurv.low && <span className="low-tag"><LowDot decorative />신뢰도 낮음</span>}
                        </dt>
                        <dd style={survStyle(firstSurv)} title={firstSurv.note}>
                          {firstSurv.main}{firstSurv.sub && <span className="surv-sub">{firstSurv.sub}</span>}
                        </dd>
                      </div>
                      <div><dt>예상 월매출</dt><dd>{first.sales_monthly_p50 == null ? '정보 없음' : `월 ${fmt(manwon(first.sales_monthly_p50))}만`}</dd></div>
                      <div><dt>성장세</dt><dd style={{ color: rateColor(first.growth_rate) }}>{growthText(first.growth_rate) ?? '—'}</dd></div>
                      {firstMargin !== undefined && (
                        <div>
                          <dt>예산 여유</dt>
                          <dd style={firstMargin == null ? undefined : { color: firstMargin >= 0 ? 'var(--green)' : 'var(--down)' }}>
                            {firstMargin == null ? '정보 없음' : signed(firstMargin)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="hero-actions">
                      <Link to={detailPath(first.dong_code, { industryCode: last.industry_code, from: 'rec' })} className="hero-cta">
                        상세 분석 보기<Icon name="arrowRight" size={18} />
                      </Link>
                      {/* 좁은 화면에서는 '다시 계산'만 보여 두 버튼을 한 줄에 둔다 */}
                      <Link to="/recommend?step=1" className="hero-ghost"><span className="long">새 조건으로&nbsp;</span>다시 계산</Link>
                    </div>
                  </div>

                  {/* 오른쪽: 소개 화면의 숫자 칩과 같은 유리 패널 — 2~5위 작은 표(동네 · 월매출 · 성장세 · 점수) */}
                  <div className="res-side">
                    {/* 패널 제목: 이 구들 안에서 고른 추천 동네라는 흐름 */}
                    <div className="res-pass">
                      <span>내 예산으로 갈 수 있는 구</span><b>{last.passCount}</b><span className="of">/ {GU_TOTAL}</span>
                    </div>
                    <div className="rest-cap" aria-hidden="true"><span /><span>이어서 추천된 동네</span><span>예상 월매출</span><span>성장세</span><span>점수</span></div>
                    <ol className="hero-rest">
                      {ranked.slice(1, 5).map((d, i) => (
                        <li key={d.dong_code}>
                          <span className="rank">{i + 2}</span>
                          <span className="name"><b>{d.name}</b><span>{d.gu}</span></span>
                          <span className="sales">{d.sales_monthly_p50 == null ? '—' : `${fmt(manwon(d.sales_monthly_p50))}만`}</span>
                          <span className="growth" style={{ color: rateColor(d.growth_rate) }}>{growthText(d.growth_rate) ?? '—'}</span>
                          <b className="score">{scoreText(d.score)}</b>
                        </li>
                      ))}
                    </ol>
                    <Link to="/recommend?step=3" className="res-all">전체 결과 보기<Icon name="chevronRight" size={16} /></Link>
                  </div>
                </div>

              </>
            ) : (
              <div className="hero-intro">
                <div className="hero-copy">
                  <span className="hero-eyebrow">서울 청년 창업 입지 추천</span>
                  <RotatingHeadline id="dash-hero-title" />
                  <p>내 자본금과 받을 수 있는 지원금으로 갈 수 있는 구와 동네를 찾아 드려요.</p>
                  <div className="hero-actions">
                    <Link to="/recommend?step=1" className="hero-cta">새 조건으로 계산하기<Icon name="arrowRight" size={18} /></Link>
                    <Link to="/search" className="hero-ghost">동네 직접 찾아보기</Link>
                  </div>
                </div>
                <ul className="hero-stats">
                  <HeroStat href="#dash-favs" label="관심 창업지" value={favs.length} unit="곳" />
                  {/* 공고를 못 받아도 칩은 남겨 둔다(관심 칩 하나만 넓게 늘어나지 않게) — 값만 '—' */}
                  <HeroStat href="#dash-notices" label="모집 중 공고" value={notices.error ? '—' : openCount} unit={notices.error ? '' : '건'} />
                  <HeroStat href="#dash-notices" label={`${URGENT_DAYS}일 내 마감`} value={notices.error ? '—' : urgentCount} unit={notices.error ? '' : '건'} />
                </ul>
              </div>
            )}
          </div>
        </section>

        <div className="page dash">
          <section className="dash-section" id="dash-favs">
            <div className="sec-head">
              <span className="sec-ico rose"><Icon name="heart" size={18} /></span>
              <h2>관심 등록한 창업지</h2>
              <span className="count-pill">{favs.length}</span>
              {favs.length > 0 && <Link to="/compare" className="sec-more">나란히 비교하기<Icon name="chevronRight" size={16} /></Link>}
            </div>
            {favs.length ? (
              <div className="fav-scroll">
                {favs.map((code, i) => (
                  <FavCard
                    key={code} code={code} fallbackName={fallbackNames[code]} industryCode={favIndustry(code)} industries={industries}
                    delay={Math.min(i, 5) * 60}
                    onUnfav={(name) => unfav(code, name)}
                  />
                ))}
                {/* 끝에 '더 담기' 칸 — 직접 찾아보기로 */}
                <Link to="/search" className="fav-add">
                  <span className="plus"><Icon name="plus" size={20} /></span>
                  <b>동네 더 담기</b>
                  <span>직접 찾아보기에서 ♡를 눌러요</span>
                </Link>
              </div>
            ) : (
              <div className="card fav-none">
                <span className="sec-ico rose"><Icon name="heart" size={20} /></span>
                <span className="text">추천 결과나 검색에서 ♡를 누르면 여기에 모여요.</span>
                <Link to="/search" className="btn-ghost">동네 찾아보기</Link>
              </div>
            )}
          </section>

          <section className="dash-section" id="dash-notices">
            <div className="sec-head">
              <span className="sec-ico"><Icon name="calendar" size={18} /></span>
              <h2>청년 창업 지원 일정</h2>
            </div>
            {notices.error ? (
              <div className="card">
                <BoxMsg title="공고를 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(notices.error)}`} onRetry={loadNotices} retrying={notices.loading} />
              </div>
            ) : !notices.items ? (
              <NoticeSkeleton />
            ) : !notices.items.length ? (
              <div className="card fav-empty">표시할 지원 일정이 없어요</div>
            ) : (
              <NoticeGroups items={notices.items} />
            )}
          </section>
        </div>
      </main>

      {undoToast && (
        <Toast
          key={`${undoToast.code}-${undoToast.at}`} leaving={undoLeaving}
          message={`${undoToast.name}을(를) 관심 목록에서 뺐어요`} actionLabel="되돌리기" onAction={restore}
        />
      )}
    </>
  );
}

/**
 * 관심 카드 1장(10.2 3): 카드마다 ⑫(dong_code + 그 동의 업종)를 매번 받는다. 수치는 저장하지 않는다(10.7).
 * 이름도 ⑫의 dong_name · district_name. 업종을 모르면 fallbackName(⑧ · ⑨), 둘 다 없으면 코드
 */
function FavCard({ code, fallbackName, industryCode, industries, onUnfav, delay = 0 }) {
  const p = useApiData(industryCode ? `/regions/predictions/${code}/${industryCode}` : null);
  const x = p.data;
  const dongName = x?.dong_name ?? fallbackName?.dong_name ?? (p.loading ? null : code); // 아직 모르면 막대
  const guName = x?.district_name ?? fallbackName?.district_name;
  const industryName = findIndustry(industries, industryCode)?.name;
  const noPred = x?.data_status === '예측 불가';
  const sv = survivalView(x); // 3년 영업 유지 확률 → 점포 수 증감 → 정보 없음 · 예측 불가(10.8)
  const sk = <Sk w={44} h={17} />;
  const shown = (v) => (p.loading ? sk : <span className="fade-in">{v}</span>); // 막대 → 값이 페이드로
  const stat = (v) => shown(!x ? '—' : noPred ? '예측 불가' : v ?? '정보 없음');
  const growthLow = x?.growth_confidence === '낮음';
  // 좁은 칸용 짧은 이름 · 보조 줄 — '3년 영업 유지 / 확률', '최근 1년 · 최근 분기 / 42곳'처럼 어색하게 끊기지 않게(원래 이름은 title로)
  const svLabel = sv.kind === 'trend' ? '점포 수 증감' : '3년 영업 유지';
  const svSub = sv.kind === 'trend' ? (x?.store_trend?.latest_count == null ? null : `점포 ${fmt(x.store_trend.latest_count)}곳`) : sv.sub;

  return (
    <article className="fav-card lift" style={{ animationDelay: `${delay}ms` }}>
      <div className="fav-head">
        {/* 카드 전체가 상세로 가는 링크 (::after로 영역 확장) */}
        <Link to={detailPath(code, { industryCode })} className="fav-link">
          <span className="fav-name"><b>{dongName == null ? <Sk w={72} h={20} /> : <span className="fade-in">{dongName}</span>}</b>{x?.data_status === '표본 부족' && <ResidentialBadge />}</span>
          <span className="fav-gu">{[guName, industryName].filter(Boolean).join(' · ')}</span>
        </Link>
        <div className="fav-score"><b>{p.loading ? <Sk w={40} h={24} /> : <span className="fade-in">{scoreText(x?.total_score)}</span>}</b><span>종합점수</span></div>
        <HeartButton on className="sm" onClick={() => onUnfav(dongName ?? code)} />
      </div>
      {!industryCode ? (
        <p className="fav-note">업종을 정하면 점수를 볼 수 있어요</p>
      ) : p.error ? (
        <p className="fav-note">불러오지 못했어요 <button type="button" onClick={p.retry}>다시 시도</button></p>
      ) : (
        <>
          {/* '신뢰도 낮음'은 좁은 칸마다 배지를 붙이지 않고, 항목 이름 옆 점 + 카드 아래 한 줄로 모은다 */}
          <dl className="fav-stats">
            <div>
              <dt title={sv.label}>{svLabel}{sv.low && <LowDot />}</dt>
              <dd style={survStyle(sv)} title={sv.note}>{shown(!x ? '—' : sv.main)}</dd>
              {!p.loading && x && svSub && <span className="surv-sub">{svSub}</span>}
            </div>
            <div><dt>월매출</dt><dd>{stat(x?.sales_monthly_p50 == null ? null : `${fmt(manwon(x.sales_monthly_p50))}만`)}</dd></div>
            <div>
              <dt>성장세{growthLow && <LowDot />}</dt>
              <dd style={{ color: rateColor(x?.growth_rate) }}>{shown(growthText(x?.growth_rate) ?? '정보 없음')}</dd>
            </div>
          </dl>
          {(sv.low || growthLow) && (
            <p className="low-note"><LowDot decorative />신뢰도 낮음 · 자료가 적거나 상권 기준이 바뀌었어요</p>
          )}
        </>
      )}
    </article>
  );
}
