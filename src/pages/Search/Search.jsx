import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { loadDongCenters } from '../../lib/geo';
import { findIndustry, groupIndustries, hasSales, loadMasters } from '../../lib/masters';
import { detailPath } from '../../lib/paths';
import { fmt, growthText, manwon, rateColor, requestIdText, scoreText } from '../../lib/format';
import { survivalView } from '../../lib/survival';
import { useApiData } from '../../hooks/useApiData';
import { DESKTOP, useMediaQuery } from '../../hooks/useMediaQuery';
import { useMore, usePeekOnce } from '../../hooks/useScrollHint';
import { MobileHeader } from '../../components/Layout';
import { BackIcon, BoxMsg, GrowthLowBadge, HeartButton, Icon, MapMsg, RangeBar, ResidentialBadge, Sk, SkKpi, SurvivalValue } from '../../components/ui';
import './Search.css';

const DongLeafletMap = lazy(() => import('../../components/DongLeafletMap'));
const AC_DELAY = 200; // 자동완성 요청 간격(ms)
const NEAR_COUNT = 2; // 가까운 동네 2곳(화면명세서 v0.3)
const NO_GEO = '지도에 표시되지 않음';
const NO_SALES_TEXT = '매출 데이터 없음 · 점포 수 증감만';

// 지도 색 단계(⑱ total_score). 그리기용 구간일 뿐 판정에 쓰지 않는다. TODO(가정): 구간 경계
const SCORE_STEPS = [[80, 'oklch(0.45 0.16 262)'], [65, 'oklch(0.56 0.14 262)'], [50, 'oklch(0.68 0.1 262)'], [35, 'oklch(0.8 0.06 262)'], [-1, 'oklch(0.9 0.03 262)']];
const scoreFill = (s) => SCORE_STEPS.find(([min]) => s >= min)[1];

/** ⑦ · ⑨ · ⑱ 항목을 같은 모양으로 */
const toPick = (x, guName) => ({
  dong_code: x.dong_code, dong_name: x.dong_name ?? x.name, district_name: x.district_name ?? guName, geo_code: x.geo_code ?? null,
});

const km = (a, b) => Math.hypot((a[0] - b[0]) * 88.2, (a[1] - b[1]) * 111);

export default function Search() {
  const { favs, toggleFav, cond } = useAppState();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [acOpen, setAcOpen] = useState(() => !!params.get('q'));
  const [acIdx, setAcIdx] = useState(0);
  const [sugs, setSugs] = useState(null); // { q, items } | { q, error }
  const [picked, setPicked] = useState(null); // toPick 모양
  const [industryCode, setIndustryCode] = useState(null);
  const [industries, setIndustries] = useState(null);
  const [mastersError, setMastersError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(() => !!params.get('q')); // 모바일 하단 시트
  const [more, setMore] = useState(false);
  const isDesk = useMediaQuery(DESKTOP);
  const topN = isDesk || more ? 10 : 5; // 데스크톱 사이드바는 자리가 넉넉해 처음부터 10위까지(지도 표시 10곳과 같게)
  const [browse, setBrowse] = useState(null); // ⑧ · ⑨ 대안 경로: null | { district: code | null }
  const [geoCenters, setGeoCenters] = useState(null);
  // 패널 본문은 스크롤바를 숨기고 추천받기처럼 '아래에 더 있어요'(가장자리 흐림 + ⌄) — 결과 카드는 맨 아래 고정 버튼이 있어 목록 · 구 고르기만
  const bodyRef = useRef(null);
  const bodyMore = useMore(bodyRef, !picked, browse ? `b-${browse.district}` : `list-${industryCode}-${topN}`);
  const peek = usePeekOnce(bodyMore, 'ts-seen-search-hint');

  // ⑩ 업종 — 기본은 최근 입력 조건의 업종, 없으면 첫 업종
  const loadIndustries = () => {
    setMastersError(false);
    loadMasters().then((m) => {
      setIndustries(m.industries);
      setIndustryCode((cur) => cur ?? (findIndustry(m.industries, cond.industry_code) ?? m.industries[0])?.industry_code ?? null);
    }, () => setMastersError(true));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadIndustries, []);
  useEffect(() => { loadDongCenters().then(setGeoCenters, () => {}); }, []); // 가까운 동네 거리 계산용(lib/geo에서 한 번만 계산)

  const cats = useMemo(() => (industries ? groupIndustries(industries) : null), [industries]);
  const industry = findIndustry(industries, industryCode);
  const noSales = !!industry && !hasSales(industry.industry_code);

  // ⑱ 업종별 랭킹(전체) — 지도 색칠 · 상위 목록
  const ranking = useApiData(industryCode ? `/regions/rankings?industry_code=${industryCode}` : null);
  const ranked = useMemo(() => ranking.data?.items ?? [], [ranking.data]);
  const rankBy = useMemo(() => new Map(ranked.map((r) => [r.dong_code, r])), [ranked]); // 구에서 고르기 줄의 순위 · 점수
  const scored = useMemo(() => ranked.filter((x) => x.total_score != null), [ranked]);
  // ⑧ 자치구(대안 경로 · 지도의 구 클릭)
  const districts = useApiData('/regions/districts');
  const dongs = useApiData(browse?.district ? `/regions/dongs?district_code=${browse.district}` : null);
  // ⑫ 선택한 동의 카드
  const pred = useApiData(picked && industryCode ? `/regions/predictions/${picked.dong_code}/${industryCode}` : null);

  // ⑦ 자동완성 — 공백을 뺀 1자 이상, 늦게 온 응답은 버린다
  const q = query.trim();
  useEffect(() => {
    if (!q.replace(/\s/g, '') || picked) { setSugs(null); return undefined; }
    let alive = true;
    const t = setTimeout(() => {
      api(`/regions/search?q=${encodeURIComponent(q)}`)
        .then((json) => { if (alive) { setSugs({ q, items: json.data.items }); setAcIdx(0); } })
        .catch((e) => { if (alive) setSugs({ q, error: toApiError(e) }); });
    }, AC_DELAY);
    return () => { alive = false; clearTimeout(t); };
  }, [q, picked]);
  const showAc = acOpen && !!sugs && !picked;

  const pickDong = (x) => {
    setPicked(x); setQuery(x.dong_name); setAcOpen(false); setSheetOpen(true); setBrowse(null);
  };
  const pickByCode = (code) => { const x = ranked.find((r) => r.dong_code === code); if (x) pickDong(toPick(x)); };
  const backToList = () => { setQuery(''); setPicked(null); };
  const guName = (code) => districts.data?.items.find((d) => d.district_code === code)?.name;
  const pickGuGeo = (geo) => {
    const d = districts.data?.items.find((x) => x.geo_code === geo);
    if (d) { setPicked(null); setQuery(''); setBrowse({ district: d.district_code }); setSheetOpen(true); }
  };

  const fills = useMemo(() => Object.fromEntries(ranked.filter((x) => x.geo_code).map((x) => [x.geo_code, {
    key: x.dong_code,
    color: x.total_score == null ? 'oklch(0.86 0.004 262)' : scoreFill(x.total_score),
    tip: `${x.dong_name} · ${x.district_name} · ${scoreText(x.total_score)}점`,
  }])), [ranked]);
  const pins = useMemo(() => {
    const list = scored.slice(0, 10).map((x) => ({
      key: x.dong_code, geo: x.geo_code, name: x.dong_name, gu: x.district_name, score: scoreText(x.total_score), rank: x.rank, sel: x.dong_code === picked?.dong_code,
    }));
    if (picked && !list.some((p) => p.sel)) {
      const r = ranked.find((x) => x.dong_code === picked.dong_code);
      list.push({ key: picked.dong_code, geo: picked.geo_code, name: picked.dong_name, gu: picked.district_name, score: scoreText(r?.total_score), sel: true });
    }
    return list;
  }, [scored, ranked, picked]);
  const selGu = picked?.geo_code?.slice(0, 5) ?? districts.data?.items.find((d) => d.district_code === browse?.district)?.geo_code;

  // 점포 데이터가 없을 때: 중심점이 가장 가까운 동 중 ⑱에 점수가 있는 곳 2곳(구 제한 없음, 10.4)
  const near = useMemo(() => {
    const origin = picked?.geo_code && geoCenters?.[picked.geo_code];
    if (!origin) return [];
    return scored
      .filter((x) => x.dong_code !== picked.dong_code && x.geo_code && geoCenters[x.geo_code])
      .map((x) => ({ x, d: km(origin, geoCenters[x.geo_code]) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, NEAR_COUNT);
  }, [picked, scored, geoCenters]);

  const onKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter · 방향키는 입력기 몫
    // 지금 검색어의 제안만 고른다 — 입력을 바꾼 직후(디바운스 · 응답 전)에는 이전 검색어의 목록이 남아 있다
    const items = sugs?.q === q ? (sugs.items ?? []) : [];
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setAcIdx((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setAcIdx((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === 'Enter' && items[acIdx]) pickDong(toPick(items[acIdx]));
  };

  return (
    <>
      <MobileHeader title="직접찾기" />
      <main className="search">
        <Suspense fallback={<MapMsg />}>
          <DongLeafletMap selGu={selGu} pins={pins} fills={fills} sheet={sheetOpen ? 'open' : 'closed'} onPickDong={pickByCode} onPickGu={pickGuGeo} />
        </Suspense>

        <div className={`search-panel ${sheetOpen ? 'open' : ''}`}>
          <button type="button" className="sheet-handle mob-only" aria-label="패널 접기/펼치기" aria-expanded={sheetOpen} onClick={() => setSheetOpen(!sheetOpen)}><i /></button>

          <div className="search-top">
            <div className={`search-box ${picked ? 'picked' : ''}`}>
              <Icon name="search" size={18} />
              <input
                value={query} placeholder="행정동 검색 · 예) 신림동, 성수" aria-label="행정동 검색" enterKeyHint="search"
                role="combobox" aria-expanded={showAc} aria-autocomplete="list"
                onChange={(e) => { setQuery(e.target.value); setPicked(null); setAcOpen(true); }}
                onFocus={() => { setAcOpen(true); setSheetOpen(true); }}
                onKeyDown={onKeyDown}
              />
              {query && <button type="button" aria-label="검색어 지우기" onClick={backToList}>×</button>}
            </div>
            {showAc && (
              <div className="search-ac" role="listbox">
                {sugs.error && <div className="none">검색하지 못했어요. 잠시 후 다시 입력해 주세요.</div>}
                {sugs.items?.map((x, i) => {
                  const at = x.dong_name.indexOf(sugs.q);
                  return (
                    <button
                      key={x.dong_code} type="button" role="option" aria-selected={i === acIdx} className={i === acIdx ? 'active' : ''}
                      style={{ animationDelay: `${i * 25}ms` }} onClick={() => pickDong(toPick(x))}
                    >
                      <span>
                        {at < 0 ? x.dong_name : <>{x.dong_name.slice(0, at)}<b>{x.dong_name.slice(at, at + sugs.q.length)}</b>{x.dong_name.slice(at + sugs.q.length)}</>}
                      </span>
                      <span className="gu">{x.district_name}{!x.geo_code && ` · ${NO_GEO}`}</span>
                    </button>
                  );
                })}
                {sugs.items && !sugs.items.length && <div className="none">‘{sugs.q}’와 일치하는 서울 행정동이 없어요</div>}
              </div>
            )}
            {!cats ? (
              mastersError
                ? <BoxMsg title="업종 목록을 불러오지 못했어요" onRetry={loadIndustries} />
                : <div aria-busy="true"><span className="sr-only" role="status">업종 목록을 불러오는 중…</span><Sk h={44} r={12} /></div>
            ) : <IndustryPicker cats={cats} industry={industry} onPick={setIndustryCode} />}
          </div>

          <div className="search-body" ref={bodyRef}>
            {picked && (
              <Picked
                key={`${picked.dong_code}-${industryCode}`} x={picked} pred={pred} industry={industry} near={near}
                rank={ranked.find((r) => r.dong_code === picked.dong_code)?.rank}
                fav={favs.includes(picked.dong_code)} onFav={() => toggleFav(picked.dong_code, industryCode)}
                onBack={backToList} onPick={(r) => pickDong(toPick(r))}
              />
            )}
            {!picked && browse && (
              <Browse
                districts={districts} dongs={dongs} district={browse.district} guName={guName(browse.district)} industry={industry} rankBy={rankBy}
                onDistrict={(code) => setBrowse({ district: code })} onClose={() => setBrowse(null)}
                onPick={(x) => pickDong(toPick(x, guName(browse.district)))}
              />
            )}
            {!picked && !browse && (
              <div className={`search-list ${peek ? 'peek' : ''}`}>
                <div className="head">
                  <b>{industry?.name ?? '업종'} 상위 {topN}곳</b>
                  <button type="button" className="link" onClick={() => setBrowse({ district: null })}>구에서 고르기 ›</button>
                </div>
                {noSales && <span className="search-hint">{NO_SALES_TEXT} — 서울시 추정매출에 이 업종이 없어요</span>}
                {ranking.error && <BoxMsg title="순위를 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(ranking.error)}`} onRetry={ranking.retry} />}
                {(ranking.loading || (!industryCode && !mastersError)) && <><span className="sr-only" role="status">순위를 불러오는 중…</span>{Array.from({ length: topN }, (_, i) => <SkRow key={i} rank />)}</>}
                {/* 업종이 바뀌면 key가 바뀌어 등장 애니메이션이 다시 재생된다 */}
                {scored.slice(0, topN).map((x, i) => (
                  <button key={`${industryCode}-${x.dong_code}`} type="button" className="row" style={{ animationDelay: `${i * 35}ms` }} onClick={() => pickDong(toPick(x))}>
                    <span className={`rank ${x.rank <= 3 ? 'top' : ''}`}>{x.rank}</span>
                    <span className="name">
                      <b>{x.dong_name}</b>
                      <span>
                        {x.district_name} · 성장세 <em style={{ color: rateColor(x.growth_rate) }}>{growthText(x.growth_rate) ?? '정보 없음'}</em>
                        {!x.geo_code && ` · ${NO_GEO}`}
                      </span>
                    </span>
                    <b className="score">{scoreText(x.total_score)}</b>
                  </button>
                ))}
                {scored.length > 5 && !isDesk && <button type="button" className="more" onClick={() => setMore(!more)}>{more ? '접기' : '10위까지 보기'}</button>}
                {ranking.data && !scored.length && !noSales && <span className="search-hint">이 업종은 점수가 있는 동네가 없어요</span>}
              </div>
            )}
          </div>
          <div className={`more-hint ${bodyMore ? 'on' : ''} ${peek ? 'hint' : ''}`} aria-hidden="true"><Icon name="chevronDown" size={18} /></div>
        </div>
      </main>
    </>
  );
}

/** ⑧ 자치구 → ⑨ 행정동으로 고르기(자동완성의 대안 경로) */
function Browse({ districts, dongs, district, guName, industry, rankBy, onDistrict, onClose, onPick }) {
  return (
    <div className="search-list search-browse">
      {/* 돌아가기는 다른 화면의 [이전]처럼 왼쪽 — 동 목록이면 구 고르기로, 구 고르기면 상위 목록으로 */}
      <div className="head">
        <button type="button" className="back" aria-label={district ? '구 다시 고르기' : '상위 목록으로'} onClick={district ? () => onDistrict(null) : onClose}>‹</button>
        <b>{district ? `${guName ?? ''} 행정동` : '자치구를 골라 주세요'}</b>
      </div>
      {!district && (
        districts.error ? <BoxMsg title="자치구 목록을 불러오지 못했어요" onRetry={districts.retry} />
          : (
            <div className="browse-gus">
              {districts.loading && Array.from({ length: 24 }, (_, i) => <Sk key={i} h={40} r={10} />)}
              {districts.data && [...districts.data.items].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map((d) => (
                <button key={d.district_code} type="button" className="gu-btn" onClick={() => onDistrict(d.district_code)}>{d.name}</button>
              ))}
            </div>
          )
      )}
      {district && dongs.error && <BoxMsg title="행정동 목록을 불러오지 못했어요" onRetry={dongs.retry} />}
      {district && dongs.loading && <><span className="sr-only" role="status">행정동 목록을 불러오는 중…</span>{Array.from({ length: 6 }, (_, i) => <SkRow key={i} />)}</>}
      {/* 구 이름은 제목에 있어 줄마다 반복하지 않고, 대신 지금 업종의 순위 · 점수(⑱에서 이미 받은 값) */}
      {district && dongs.data?.items.map((x) => {
        const r = rankBy.get(x.dong_code);
        const sub = [r?.rank && `${industry?.name ?? ''} ${r.rank}위`, !x.geo_code && NO_GEO].filter(Boolean).join(' · ');
        return (
        <button key={x.dong_code} type="button" className="row" onClick={() => onPick(x)}>
          <span className="name"><b>{x.name}</b>{sub && <span>{sub}</span>}</span>
          <b className="score">{scoreText(r?.total_score)}</b>
        </button>
        );
      })}
    </div>
  );
}

/**
 * 업종 고르기(10.4): 지금 업종을 한 줄 버튼으로 두고, 누르면 목록 위에 뜨는 드롭다운에서 이름 검색 · 대분류 탭 · 세부 칩(여러 줄)으로 고른다.
 * 직접찾기는 매출 데이터가 없는 업종도 남겨 대분류마다 40개 넘게 있어 가로 한 줄 칩 대신 이렇게. 바깥을 누르거나 Esc면 닫힌다
 */
function IndustryPicker({ cats, industry, onPick }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(industry?.category ?? Object.keys(cats)[0]);
  const [q, setQ] = useState('');
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const iq = q.trim();
  const hits = iq ? Object.values(cats).flat().filter((s) => s.name.includes(iq)) : null;
  const toggle = () => { if (!open) { setTab(industry?.category ?? tab); setQ(''); } setOpen(!open); };
  const pick = (code) => { onPick(code); setOpen(false); };
  return (
    <div className="ind-pick" ref={box} onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
      <button type="button" className={`ind-btn ${open ? 'open' : ''}`} aria-expanded={open} onClick={toggle}>
        <span className="k">업종</span>
        <span className="v">{industry && <span className="cat">{industry.category} ›</span>}<b>{industry?.name ?? '업종 고르기'}</b></span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="ind-pop">
          <input value={q} placeholder="업종 이름으로 찾기 (예: 편의점)" aria-label="업종 검색" enterKeyHint="search" onChange={(e) => setQ(e.target.value)} />
          {!hits && (
            <div className="ind-tabs">
              {Object.keys(cats).map((k) => (
                <button key={k} type="button" className={`chip sm ${tab === k ? 'on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>{k}<span>{cats[k].length}</span></button>
              ))}
            </div>
          )}
          <div className="ind-chips" key={hits ? `q-${iq}` : tab}>
            {(hits ?? cats[tab]).map((s) => (
              <button key={s.code} type="button" className={`chip sub sm ${industry?.industry_code === s.code ? 'on' : ''}`} aria-pressed={industry?.industry_code === s.code} onClick={() => pick(s.code)}>{s.name}</button>
            ))}
            {hits && !hits.length && <span className="none">‘{iq}’와 일치하는 업종이 없어요</span>}
          </div>
        </div>
      )}
    </div>
  );
}

/** 목록 한 줄(.row) 자리의 스켈레톤 — 순위(rank) · 이름 두 줄 · 점수(rank일 때) */
function SkRow({ rank = false }) {
  return (
    <div className="row" aria-hidden="true">
      {rank && <Sk w={24} h={24} r={8} />}
      <span className="name"><Sk w="45%" h={16} /><Sk w="70%" h={12} /></span>
      {rank && <Sk w={36} h={22} />}
    </div>
  );
}

/** 선택한 동 카드(10.4 5): ⑫ 예측 · 업종 분포 수준. 점포 데이터가 없으면 가까운 동네 안내 */
function Picked({ x, pred, industry, rank, near, fav, onFav, onBack, onPick }) {
  const back = <button type="button" className="round-btn bordered" aria-label="목록으로" onClick={onBack}>‹</button>;
  if (pred.error) {
    return (
      <div className="search-none">
        {back}
        <BoxMsg title="예측을 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(pred.error)}`} onRetry={pred.retry} />
      </div>
    );
  }
  const p = pred.data;
  if (!p && !pred.loading) return null;
  if (p && p.store_count_latest == null) {
    return (
      <div className="search-none">
        {back}
        <b>{x.dong_name} 데이터가 없어요</b>
        <span>{x.district_name} · {industry?.name} 점포 데이터가 없어요.{!x.geo_code && ` (${NO_GEO})`}</span>
        {near.length ? (
          <div className="near">
            <span>가까운 동네</span>
            {near.map(({ x: n, d }) => (
              <button key={n.dong_code} type="button" onClick={() => onPick(n)}>
                <span><b>{n.dong_name}</b> {n.district_name}</span><span>{d.toFixed(1)}km ›</span>
              </button>
            ))}
          </div>
        ) : <span>업종을 바꾸거나 다른 동을 검색해 보세요.</span>}
      </div>
    );
  }
  // 예측을 받는 동안에도 카드 뼈대(이름 · 구 · 순위, 안내, 아래 버튼 줄)는 같은 요소로 두고 점수 · 지표 4칸만 막대 → 값.
  // 카드를 통째로 다시 그리면 값이 올 때 전체가 깜빡여서
  const loading = !p;
  const noPred = p?.data_status === '예측 불가';
  const sv = survivalView(p); // 3년 영업 유지 확률 → 점포 수 증감 → 정보 없음 · 예측 불가(10.8)
  const noSales = !!industry && !hasSales(industry.industry_code);
  const sl = !p || noSales || noPred || p.sales_monthly_p50 == null || p.sales_monthly_p10 == null || p.sales_monthly_p90 == null
    ? null : [manwon(p.sales_monthly_p10), manwon(p.sales_monthly_p50), manwon(p.sales_monthly_p90)];
  return (
    <div className="search-result" aria-busy={loading}>
      {loading && <span className="sr-only" role="status">예측을 불러오는 중…</span>}
      <div className="head">
        <div className="id">
          <span className="name"><b>{x.dong_name}</b>{p?.data_status === '표본 부족' && <ResidentialBadge />}</span>
          <span className="gu">{x.district_name} · {industry?.name}{rank && ` · ${rank}위`}{!x.geo_code && ` · ${NO_GEO}`}</span>
        </div>
        <div className="score"><div>{loading ? <Sk w={56} h={30} /> : <b className="fade-in">{scoreText(p.total_score)}</b>}<span>종합점수</span></div><HeartButton on={fav} onClick={onFav} /></div>
      </div>
      {/* 지표 칸 2×2 — 3단계 상세 패널 · 상세 화면과 같은 타일(.kpi). key로 막대 ↔ 값을 갈아 끼우며 값은 은은하게 */}
      {loading ? <div key="sk" className="kpis-2">{[0, 1, 2, 3].map((i) => <SkKpi key={i} />)}</div> : (
        <div key="v" className="kpis-2 fade-in">
          <div className="kpi" title={sv.note}>
            <span className="k">{sv.label}</span>
            <span className="v"><SurvivalValue v={sv} /></span>
            {sv.sub && <span className="s">{sv.sub}</span>}
          </div>
          <div className="kpi">
            <span className="k">예상 월매출 <span>· 80% 범위</span></span>
            <span className="v">{sl ? <><b>{fmt(sl[1])}</b><small>만 원</small></> : <span className="badge badge-gray">{noSales ? '매출 데이터 없음' : '예측 불가'}</span>}</span>
            {sl && <RangeBar range={sl} max={sl[2] * 1.15} ends={[fmt(sl[0]), fmt(sl[2])]} legend />}
          </div>
          <div className="kpi">
            <span className="k">성장세</span>
            <span className="v">
              {p.growth_rate != null
                ? <b style={{ color: rateColor(p.growth_rate) }}>{growthText(p.growth_rate)}</b>
                : <span className="badge badge-gray">정보 없음</span>}
              {p.growth_confidence === '낮음' && <GrowthLowBadge />}
            </span>
            <span className="s">최근 1년 vs 직전 1년 매출</span>
          </div>
          <div className="kpi">
            <span className="k">{industry?.name} 점포 수</span>
            <span className="v"><b className={`lv-tag-${['적음', '보통', '많음'].indexOf(p.store_level)}`}>{p.store_level ?? '정보 없음'}</b></span>
            <span className="s">최근 분기 {fmt(p.store_count_latest)}곳 · 서울 전체 행정동 기준 3등분</span>
          </div>
        </div>
      )}
      <p className="note">예측은 참고용이에요. 최종 판단과 책임은 사용자에게 있어요.</p>
      {/* 사이드바(모바일은 시트) 맨 아래에 고정 — 다른 화면 하단 바처럼 [이전](목록으로) + [상세 분석 보기] */}
      <div className="search-cta">
        <button type="button" className="btn-ghost rec-bar-back" aria-label="목록으로" onClick={onBack}><BackIcon />이전</button>
        <Link to={detailPath(x.dong_code, { industryCode: industry?.industry_code, from: 'search' })} className="btn-primary rec-cta">
          <span className="t">상세 분석 보기</span><Icon name="arrowRight" size={18} />
        </Link>
      </div>
    </div>
  );
}
