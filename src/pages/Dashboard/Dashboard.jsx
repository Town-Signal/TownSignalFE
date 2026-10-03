import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { dongInfo, dongPath, fmt, growthColor, notices } from '../../lib/calc';
import { Brand, MobileHeader } from '../../components/Layout';
import { GrowthLowBadge, HeartButton, ResidentialBadge, Toast } from '../../components/ui';
import './Dashboard.css';

const NOTICES = notices();
const UNDO_MS = 4000;

export default function Dashboard() {
  const { favs, last, toggleFav } = useAppState();
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const favDongs = useMemo(() => favs.map(dongInfo).filter(Boolean), [favs]);
  const ranked = useMemo(() => (last ? last.ranked.map((r) => dongInfo(r.name)).filter(Boolean) : []), [last]);
  const first = ranked[0];

  const unfav = (name) => {
    toggleFav(name);
    setUndo(name);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  };
  const restore = () => {
    toggleFav(undo);
    clearTimeout(undoTimer.current);
    setUndo(null);
  };

  return (
    <>
      <MobileHeader><Brand size={24} /></MobileHeader>
      <main className="page dash">
        <h1 className="dash-greet">가게 열 동네, 감 말고 데이터로 정해요</h1>

        <div className="dash-top">
          {first ? (
            <section className="card dash-last">
              <div className="row-between">
                <h2 className="card-title">최근 추천 결과</h2>
                <span className="dash-date">{last.date}</span>
              </div>
              <div className="dash-pass">
                <span>감당 가능한 구</span><b>{last.passCount}</b><span className="muted">/ 25</span>
              </div>
              <div className="dash-rank">
                <div className="dash-first">
                  <div className="dash-first-head">
                    <div className="dash-first-name">
                      <span className="dash-first-tag">1위 추천</span>
                      <b>{first.name}</b>
                      <span>{first.gu}</span>
                    </div>
                    <div className="dash-first-score"><b>{first.score}</b><span>종합점수</span></div>
                  </div>
                  <dl className="dash-first-stats">
                    <div><dt>예상 생존</dt><dd>{first.sv[1]}개월</dd></div>
                    <div><dt>예상 월매출</dt><dd>월 {fmt(first.sl[1])}만</dd></div>
                    <div><dt>성장세</dt><dd style={{ color: growthColor(first) }}>{first.hasGrowth ? first.growthTxt : '—'}</dd></div>
                  </dl>
                </div>
                <ol className="dash-rest">
                  {ranked.slice(1, 5).map((d, i) => (
                    <li key={d.name}>
                      <span className="rank">{i + 2}</span>
                      <span className="name"><b>{d.name}</b><span>{d.gu}</span></span>
                      <span className="growth" style={{ color: growthColor(d) }}>{d.hasGrowth ? d.growthTxt : '—'}</span>
                      <b className="score">{d.score}</b>
                    </li>
                  ))}
                </ol>
              </div>
              <Link to="/recommend?step=3" className="dash-all">전체 결과 보기 ›</Link>
            </section>
          ) : (
            <section className="card empty">
              <div className="icon">?</div>
              <div className="title">아직 추천받은 결과가 없어요</div>
              <div className="desc">나이·자본금·업종을 입력하면<br />갈 만한 동네를 역산해 드려요.</div>
            </section>
          )}

          <nav className="dash-shortcuts" aria-label="바로가기">
            <Link to="/recommend" className="shortcut primary">
              <span className="spark big" aria-hidden="true">✦</span>
              <span className="spark small" aria-hidden="true">✦</span>
              <span className="text"><b>새 조건으로 계산하기</b><span>지원금과 자본금으로 갈 수 있는 구를 찾아요</span></span>
              <span className="arrow">›</span>
            </Link>
            {first ? (
              <Link to={dongPath(first.name, { from: 'rec', sub: last.sub })} className="shortcut lift">
                <span className="ico green">↗</span>
                <span className="text"><b>상세 분석 바로가기</b><span>최근 1위 {first.name} 분석 보기</span></span>
                <span className="arrow">›</span>
              </Link>
            ) : (
              <div className="shortcut disabled" aria-disabled="true">
                <span className="text"><b>상세 분석 바로가기</b><span>추천을 받으면 1위 동네를 바로 볼 수 있어요</span></span>
              </div>
            )}
            {favDongs.length ? (
              <Link to="/compare" className="shortcut lift">
                <span className="ico blue">⇄</span>
                <span className="text"><b>관심 상권 비교하기</b><span>관심 {favDongs.length}곳 나란히 보기</span></span>
                <span className="arrow">›</span>
              </Link>
            ) : (
              <div className="shortcut disabled" aria-disabled="true">
                <span className="text"><b>관심 상권 비교하기</b><span>관심 동네를 1곳 이상 담아 주세요</span></span>
              </div>
            )}
          </nav>
        </div>

        <section className="dash-section" style={{ animationDelay: '.1s' }}>
          <h2>관심 등록한 창업지 <span className="count">{favDongs.length}</span></h2>
          {favDongs.length ? (
            <div className="fav-scroll">
              {favDongs.map((d) => (
                <article key={d.name} className="fav-card lift">
                  <div className="fav-head">
                    {/* 카드 전체가 상세로 가는 링크 (::after로 영역 확장) */}
                    <Link to={dongPath(d.name)} className="fav-link">
                      <span className="fav-name"><b>{d.name}</b>{d.residential && <ResidentialBadge />}</span>
                      <span className="fav-gu">{d.gu}</span>
                    </Link>
                    <div className="fav-score"><b>{d.scoreTxt}</b><span>종합점수</span></div>
                    <HeartButton on className="sm" onClick={() => unfav(d.name)} />
                  </div>
                  <dl className="fav-stats">
                    <div><dt>생존</dt><dd>{d.noPred ? '—' : `${d.sv[1]}개월`}</dd></div>
                    <div><dt>월매출</dt><dd>{d.noPred ? '—' : `${fmt(d.sl[1])}만`}</dd></div>
                    <div><dt>성장세</dt><dd>{d.growthTxt}</dd>{d.growthLowWhy && <GrowthLowBadge />}</div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <div className="card fav-empty">
              추천 결과나 검색에서 ♡를 누르면 여기에 모여요.
              <Link to="/search">동네 찾아보기 ›</Link>
            </div>
          )}
        </section>

        <section className="dash-section" style={{ animationDelay: '.2s' }}>
          <div className="row-between">
            <h2>청년 창업 지원 공고</h2>
            <span className="hint">마감 임박 순</span>
          </div>
          <ul className="card notice-list">
            {NOTICES.map((n) => (
              <li key={n.title}>
                <a href={n.href} target="_blank" rel="noopener noreferrer">
                  {n.dday != null
                    ? <span className={`dday ${n.urgent ? 'urgent' : ''}`}>D-{n.dday}</span>
                    : <span className="dday always">상시모집</span>}
                  <span className="body"><b>{n.title}</b><span>{n.org} · {n.amt}</span></span>
                  <span className="deadline">{n.deadlineTxt}</span>
                  <span className="ext" aria-hidden="true">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>

      {undo && <Toast message={`${undo}을(를) 관심 목록에서 뺐어요`} actionLabel="되돌리기" onAction={restore} />}
    </>
  );
}
