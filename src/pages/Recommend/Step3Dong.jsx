import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { detailPath } from '../../lib/paths';
import { fmt, signed } from '../../lib/format';
import { DESKTOP, useMediaQuery } from '../../hooks/useMediaQuery';
import { BackIcon, GrowthLowBadge, HeartButton, RangeBar, ResidentialBadge, ViewToggle } from '../../components/ui';
import { SORTS, sortDongs } from './view';

const DongLeafletMap = lazy(() => import('../../components/DongLeafletMap'));

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
// 막대 축 최댓값은 받은 목록의 80% 범위 상단으로 잡는다(그리기용 배율)
const SurvMetric = ({ d, max, small }) => <Metric label="예상 생존 기간" range={d.sv} max={max} mid={d.sv?.[1]} unit="개월" ends={d.sv && [d.sv[0], `${d.sv[2]}개월`]} small={small} />;
const SalesMetric = ({ d, max, small }) => <Metric label="예상 월매출" range={d.sl} max={max} mid={d.sl && fmt(d.sl[1])} unit="만 원" ends={d.sl && [fmt(d.sl[0]), fmt(d.sl[2])]} small={small} />;

/** "왜 추천됐나요?" — 요인별 기여 점수 */
function Factors({ d, compact }) {
  return (
    <>
      <div className="factor-stack">{d.factors.map((f) => <i key={f.label} style={{ background: f.color, width: `${f.contrib}%` }} />)}</div>
      {compact && <span className="factor-sum">가중치 {d.weightsTxt} · 합계 {d.score}점</span>}
      {!d.hasGrowth && <span className="factor-warn">성장세 데이터가 없어 매출 50 · 생존 50으로 계산했어요</span>}
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

/** 3단계: 추천 행정동 (④ 응답 · 정렬 탭 4종 · 리스트 ↔ 지도 · 선택한 동 상세) */
export default function Step3Dong({ sub, industryCode, budgets, dongs, passCount, disclaimer, view, setView, onBack }) {
  const { favs, toggleFav } = useAppState();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useState('score');
  const [openDong, setOpenDong] = useState(null); // 모바일 카드의 '왜 추천됐나요?' 펼침
  const isDesk = useMediaQuery(DESKTOP);

  // 받은 목록 재정렬만 한다(7.8). 순번은 현재 탭 기준
  const sorted = useMemo(() => sortDongs(dongs, sort).map((d, i) => ({ ...d, rank: i + 1 })), [dongs, sort]);
  const survMax = useMemo(() => Math.max(1, ...dongs.map((d) => d.sv?.[2] ?? 0)) * 1.05, [dongs]);
  const salesMax = useMemo(() => Math.max(1, ...dongs.map((d) => d.sl?.[2] ?? 0)) * 1.05, [dongs]);

  // 선택은 dong_code로(이름이 같은 동이 여러 구에 있다 — 신사동)
  const selParam = params.get('sel');
  const sel = sorted.find((d) => d.code === selParam) ?? sorted[0];
  const select = (code) => setParams((p) => { p.set('sel', code); return p; }, { replace: true });

  const pins = useMemo(
    () => sorted.map((d) => ({ key: d.code, geo: d.geo, name: d.name, gu: d.gu, score: d.score, rank: d.rank, sel: d.code === sel?.code })),
    [sorted, sel?.code],
  );

  const href = (d) => detailPath(d.code, { industryCode, from: 'rec' });
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
          <button type="button" className="round-btn desk-only" aria-label="이전 단계" title="이전 단계 (예산 확인)" onClick={onBack}><BackIcon /></button>
          <div>
            <h1 className="page-title">추천 행정동 {sorted.length}곳</h1>
            <span>감당 가능한 {passCount}개 구 안에서 · {sub}</span>
          </div>
        </div>
        <ViewToggle view={view} onChange={setView} className="compact" />
      </div>
      <div className="chip-scroll">
        {SORTS.map(([k, label]) => (
          <button key={k} type="button" className={`chip sort ${sort === k ? 'on' : ''}`} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>
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
                  <b style={{ color: d.scoreColor }}>{d.score}</b>
                </button>
              ))}
            </div>
            <div className="card s3-mini" key={sel.code}>
              <div className="dong-head">
                <div className="id">
                  <span className="name"><b>{sel.name}</b>{sel.residential && <ResidentialBadge />}</span>
                  <span className="gu">{sel.gu} · {sub}</span>
                </div>
                <div className="score"><div><b style={{ color: sel.scoreColor }}>{sel.score}</b><span>종합점수</span></div><HeartButton on={isFav(sel)} onClick={onFav(sel)} /></div>
              </div>
              <div className="tiles">
                <div><span>예상 생존 기간</span><b>{sel.survRange}</b></div>
                <div><span>예상 월매출</span><b>{sel.salesRange}</b></div>
                <div><span>예산 여유 · 구 기준</span><Margin d={sel} /></div>
              </div>
              <span className="fine">범위는 80% 범위예요. {disclaimer}</span>
              <Link to={href(sel)} className="btn-primary">상세 분석 보기 ›</Link>
            </div>
          </div>
        </div>
      ) : isDesk ? (
        <div className="s3-desk">
          {/* 정렬이 바뀌면 key로 목록을 다시 마운트해 등장 애니메이션을 재생한다 */}
          <div className="s3-rows" key={sort}>
            {sorted.map((d, i) => (
              <div
                key={d.code} role="button" tabIndex={0} aria-pressed={d.code === sel.code}
                className={`s3-row lift ${d.code === sel.code ? 'on' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                onClick={() => select(d.code)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(d.code); } }}
              >
                <span className="rank">{d.rank}</span>
                <div className="info">
                  <div className="name"><b>{d.name}</b><span>{d.gu}</span>{d.residential && <ResidentialBadge />}</div>
                  <div className="ranges"><span>생존 <b>{d.survRange}</b></span><span>월매출 <b>{d.salesRange}</b></span></div>
                  <div className="ranges"><span>예산 여유 {d.margin == null ? <b>정보 없음</b> : <b className="margin">{signed(d.margin)}</b>}</span></div>
                </div>
                <div className="score"><b style={{ color: d.scoreColor }}>{d.score}</b><HeartButton on={isFav(d)} className="sm40" onClick={onFav(d)} /></div>
              </div>
            ))}
          </div>

          <div className="card s3-panel" key={sel.code}>
            <div className="dong-head lg">
              <div className="id">
                <span className="name"><b>{sel.name}</b>{sel.residential && <ResidentialBadge lg />}</span>
                <span className="gu">{sel.gu} · {sub}</span>
              </div>
              <div className="score"><div><b style={{ color: sel.scoreColor }}>{sel.score}</b><span>종합점수 / 100</span></div><HeartButton on={isFav(sel)} className="lg" onClick={onFav(sel)} /></div>
            </div>
            <div className="metrics">
              <div><SurvMetric d={sel} max={survMax} /><span className="fine">80% 범위 {sel.survRange}</span></div>
              <div><SalesMetric d={sel} max={salesMax} /><span className="fine">80% 범위 {sel.salesRange}</span></div>
            </div>
            <div className="tiles lg">
              <div>
                <span>성장세 · 최근 1년 vs 직전 1년 매출</span>
                <span className="val"><b>{sel.growthTxt}</b>{sel.growthLowWhy && <GrowthLowBadge />}</span>
              </div>
              <div><span>예산 여유 · {sel.gu} 초기 임대비용 기준</span><span className="val"><Margin d={sel} unit=" 원" /></span></div>
            </div>
            <div className="why">
              <div className="why-head"><b>왜 추천됐나요?</b><span>가중치 {sel.weightsTxt}</span></div>
              <Factors d={sel} />
            </div>
            {sel.sampleShort && <p className="fine">표본이 적어 신뢰할 수 없음 · 최근 4개 분기 평균 점포 수가 5개 미만이에요.</p>}
            <div className="panel-foot">
              <p className="disclaimer">{disclaimer}</p>
              <Link to={href(sel)} className="btn-primary">상세 분석 보기 ›</Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="s3-cards" key={sort}>
          {sorted.map((d, i) => {
            const open = openDong === d.code;
            return (
              <article key={d.code} className="s3-card" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="dong-head">
                  <div className="id">
                    <span className="name"><span className="rank">{d.rank}</span><b>{d.name}</b>{d.residential && <ResidentialBadge />}</span>
                    <span className="gu">{d.gu}</span>
                  </div>
                  <div className="score"><div><b style={{ color: d.scoreColor }}>{d.score}</b><span>종합점수</span></div><HeartButton on={isFav(d)} onClick={onFav(d)} /></div>
                </div>
                <SurvMetric d={d} max={survMax} small />
                <SalesMetric d={d} max={salesMax} small />
                <div className="margin-row"><span>예산 여유 <span>· {d.gu} 기준</span></span><Margin d={d} unit=" 원" /></div>
                <button type="button" className="why-toggle" aria-expanded={open} onClick={() => setOpenDong(open ? null : d.code)}>
                  왜 추천됐나요? <i aria-hidden="true">▾</i>
                </button>
                {open && (
                  <div className="why-body">
                    <Factors d={d} compact />
                    <Link to={href(d)} className="btn-ghost">{d.name} 상세 보기 ›</Link>
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
