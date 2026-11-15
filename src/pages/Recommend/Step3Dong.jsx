import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { fmt, rateColor, signed } from '../../lib/format';
import { DESKTOP, useMediaQuery } from '../../hooks/useMediaQuery';
import { GrowthLowBadge, HeartButton, Icon, RangeBar, ResidentialBadge, SurvivalValue, ViewToggle } from '../../components/ui';
import { SORTS } from './view';

const DongLeafletMap = lazy(() => import('../../components/DongLeafletMap'));

// 동 목록의 '아래에 더 있어요' 첫 안내(살짝 올라갔다 내려오기 · ⌄ 튀기)는 처음 3단계에 왔을 때 한 번만 — 본 기록을 브라우저에 남긴다.
// 저장소를 못 쓰면(사생활 보호 모드 등) 이번 화면에서만 한 번
const HINT_KEY = 'ts-seen-s3-hint';
const hintSeen = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
const markHintSeen = () => { try { localStorage.setItem(HINT_KEY, '1'); } catch { /* 저장 못 해도 안내는 이번 한 번으로 끝 */ } };

const Margin = ({ d, unit = '' }) => (d.margin == null
  ? <span className="badge badge-gray">정보 없음</span>
  : <b className="margin">{signed(d.margin)}{unit}</b>);

function Metric({ label, range, max, mid, unit, ends, small }) {
  return (
    <div>
      <div className={`metric-head ${small ? 'sm' : ''}`}><span>{label}</span>{range ? <span><b>{mid}</b>{unit}</span> : <span>예측 불가</span>}</div>
      {range && <RangeBar range={range} max={max} ends={ends} />}
    </div>
  );
}
/** 영업 유지 칸 — 3년 영업 유지 확률(보조 1년) 또는 점포 수 증감. 확률에는 80% 범위 막대를 그리지 않는다(명세 10.8) */
const SurvMetric = ({ d, small }) => (
  <div>
    <div className={`metric-head ${small ? 'sm' : ''}`}><span>{d.surv.label}</span><span><SurvivalValue v={d.surv} /></span></div>
    {d.surv.sub && <div className="fine">{d.surv.sub}</div>}
  </div>
);
// 막대 축 최댓값은 받은 목록의 80% 범위 상단으로 잡는다(그리기용 배율)
const SalesMetric = ({ d, max, small }) => <Metric label="예상 월매출" range={d.sl} max={max} mid={d.sl && fmt(d.sl[1])} unit="만 원" ends={d.sl && [fmt(d.sl[0]), fmt(d.sl[2])]} small={small} />;

/** "왜 추천됐나요?" — 요인별 기여 점수 */
function Factors({ d, compact }) {
  return (
    <>
      <div className="factor-stack">{d.factors.map((f) => <i key={f.label} style={{ background: f.color, width: `${f.contrib}%` }} />)}</div>
      {compact && <span className="factor-sum">가중치 {d.weightsTxt} · 합계 {d.scoreTxt}점</span>}
      {d.missingTxt && <span className="factor-warn">{d.missingTxt} 데이터가 없어 나머지 지표로 계산했어요(가중치 {d.weightsTxt})</span>}
      {d.factors.map((f) => (
        <div key={f.label} className={`factor ${compact ? 'compact' : ''}`}>
          <span className="label"><i style={{ background: f.color }} />{f.label}</span>
          <span className="bar"><i style={{ background: f.color, width: `${f.fill}%` }} /></span>
          <b>{f.contrib.toFixed(1)}<span> / {f.weight}{compact ? '점' : ''}</span></b>
          <span className="raw">{f.raw} · {f.top}</span>
        </div>
      ))}
    </>
  );
}

/**
 * 3단계: 추천 행정동 (④ 응답 · 정렬 탭 4종 · 리스트 ↔ 지도 · 선택한 동 상세).
 * 정렬 · 순번(sorted)과 고른 동(sel)은 Recommend가 정한다 — 하단 바의 [상세 분석 보기]도 같은 동을 가리키게(모바일 카드도 눌러서 고른다)
 */
export default function Step3Dong({ sub, industryCode, budgets, sorted, sel, sort, onSort, passCount, disclaimer, view, setView, onBack }) {
  const { favs, toggleFav } = useAppState();
  const [, setParams] = useSearchParams();
  const [openDong, setOpenDong] = useState(null); // 모바일 카드의 '왜 추천됐나요?' 펼침
  const isDesk = useMediaQuery(DESKTOP);
  const salesMax = useMemo(() => Math.max(1, ...sorted.map((d) => d.sl?.[2] ?? 0)) * 1.05, [sorted]);

  // 선택은 dong_code로(이름이 같은 동이 여러 구에 있다 — 신사동)
  const select = (code) => setParams((p) => { p.set('sel', code); return p; }, { replace: true });

  // 데스크톱 동 목록 패널은 자체 스크롤(스크롤바 숨김).
  // - 고른 행이 안 보이면 보이게 내린다(상세에서 돌아왔을 때 · 정렬을 바꿨을 때). 목록 상자만 움직이고 페이지는 건드리지 않는다
  // - 아래에 더 있으면(more) 아래 가장자리를 흐리게 + ⌄ 표시. 처음 3단계에 왔을 때 한 번만 목록이 살짝 올라갔다 내려오고
  //   ⌄가 튀어(peek) 더 있음을 알린다
  const rowsRef = useRef(null);
  const [more, setMore] = useState(false);
  const [peek, setPeek] = useState(false);
  const peeked = useRef(hintSeen());
  const measureMore = () => {
    const box = rowsRef.current;
    setMore(!!box && box.scrollTop + box.clientHeight < box.scrollHeight - 4);
  };
  useEffect(() => {
    const box = rowsRef.current;
    if (!box) return undefined;
    const row = box.querySelector('.s3-row.on');
    if (row && box.scrollHeight > box.clientHeight) {
      const b = box.getBoundingClientRect();
      const r = row.getBoundingClientRect();
      if (r.top < b.top || r.bottom > b.bottom) box.scrollTop += r.top - b.top - 8;
    }
    measureMore();
    if (!peeked.current && box.scrollTop + box.clientHeight < box.scrollHeight - 4) {
      peeked.current = true;
      markHintSeen();
      setPeek(true);
    }
    window.addEventListener('resize', measureMore);
    return () => window.removeEventListener('resize', measureMore);
  }, [sort, view, isDesk]);
  // 안내 애니메이션(.7s 뒤 1.2s)이 끝나면 떼어 둔다 — 정렬을 바꿔 목록을 다시 그려도 재생하지 않게
  useEffect(() => {
    if (!peek) return undefined;
    const t = setTimeout(() => setPeek(false), 2200);
    return () => clearTimeout(t);
  }, [peek]);

  const pins = useMemo(
    () => sorted.map((d) => ({ key: d.code, geo: d.geo, name: d.name, gu: d.gu, score: d.scoreTxt, rank: d.rank, sel: d.code === sel?.code })),
    [sorted, sel?.code],
  );

  const isFav = (d) => favs.includes(d.code);
  const onFav = (d) => (e) => { e.stopPropagation(); toggleFav(d.code, industryCode); };

  if (!sel) {
    return (
      <div className="card empty">
        <div className="icon">?</div>
        <div className="title">추천할 수 있는 동네가 없어요</div>
        <div className="desc">자본금이나 희망 면적을 조정해 보세요.</div>
        <div className="actions"><button type="button" className="btn-primary" onClick={onBack}>이전 단계로</button></div>
      </div>
    );
  }

  return (
    <div className="s3">
      <div className="s3-head">
        <div className="s3-title">
          <div>
            <h1 className="page-title">추천 행정동 {sorted.length}곳</h1>
            <span>감당 가능한 {passCount}개 구 안에서 · {sub}</span>
          </div>
        </div>
        <ViewToggle view={view} onChange={setView} className="compact" />
      </div>
      <div className="chip-scroll">
        {SORTS.map(([k, label]) => (
          <button key={k} type="button" className={`chip sort ${sort === k ? 'on' : ''}`} aria-pressed={sort === k} onClick={() => onSort(k)}>{label}</button>
        ))}
      </div>

      {view === 'map' ? (
        <div className="s3-map-grid">
          <div className="card s3-map">
            <Suspense fallback={<div className="map-msg">지도를 불러오는 중…</div>}>
              <DongLeafletMap passGus={budgets.passGeos} selGu={sel.geo?.slice(0, 5)} pins={pins} onPickDong={select} />
            </Suspense>
          </div>
          <div className="s3-map-side">
            <div className="card s3-mini-list">
              {sorted.map((d) => (
                <button key={d.code} type="button" className={d.code === sel.code ? 'on' : ''} aria-pressed={d.code === sel.code} onClick={() => select(d.code)}>
                  <span className="rank">{d.rank}</span>
                  <span className="name"><b>{d.name}</b><span>{d.gu}{!d.geo && ' · 지도에 표시되지 않음'}</span></span>
                  <b style={{ color: d.scoreColor }}>{d.scoreTxt}</b>
                </button>
              ))}
            </div>
            <div className="card s3-mini" key={sel.code}>
              <div className="dong-head">
                <div className="id">
                  <span className="name"><b>{sel.name}</b>{sel.residential && <ResidentialBadge />}</span>
                  <span className="gu">{sel.gu} · {sub}</span>
                </div>
                <div className="score"><div><b style={{ color: sel.scoreColor }}>{sel.scoreTxt}</b><span>종합점수</span></div><HeartButton on={isFav(sel)} onClick={onFav(sel)} /></div>
              </div>
              <div className="tiles">
                <div><span>{sel.surv.label}</span><SurvivalValue v={sel.surv} /></div>
                <div><span>예상 월매출</span><b>{sel.salesRange}</b></div>
                <div><span>예산 여유 · 구 기준</span><Margin d={sel} /></div>
              </div>
              <span className="fine">월매출 범위는 80% 범위예요. {disclaimer}</span>
            </div>
          </div>
        </div>
      ) : isDesk ? (
        <div className="s3-desk">
          {/* 동 목록 패널(자체 스크롤). 정렬이 바뀌면 key로 목록을 다시 마운트해 등장 애니메이션을 재생한다 */}
          <div className="s3-rows-box">
            <div className="s3-rows" key={sort} ref={rowsRef} onScroll={measureMore}>
              <div className={`s3-rows-in ${peek ? 'peek' : ''}`}>
                {sorted.map((d, i) => (
                  <div
                    key={d.code} role="button" tabIndex={0} aria-pressed={d.code === sel.code}
                    className={`s3-row ${d.code === sel.code ? 'on' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                    onClick={() => select(d.code)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(d.code); } }}
                  >
                    <span className={`rank ${d.rank <= 3 ? 'top' : ''}`}>{d.rank}</span>
                    <div className="info">
                      <div className="name"><b>{d.name}</b><span>{d.gu}</span>{d.residential && <ResidentialBadge />}</div>
                      <div className="ranges"><span>{d.surv.shortLabel} <b>{d.surv.short}</b></span><span>월매출 <b>{d.salesRange}</b></span></div>
                      <div className="ranges"><span>예산 여유 {d.margin == null ? <b>정보 없음</b> : <b className="margin">{signed(d.margin)}</b>}</span></div>
                    </div>
                    <div className="score"><b style={{ color: d.scoreColor }}>{d.scoreTxt}</b><HeartButton on={isFav(d)} className="sm40" onClick={onFav(d)} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`more-hint ${more ? 'on' : ''} ${peek ? 'hint' : ''}`} aria-hidden="true"><Icon name="chevronDown" size={18} /></div>
          </div>

          {/* 세로 흐름: 머리 → 핵심 지표 4칸 → 왜 추천됐나요? → 안내(바닥). 화면이 낮으면 지표 2×2 | 왜 추천 두 칸으로(CSS) */}
          <div className="card s3-panel" key={sel.code}>
            <div className="s3-panel-in">
              <div className="dong-head lg">
                <div className="id">
                  <span className="name"><b>{sel.name}</b>{sel.residential && <ResidentialBadge lg />}</span>
                  <span className="gu">{sel.gu} · {sub}</span>
                </div>
                <div className="score"><div><b style={{ color: sel.scoreColor }}>{sel.scoreTxt}</b><span>종합점수 / 100</span></div><HeartButton on={isFav(sel)} className="lg" onClick={onFav(sel)} /></div>
              </div>
              <div className="s3-panel-main">
                {/* 핵심 지표 4칸 — 같은 크기 · 같은 위계(넓으면 한 줄, 좁거나 두 칸 배치면 2×2) */}
                <div className="kpis">
                  <div className="kpi">
                    <span className="k">{sel.surv.label}</span>
                    <span className="v"><SurvivalValue v={sel.surv} /></span>
                    {sel.surv.sub && <span className="s">{sel.surv.sub}</span>}
                  </div>
                  <div className="kpi sales">
                    <span className="k">예상 월매출 <span>· 80% 범위</span></span>
                    {sel.sl
                      ? <span className="v"><b>{fmt(sel.sl[1])}</b><small>만 원</small></span>
                      : <span className="v"><span className="badge badge-gray">예측 불가</span></span>}
                    {sel.sl && <RangeBar range={sel.sl} max={salesMax} ends={[fmt(sel.sl[0]), fmt(sel.sl[2])]} legend />}
                  </div>
                  <div className="kpi">
                    <span className="k">성장세</span>
                    <span className="v"><b style={{ color: rateColor(sel.growth) }}>{sel.growthTxt}</b>{sel.growthLowWhy && <GrowthLowBadge />}</span>
                    <span className="s">최근 1년 vs 직전 1년 매출</span>
                  </div>
                  <div className="kpi">
                    <span className="k">예산 여유</span>
                    <span className="v"><Margin d={sel} unit=" 원" /></span>
                    <span className="s">{sel.gu} 초기 임대비용 기준</span>
                  </div>
                </div>
                {sel.surv.note && <p className="fine kpi-note">{sel.surv.label} · {sel.surv.note}</p>}
              </div>
              <div className="why">
                <div className="why-head"><b>왜 추천됐나요?</b><span>가중치 {sel.weightsTxt}</span></div>
                <Factors d={sel} />
              </div>
              {sel.sampleShort && <p className="fine">표본이 적어 신뢰할 수 없음 · 최근 4개 분기 평균 점포 수가 5개 미만이에요.</p>}
              {/* [상세 분석 보기]는 하단 바에 */}
              <div className="panel-foot">
                <p className="disclaimer">{disclaimer}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="s3-cards" key={sort}>
          {sorted.map((d, i) => {
            const open = openDong === d.code;
            return (
              <article
                key={d.code} role="button" tabIndex={0} aria-pressed={d.code === sel.code}
                className={`s3-card ${d.code === sel.code ? 'on' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                onClick={() => select(d.code)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(d.code); } }}
              >
                <div className="dong-head">
                  <div className="id">
                    <span className="name"><span className="rank">{d.rank}</span><b>{d.name}</b>{d.residential && <ResidentialBadge />}</span>
                    <span className="gu">{d.gu}</span>
                  </div>
                  <div className="score"><div><b style={{ color: d.scoreColor }}>{d.scoreTxt}</b><span>종합점수</span></div><HeartButton on={isFav(d)} onClick={onFav(d)} /></div>
                </div>
                <SurvMetric d={d} small />
                <SalesMetric d={d} max={salesMax} small />
                <div className="margin-row"><span>예산 여유 <span>· {d.gu} 기준</span></span><Margin d={d} unit=" 원" /></div>
                <button type="button" className="why-toggle" aria-expanded={open} onClick={() => setOpenDong(open ? null : d.code)}>
                  왜 추천됐나요? <i aria-hidden="true">▾</i>
                </button>
                {open && (
                  <div className="why-body">
                    <Factors d={d} compact />
                  </div>
                )}
              </article>
            );
          })}
          <p className="disclaimer">{disclaimer}</p>
        </div>
      )}
    </div>
  );
}
