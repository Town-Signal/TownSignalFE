import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { loadDongGeo } from '../../lib/geo';
import { findIndustry, groupIndustries, loadMasters } from '../../lib/masters';
import { detailPath } from '../../lib/paths';
import { fmt, growthText, manwon, requestIdText } from '../../lib/format';
import { useApiData } from '../../hooks/useApiData';
import { MobileHeader } from '../../components/Layout';
import { BoxMsg, GrowthLowBadge, HeartButton, ResidentialBadge } from '../../components/ui';
import './Search.css';

const DongLeafletMap = lazy(() => import('../../components/DongLeafletMap'));
// 데스크톱에서 지도 왼쪽을 가리는 패널 폭(340) + 여백
const PANEL_PAD = 372;
const AC_DELAY = 200; // 자동완성 요청 간격(ms)
const NEAR_COUNT = 2; // 가까운 동네 2곳(화면명세서 v0.3)
const NO_GEO = '지도에 표시되지 않음';

// 지도 색 단계(⑱ total_score). 그리기용 구간일 뿐 판정에 쓰지 않는다. TODO(가정): 구간 경계
const SCORE_STEPS = [[80, 'oklch(0.45 0.16 262)'], [65, 'oklch(0.56 0.14 262)'], [50, 'oklch(0.68 0.1 262)'], [35, 'oklch(0.8 0.06 262)'], [-1, 'oklch(0.9 0.03 262)']];
const scoreFill = (s) => SCORE_STEPS.find(([min]) => s >= min)[1];
const rateColor = (rate) => (rate == null ? 'var(--muted)' : rate >= 0 ? 'var(--green)' : 'var(--down)');
const rangeText = (lo, hi, unit) => (lo == null || hi == null ? null : `${lo}~${hi}${unit}`);

/** ⑦ · ⑨ · ⑱ 항목을 같은 모양으로 */
const toPick = (x, guName) => ({
  dong_code: x.dong_code, dong_name: x.dong_name ?? x.name, district_name: x.district_name ?? guName, geo_code: x.geo_code ?? null,
});

/** 동 경계 중심점(경계 상자 가운데). 가까운 동네 거리 계산에만 쓴다 */
function centers(geo) {
  const out = {};
  geo?.features.forEach((f) => {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    const walk = (c) => (typeof c[0] === 'number'
      ? ([x0, y0, x1, y1] = [Math.min(x0, c[0]), Math.min(y0, c[1]), Math.max(x1, c[0]), Math.max(y1, c[1])])
      : c.forEach(walk));
    walk(f.geometry.coordinates);
    out[String(f.properties.code)] = [(x0 + x1) / 2, (y0 + y1) / 2];
  });
  return out;
}
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
  const [browse, setBrowse] = useState(null); // ⑧ · ⑨ 대안 경로: null | { district: code | null }
  const [geoCenters, setGeoCenters] = useState(null);

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
  useEffect(() => { loadDongGeo().then((g) => setGeoCenters(centers(g)), () => {}); }, []);

  const cats = useMemo(() => (industries ? groupIndustries(industries) : null), [industries]);
  const industry = findIndustry(industries, industryCode);
  const big = industry?.category;

  // ⑱ 업종별 랭킹(전체) — 지도 색칠 · 상위 목록
  const ranking = useApiData(industryCode ? `/regions/rankings?industry_code=${industryCode}` : null);
  const ranked = useMemo(() => ranking.data?.items ?? [], [ranking.data]);
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
    tip: `${x.dong_name} · ${x.district_name} · ${x.total_score ?? '—'}점`,
  }])), [ranked]);
  const pins = useMemo(() => {
    const list = scored.slice(0, 10).map((x) => ({
      key: x.dong_code, geo: x.geo_code, name: x.dong_name, gu: x.district_name, score: String(x.total_score), rank: x.rank, sel: x.dong_code === picked?.dong_code,
    }));
    if (picked && !list.some((p) => p.sel)) {
      const r = ranked.find((x) => x.dong_code === picked.dong_code);
      list.push({ key: picked.dong_code, geo: picked.geo_code, name: picked.dong_name, gu: picked.district_name, score: r?.total_score == null ? '—' : String(r.total_score), sel: true });
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
    const items = sugs?.items ?? [];
    if (e.key === 'ArrowDown' && items.length) { e.preventDefault(); setAcIdx((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp' && items.length) { e.preventDefault(); setAcIdx((i) => (i - 1 + items.length) % items.length); }
    else if (e.key === 'Enter' && items[acIdx]) pickDong(toPick(items[acIdx]));
  };

  return (
    <>
      <MobileHeader title="직접찾기" />
      <main className="search">
        <Suspense fallback={<div className="map-msg">지도를 불러오는 중…</div>}>
          <DongLeafletMap selGu={selGu} pins={pins} fills={fills} padLeft={PANEL_PAD} onPickDong={pickByCode} onPickGu={pickGuGeo} />
        </Suspense>

        <div className={`search-panel ${sheetOpen ? 'open' : ''}`}>
          <button type="button" className="sheet-handle mob-only" aria-label="패널 접기/펼치기" aria-expanded={sheetOpen} onClick={() => setSheetOpen(!sheetOpen)}><i /></button>

          <div className="search-top">
            <div className={`search-box ${picked ? 'picked' : ''}`}>
              <i aria-hidden="true" />
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
                : <span className="search-hint">업종 목록을 불러오는 중…</span>
            ) : (
              <>
                <div className="chip-scroll">
                  {Object.keys(cats).map((k) => (
                    <button key={k} type="button" className={`chip sm ${big === k ? 'on' : ''}`} aria-pressed={big === k} onClick={() => setIndustryCode(cats[k][0].code)}>{k}</button>
                  ))}
                </div>
                {big && (
                  <div className="chip-scroll" key={big}>
                    {cats[big].map((s) => (
                      <button key={s.code} type="button" className={`chip sub sm ${industryCode === s.code ? 'on' : ''}`} aria-pressed={industryCode === s.code} onClick={() => setIndustryCode(s.code)}>{s.name}</button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="search-body">
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
                districts={districts} dongs={dongs} district={browse.district} guName={guName(browse.district)}
                onDistrict={(code) => setBrowse({ district: code })} onClose={() => setBrowse(null)}
                onPick={(x) => pickDong(toPick(x, guName(browse.district)))}
              />
            )}
            {!picked && !browse && (
              <div className="search-list">
                <div className="head">
                  <b>{industry?.name ?? '업종'} 상위 {more ? 10 : 5}곳</b>
                  <button type="button" className="link" onClick={() => setBrowse({ district: null })}>구에서 고르기 ›</button>
                </div>
                {ranking.error && <BoxMsg title="순위를 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(ranking.error)}`} onRetry={ranking.retry} />}
                {ranking.loading && <span className="search-hint">순위를 불러오는 중…</span>}
                {/* 업종이 바뀌면 key가 바뀌어 등장 애니메이션이 다시 재생된다 */}
                {scored.slice(0, more ? 10 : 5).map((x, i) => (
                  <button key={`${industryCode}-${x.dong_code}`} type="button" className="row" style={{ animationDelay: `${i * 35}ms` }} onClick={() => pickDong(toPick(x))}>
                    <span className={`rank ${x.rank <= 3 ? 'top' : ''}`}>{x.rank}</span>
                    <span className="name">
                      <b>{x.dong_name}</b>
                      <span>
                        {x.district_name} · 성장세 <em style={{ color: rateColor(x.growth_rate) }}>{growthText(x.growth_rate) ?? '정보 없음'}</em>
                        {!x.geo_code && ` · ${NO_GEO}`}
                      </span>
                    </span>
                    <b className="score">{x.total_score}</b>
                  </button>
                ))}
                {scored.length > 5 && <button type="button" className="more" onClick={() => setMore(!more)}>{more ? '접기' : '10위까지 보기'}</button>}
                {ranking.data && !scored.length && <span className="search-hint">이 업종은 점수가 있는 동네가 없어요</span>}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

/** ⑧ 자치구 → ⑨ 행정동으로 고르기(자동완성의 대안 경로) */
function Browse({ districts, dongs, district, guName, onDistrict, onClose, onPick }) {
  return (
    <div className="search-list search-browse">
      <div className="head">
        <b>{district ? `${guName ?? ''} 행정동` : '자치구를 골라 주세요'}</b>
        <button type="button" className="link" onClick={district ? () => onDistrict(null) : onClose}>{district ? '‹ 구 다시 고르기' : '닫기'}</button>
      </div>
      {!district && (
        districts.error ? <BoxMsg title="자치구 목록을 불러오지 못했어요" onRetry={districts.retry} />
          : (
            <div className="browse-gus">
              {districts.data?.items.map((d) => (
                <button key={d.district_code} type="button" className="chip sm" onClick={() => onDistrict(d.district_code)}>{d.name}</button>
              ))}
            </div>
          )
      )}
      {district && dongs.error && <BoxMsg title="행정동 목록을 불러오지 못했어요" onRetry={dongs.retry} />}
      {district && dongs.loading && <span className="search-hint">불러오는 중…</span>}
      {district && dongs.data?.items.map((x) => (
        <button key={x.dong_code} type="button" className="row" onClick={() => onPick(x)}>
          <span className="name"><b>{x.name}</b><span>{guName}{!x.geo_code && ` · ${NO_GEO}`}</span></span>
        </button>
      ))}
    </div>
  );
}

/** 선택한 동 카드(10.4 5): ⑫ 예측 · 업종 분포 수준. 점포 데이터가 없으면 가까운 동네 안내 */
function Picked({ x, pred, industry, rank, near, fav, onFav, onBack, onPick }) {
  const back = <button type="button" className="round-btn bordered" aria-label="목록으로" onClick={onBack}>‹</button>;
  if (pred.loading) return <div className="search-none">{back}<span>불러오는 중…</span></div>;
  if (pred.error) {
    return (
      <div className="search-none">
        {back}
        <BoxMsg title="예측을 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(pred.error)}`} onRetry={pred.retry} />
      </div>
    );
  }
  const p = pred.data;
  if (!p) return null;
  if (p.store_count_latest == null) {
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
  const noPred = p.data_status === '예측 불가';
  const surv = rangeText(p.survival_p10, p.survival_p90, '개월');
  const sales = rangeText(fmt(manwon(p.sales_monthly_p10)), fmt(manwon(p.sales_monthly_p90)), '만');
  return (
    <div className="search-result">
      <div className="head">
        <div className="id">
          {back}
          <div>
            <span className="name"><b>{x.dong_name}</b>{p.data_status === '표본 부족' && <ResidentialBadge />}</span>
            <span className="gu">{x.district_name} · {industry?.name}{rank && ` · ${rank}위`}{!x.geo_code && ` · ${NO_GEO}`}</span>
          </div>
        </div>
        <div className="score"><div><b>{p.total_score ?? '—'}</b><span>종합점수</span></div><HeartButton on={fav} onClick={onFav} /></div>
      </div>
      <div className="stats">
        <div className="surv"><span>예상 생존</span><b>{noPred || p.survival_p50 == null ? '예측 불가' : `${p.survival_p50}개월`}</b>{!noPred && surv && <span>80% 범위 {surv}</span>}</div>
        <div className="sales"><span>예상 월매출</span><b>{noPred || p.sales_monthly_p50 == null ? '예측 불가' : `${fmt(manwon(p.sales_monthly_p50))}만`}</b>{!noPred && p.sales_monthly_p10 != null && <span>80% 범위 {sales}</span>}</div>
        <div className="growth">
          <span>성장세</span>
          <span>{p.growth_confidence === '낮음' && <GrowthLowBadge />}<b style={{ color: rateColor(p.growth_rate) }}>{growthText(p.growth_rate) ?? '정보 없음'}</b></span>
        </div>
      </div>
      <div className="dist">
        <div className="dist-head"><span>{industry?.name} 점포 수</span><span className="lv-legend">서울 전체 행정동 기준 3등분</span></div>
        <div className="store-level">
          <b className={`lv-tag-${['적음', '보통', '많음'].indexOf(p.store_level)}`}>{p.store_level ?? '정보 없음'}</b>
          <span>최근 분기 {fmt(p.store_count_latest)}곳</span>
        </div>
      </div>
      <p className="note">예측은 참고용이에요. 최종 판단과 책임은 사용자에게 있어요.</p>
      <Link to={detailPath(x.dong_code, { industryCode: industry?.industry_code, from: 'search' })} className="btn-primary">상세 분석 보기 ›</Link>
    </div>
  );
}
