import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { ALL_DONG_NAMES, CATS, DONG_GU, NO_DATA } from '../../lib/data';
import { ALL_DONGS, detailExtra, dongPath, fmt, growthColor, nearDongs, subScore } from '../../lib/calc';
import { MobileHeader } from '../../components/Layout';
import { GrowthLowBadge, HeartButton, LevelLegend, LevelRow, ResidentialBadge } from '../../components/ui';
import './Search.css';

const DongLeafletMap = lazy(() => import('../../components/DongLeafletMap'));
const NO_GUS = new Set();
// 데스크톱에서 지도 왼쪽을 가리는 패널 폭(340) + 여백
const PANEL_PAD = 372;

export default function Search() {
  const { favs, toggleFav } = useAppState();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const [acOpen, setAcOpen] = useState(false);
  const [big, setBig] = useState('외식업');
  const [sub, setSub] = useState(CATS['외식업'][0]);
  const [sheetOpen, setSheetOpen] = useState(false); // 모바일 하단 시트
  const [more, setMore] = useState(false);
  const [focusGu, setFocusGu] = useState(null);

  // 업종별 점수 순위 (지도 핀과 목록이 같은 순위를 쓴다)
  const ranked = useMemo(() => (
    ALL_DONGS.map((d) => ({ d, score: subScore(d, sub) }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      .map((x, i) => ({ ...x, rank: x.score == null ? null : i + 1 }))
  ), [sub]);

  const noData = !!picked && NO_DATA.includes(picked);
  const current = picked && !noData ? ranked.find((x) => x.d.name === picked) : null;
  const selGu = picked ? DONG_GU[picked] : focusGu;

  const pins = useMemo(() => {
    const list = ranked.map((x) => ({ name: x.d.name, gu: x.d.gu, score: x.score == null ? '—' : String(x.score), rank: x.rank, sel: x.d.name === picked }));
    if (noData) list.push({ name: picked, gu: DONG_GU[picked], score: '—', sel: true });
    return list;
  }, [ranked, picked, noData]);

  const pickDong = (name) => { setQuery(name); setPicked(name); setAcOpen(false); setSheetOpen(true); };
  const backToList = () => { setQuery(''); setPicked(null); };

  const q = query.trim();
  const suggestions = q && !picked ? ALL_DONG_NAMES.filter((n) => n.includes(q)).slice(0, 8) : [];
  const showAc = acOpen && !!q && !picked;

  return (
    <>
      <MobileHeader title="직접찾기" />
      <main className="search">
        <Suspense fallback={<div className="map-msg">지도를 불러오는 중…</div>}>
          <DongLeafletMap passGus={NO_GUS} selGu={selGu} pins={pins} padLeft={PANEL_PAD} onPickDong={pickDong} onPickGu={setFocusGu} />
        </Suspense>

        <div className={`search-panel ${sheetOpen ? 'open' : ''}`}>
          <button type="button" className="sheet-handle mob-only" aria-label="패널 접기/펼치기" aria-expanded={sheetOpen} onClick={() => setSheetOpen(!sheetOpen)}><i /></button>

          <div className="search-top">
            <div className={`search-box ${picked ? 'picked' : ''}`}>
              <i aria-hidden="true" />
              <input
                value={query} placeholder="행정동 검색 · 예) 신림동, 성수" aria-label="행정동 검색" enterKeyHint="search"
                onChange={(e) => { setQuery(e.target.value); setPicked(null); setAcOpen(true); }}
                onFocus={() => { setAcOpen(true); setSheetOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && suggestions[0]) pickDong(suggestions[0]); }}
              />
              {query && <button type="button" aria-label="검색어 지우기" onClick={backToList}>×</button>}
            </div>
            {showAc && (
              <div className="search-ac">
                {suggestions.map((n, i) => {
                  const end = n.indexOf(q) + q.length;
                  return (
                    <button key={n} type="button" style={{ animationDelay: `${i * 25}ms` }} onClick={() => pickDong(n)}>
                      <span><b>{n.slice(0, end)}</b>{n.slice(end)}</span>
                      <span className="gu">{DONG_GU[n]}</span>
                    </button>
                  );
                })}
                {!suggestions.length && <div className="none">‘{q}’와 일치하는 서울 행정동이 없어요</div>}
              </div>
            )}
            <div className="chip-scroll">
              {Object.keys(CATS).map((k) => (
                <button key={k} type="button" className={`chip sm ${big === k ? 'on' : ''}`} aria-pressed={big === k} onClick={() => { setBig(k); setSub(CATS[k][0]); }}>{k}</button>
              ))}
            </div>
            <div className="chip-scroll" key={big}>
              {CATS[big].map((s) => (
                <button key={s} type="button" className={`chip sub sm ${sub === s ? 'on' : ''}`} aria-pressed={sub === s} onClick={() => setSub(s)}>{s}</button>
              ))}
            </div>
          </div>

          <div className="search-body">
            {current && <Result key={`${picked}-${sub}`} item={current} sub={sub} fav={favs.includes(picked)} onFav={() => toggleFav(picked, sub)} onBack={backToList} />}
            {noData && <NoData name={picked} onBack={backToList} onPick={pickDong} />}
            {!picked && (
              <div className="search-list">
                <div className="head"><b>{sub} 상위 {more ? 10 : 5}곳</b><span>지도 핀과 같은 순위예요</span></div>
                {/* 업종이 바뀌면 key가 바뀌어 등장 애니메이션이 다시 재생된다 */}
                {ranked.filter((x) => x.score != null).slice(0, more ? 10 : 5).map((x, i) => (
                  <button key={`${sub}-${x.d.name}`} type="button" className="row" style={{ animationDelay: `${i * 35}ms` }} onClick={() => pickDong(x.d.name)}>
                    <span className={`rank ${x.rank <= 3 ? 'top' : ''}`}>{x.rank}</span>
                    <span className="name"><b>{x.d.name}</b><span>{x.d.gu} · 월 {fmt(x.d.sl[1])}만 · {x.d.sv[1]}개월</span></span>
                    <b className="score">{x.score}</b>
                  </button>
                ))}
                <button type="button" className="more" onClick={() => setMore(!more)}>{more ? '접기' : '10위까지 보기'}</button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function Result({ item: { d, score }, sub, fav, onFav, onBack }) {
  const { distShort } = detailExtra(d.name, sub);
  return (
    <div className="search-result">
      <div className="head">
        <div className="id">
          <button type="button" className="round-btn bordered" aria-label="목록으로" onClick={onBack}>‹</button>
          <div>
            <span className="name"><b>{d.name}</b>{d.residential && <ResidentialBadge />}</span>
            <span className="gu">{d.gu} · {sub}</span>
          </div>
        </div>
        <div className="score"><div><b>{score ?? d.scoreTxt}</b><span>종합점수</span></div><HeartButton on={fav} onClick={onFav} /></div>
      </div>
      <div className="stats">
        <div className="surv"><span>예상 생존</span><b>{d.survRange}</b></div>
        <div className="sales"><span>예상 월매출</span><b>{d.salesRange}</b></div>
        <div className="growth">
          <span>성장세</span>
          <span>{d.growthLowWhy && <GrowthLowBadge />}<b style={{ color: growthColor(d) }}>{d.growthTxt}</b></span>
        </div>
      </div>
      <div className="dist">
        <div className="dist-head">
          <span>이 동네 상위 업종</span>
          <LevelLegend title="업종별 점포 수를 서울 전체 행정동에서 3등분한 기준이에요 (하위 1/3 · 중간 · 상위 1/3)" />
        </div>
        {distShort.map((r) => <LevelRow key={r.label} label={r.label} w={r.w} hit={r.sel} />)}
      </div>
      <p className="note">범위는 80% 확률 범위예요.<br />예측은 참고용이에요. 최종 판단과 책임은 사용자에게 있어요.</p>
      <Link to={dongPath(d.name, { from: 'search', sub })} className="btn-primary">상세 분석 보기 ›</Link>
    </div>
  );
}

function NoData({ name, onBack, onPick }) {
  const near = nearDongs(name);
  return (
    <div className="search-none">
      <button type="button" className="round-btn bordered" aria-label="목록으로" onClick={onBack}>‹</button>
      <b>{name} 데이터가 없어요</b>
      <span>이 동네에는 점포 데이터가 없어요.</span>
      {near.length ? (
        <div className="near">
          <span>가까운 동네</span>
          {near.map((n) => (
            <button key={n.name} type="button" onClick={() => onPick(n.name)}>
              <span><b>{n.name}</b> {n.gu}</span><span>{n.kmTxt} ›</span>
            </button>
          ))}
        </div>
      ) : <span>업종을 바꾸거나 다른 동을 검색해 보세요.</span>}
    </div>
  );
}
