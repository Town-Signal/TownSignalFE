import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { useApiData } from '../../hooks/useApiData';
import { useApiError } from '../../hooks/useApiError';
import { findIndustry } from '../../lib/masters';
import { useIndustries } from '../../hooks/useIndustries';
import { isDongCode } from '../../lib/paths';
import { areaText, fmt, growthText, manwon, quarterText, rateColor, rentQuarterText, requestIdText, scoreText, signed } from '../../lib/format';
import { hasSurvival, survivalView } from '../../lib/survival';
import { MobileHeader } from '../../components/Layout';
import { BackIcon, BoxMsg, GrowthLowBadge, HeartButton, Icon, RangeBar, ResidentialBadge, Sk, SkKpi, SurvivalValue } from '../../components/ui';
import LegacyDongRedirect from './LegacyDongRedirect';
import SalesTrend from './SalesTrend';
import FootTraffic from './FootTraffic';
import './Detail.css';

// ④ disclaimer와 같은 문구. 상세 화면용 API 필드가 없어 상수로 둔다(QUESTIONS)
const DISCLAIMER = '본 서비스의 추정 임대비용은 자치구 평균 기준이므로 동일 자치구 내 행정동은 금액이 동일하게 표시되며, 권리금·인테리어·집기 비용은 포함되지 않습니다. 예측 결과는 참고 정보이며 최종 판단과 책임은 사용자에게 있습니다.';
const range = (lo, mid, hi) => (lo == null || mid == null || hi == null ? null : [lo, mid, hi]);

export default function Detail() {
  const { id } = useParams();
  if (!isDongCode(id)) return <LegacyDongRedirect name={id} />;
  return <DongDetail key={id} code={id} />;
}

/** 상권 상세(10.5): ⑪ 현황 · ⑫ 예측 · ⑬ 요약을 병렬로 부르고, 추천 이력이 있으면 ⑥ 예산 여유 */
function DongDetail({ code }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { favs, toggleFav, last, cond } = useAppState();
  const handleError = useApiError();

  const from = params.get('from');
  const fromRec = from === 'rec';
  // 업종: 쿼리 → 최근 입력 조건 → 최근 추천. TODO(가정): 셋 다 없으면 업종 없이 현황만 보여 준다
  const industryCode = params.get('industry_code') || cond.industry_code || last?.industry_code || null;
  const areaN = Number(cond.area);
  const areaQ = areaN > 0 ? `area_sqm=${areaN}` : '';
  const recId = last?.rec_id ?? null;

  const a = useApiData(`/regions/analytics/${code}?${[industryCode && `industry_code=${industryCode}`, areaQ].filter(Boolean).join('&')}`);
  const p = useApiData(industryCode ? `/regions/predictions/${code}/${industryCode}` : null);
  const s = useApiData(industryCode ? `/regions/summary/${code}?industry_code=${industryCode}` : null);
  const m = useApiData(recId ? `/recommendations/${recId}/margin?dong_code=${code}` : null);

  // ⑥ REC_NOT_FOUND → ts-last의 rec_id만 지운다(useApiError). 그러면 recId가 null이 되어 '추천을 거치면 표시돼요'로 바뀐다
  useEffect(() => { if (m.error?.code === 'REC_NOT_FOUND') handleError(m.error); }, [m.error, handleError]);

  const industries = useIndustries();

  const back = () => {
    if (fromRec) navigate(`/recommend?step=3&sel=${code}`);
    else if (location.key !== 'default') navigate(-1); // 앱 안에서 들어온 경우
    else navigate(from === 'search' ? '/search' : '/');
  };
  const header = (title, fav) => (
    <MobileHeader
      title={title}
      left={<button type="button" className="mob-header-btn" aria-label="뒤로가기" onClick={back}>‹</button>}
      right={fav}
    />
  );

  if (a.error?.code === 'DONG_NOT_FOUND') {
    return (
      <>
        {header('행정동 상세')}
        <main className="page">
          <div className="card empty">
            <div className="icon">?</div>
            <div className="title">찾을 수 없는 동네예요</div>
            <div className="desc">주소가 바뀌었거나 서울 행정동이 아니에요. 다른 동네를 찾아보세요.</div>
            <div className="actions"><Link to="/search" className="btn-primary">직접 찾아보기</Link></div>
          </div>
        </main>
      </>
    );
  }
  if (!a.data) {
    return (
      <>
        {header('행정동 상세')}
        {a.error
          ? <main className="page"><div className="card"><BoxMsg title="상권 정보를 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(a.error)}`} onRetry={a.retry} /></div></main>
          : <DetailSkeleton />}
      </>
    );
  }

  const d = a.data;
  const pred = p.data;
  const industryName = findIndustry(industries, industryCode)?.name
    ?? d.industry_distribution?.find((x) => x.is_selected)?.name ?? null;
  const noLookup = d.data_status === '조회 불가';
  const recBadge = fromRec || !!last?.top?.some((t) => t.dong_code === code);
  // 관심 등록은 dong_code + 지금 보는 업종(10.7)
  const fav = favs.includes(code);
  const onFav = () => toggleFav(code, industryCode);
  const growth = d.growth;
  const growthLow = growth?.growth_confidence === '낮음';
  const rent = d.rent;
  const distMax = Math.max(...(d.industry_distribution ?? []).map((r) => r.share), 0) || 1;

  return (
    <>
      {header('행정동 상세', <HeartButton on={fav} className="plain" onClick={onFav} />)}
      <main className="page detail">
        <div className="detail-hero">
          <div className="detail-id">
            <div className="detail-name">
              <h1>{d.dong_name}</h1>
              {pred?.data_status === '표본 부족' && <ResidentialBadge lg />}
              {recBadge && <span className="badge badge-rec lg">내 조건으로 추천됐어요</span>}
            </div>
            <div className="detail-tags"><span>{d.district_name}</span>{industryName && <span>{industryName}</span>}</div>
          </div>
          <div className="detail-score">
            <div><b>{scoreText(pred?.total_score)}</b><span>종합점수 / 100</span></div>
            <HeartButton on={fav} className="lg desk-only" onClick={onFav} />
          </div>
        </div>

        {s.data?.summary_text && (
          <div className="ai-summary">
            <span className="ai-tag"><i>AI</i>자동 생성된 요약이에요</span>
            <p>{s.data.summary_text}</p>
          </div>
        )}

        {/* 핵심 숫자 한 줄 — 3단계 상세 패널과 같은 타일(영업 유지 · 예상 월매출 · 성장세 · 예산 여유 · 임대료) */}
        <div className="detail-kpis">
          <PredTiles industryCode={industryCode} industryName={industryName} p={p} />
          <div className="kpi">
            <span className="k">성장세</span>
            <span className="v">
              {growth?.growth_rate != null
                ? <b style={{ color: rateColor(growth.growth_rate) }}>{growthText(growth.growth_rate)}</b>
                : <span className="badge badge-gray">정보 없음</span>}
              {growthLow && <GrowthLowBadge />}
            </span>
            <span className="s">{growthLow ? '확보된 분기가 적거나 상권 기준이 바뀌어 믿기 어려워요. 참고만 해 주세요.' : '최근 1년 매출이 직전 1년보다 이만큼 변했어요.'}</span>
          </div>
          <MarginTile recId={recId} m={m} gu={d.district_name} />
          <div className="kpi">
            <span className="k">임대료</span>
            <span className="v">
              {rent?.monthly_rent != null
                ? <><b>월 {fmt(manwon(rent.monthly_rent))}</b><small>만 원</small></>
                : <span className="badge badge-gray">정보 없음</span>}
              {rent?.monthly_rent != null && rent.confidence === '낮음' && <span className="badge badge-warn">신뢰도 낮음</span>}
            </span>
            <span className="s">
              {rent?.monthly_rent == null ? `${d.district_name}는 임대료 조사 자료가 없어요. 직접 확인이 필요해요.`
                : rent.confidence === '낮음' ? `${rent.basis}이에요 (${areaText(rent.area_sqm)} 기준). 조사된 상권이 적어 실제와 차이가 클 수 있어요.`
                  : `이 동이 아닌 ${rent.basis}이에요 (${areaText(rent.area_sqm)} 기준).`}
            </span>
          </div>
        </div>

        {/* 자세히 볼 차트 3칸(같은 높이): 매출 추이 · 유동 인구 · 업종 분포 */}
        <div className="detail-grid">
          <SalesTrend
            trend={d.sales_trend} breakQuarter={d.space_standard_break}
            latest={d.latest_quarter} industryName={industryName} empty={<NoLookup what="매출 추이" lookup={noLookup} />}
          />
          <FootTraffic pop={d.population_latest} empty={<NoLookup what="유동 인구" />} />
          <section className="card detail-card dist">
            <div className="detail-card-head">
              <h2 className="card-title">업종 분포</h2>
              {d.total_store_count != null && <span className="sub">전체 <b>{fmt(d.total_store_count)}곳</b></span>}
            </div>
            {!d.industry_distribution ? (
              <NoLookup what="업종 분포" lookup={noLookup} />
            ) : (
              // 막대 길이는 가장 많은 업종을 꽉 채운 상대값(차이가 잘 보이게). 실제 비율은 오른쪽 숫자
              <div className="dist-rows">
                {d.industry_distribution.map((r) => (
                  <div key={r.industry_code ?? r.name} className={`dist-row ${r.is_selected ? 'hit' : ''}`}>
                    <span className="name">{r.name}</span>
                    <span className="bar"><i style={{ width: `${(r.share / distMax) * 100}%` }} /></span>
                    <span className="val">{fmt(r.store_count)}곳 · {Math.round(r.share * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 안내 · 기준 분기는 맨 아래(3단계 상세 패널처럼) */}
        <div className="detail-foot">
          <p className="disclaimer">{DISCLAIMER}</p>
          <p className="detail-base">
            상권 지표 기준 {quarterText(a.meta?.base_quarter ?? d.latest_quarter) || '정보 없음'}
            {rent?.base_quarter && ` · 임대료 기준 ${rentQuarterText(rent.base_quarter)}`}
          </p>
        </div>
      </main>

      {/* 하단 바(추천받기와 같은 모양): 데스크톱은 왼쪽 안내 | [이전] + [관심 상권과 비교하기], 모바일은 탭바 위 비교 버튼만(이전은 상단 ‹).
          [이전]은 추천에서 왔으면 3단계(고른 동 그대로)로 — 예전 '다른 추천 동네 보기'와 같은 곳이라 하나로 합쳤다 */}
      <div className="rec-bar">
        <div className="rec-bar-in">
          <div className="rec-bar-left desk-only">
            <p className="detail-bar-text"><b>{d.dong_name}</b>, 다른 곳과도 견줘볼까요? <span>관심 상권과 나란히 놓고 비교해요</span></p>
          </div>
          <div className="rec-bar-act">
            <button type="button" className="btn-ghost rec-bar-back desk-only" aria-label="뒤로가기" onClick={back}><BackIcon />이전</button>
            <Link to={`/compare?dongs=${code}${industryCode ? `&industry_code=${industryCode}` : ''}`} className="btn-primary rec-cta">
              <span className="t">관심 상권과 비교하기</span><Icon name="arrowRight" size={18} />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

/** 상권 정보를 받기 전 — 실제 화면과 같은 배치(이름 · 점수, 핵심 숫자 5칸, 차트 3칸)에 회색 막대.
 *  key가 달라 정보가 오면 실제 화면이 새로 그려지며 평소처럼 들어온다 */
function DetailSkeleton() {
  return (
    <main key="sk" className="page detail detail-loading" aria-busy="true">
      <span className="sr-only" role="status">상권 정보를 불러오는 중…</span>
      <div className="detail-hero">
        <div className="detail-id"><Sk w={150} h={40} /><Sk w={130} h={28} /></div>
        <div className="detail-score"><Sk w={84} h={62} /></div>
      </div>
      <div className="detail-kpis">
        {[0, 1, 2, 3, 4].map((i) => <SkKpi key={i} />)}
      </div>
      <div className="detail-grid">
        {['', '', 'dist'].map((c, i) => <section key={i} className={`card detail-card ${c}`}><Sk w="40%" h={22} /><Sk h={250} /></section>)}
      </div>
    </main>
  );
}

/** ⑪ data_status "조회 불가"(상권분석 대상이 아닌 동) 또는 항목만 비어 있을 때 */
function NoLookup({ what, lookup }) {
  return (
    <div className="pred-none">
      <span className="tag">{lookup ? '조회 불가' : '데이터 없음'}</span>
      <b>{lookup ? '상권분석 대상이 아닌 동네예요' : `${what} 데이터가 없어요`}</b>
      {lookup && <span>{what}는 볼 수 없지만 임대료 · 유동 인구는 확인할 수 있어요.</span>}
    </div>
  );
}

/**
 * ⑫ 예측 → 핵심 숫자 두 칸(영업 유지 · 예상 월매출). 중앙값 + 80% 범위(p10~p90) — '최소~최대'로 쓰지 않는다.
 * 업종이 없거나 · 불러오는 중 · 오류 · 예측 불가면 두 칸 폭 안내 한 칸(.wide)
 */
function PredTiles({ industryCode, industryName, p }) {
  const wide = (body) => <div className="kpi wide pred-none">{body}</div>;
  if (!industryCode) {
    return wide(
      <>
        <span className="tag">업종 미선택</span>
        <b>업종을 고르면 예측을 볼 수 있어요</b>
        <Link to="/search">직접 찾아보기에서 업종 고르기 ›</Link>
      </>,
    );
  }
  if (p.loading) return <><span className="sr-only" role="status">예측을 불러오는 중…</span><SkKpi /><SkKpi /></>; // 영업 유지 · 예상 월매출 두 칸 자리
  if (p.error) {
    return p.error.code === 'INDUSTRY_NOT_FOUND'
      ? wide(<><b>업종 정보를 찾을 수 없어요</b><Link to="/search">다른 업종 고르기 ›</Link></>)
      : <div className="kpi wide"><BoxMsg title="예측을 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(p.error)}`} onRetry={p.retry} /></div>;
  }
  const x = p.data;
  const sv = survivalView(x); // 3년 영업 유지 확률 → 점포 수 증감 → 정보 없음(10.8)
  const sl = range(manwon(x.sales_monthly_p10), manwon(x.sales_monthly_p50), manwon(x.sales_monthly_p90));
  // 두 칸을 다 가리는 건 예측 행이 없거나 영업 유지 · 매출이 둘 다 없을 때만. 하나만 없으면 그 칸만 '정보 없음'
  if (x.data_status === '예측 불가' || (!hasSurvival(sv) && !sl)) {
    return wide(
      <>
        <span className="tag">예측 불가</span>
        <b>{industryName ?? '이 업종'} 예측에 필요한 데이터가 부족해요</b>
        <span>아래 매출 추이 · 유동 인구 · 업종 분포는 실제 데이터라 그대로 볼 수 있어요.</span>
      </>,
    );
  }
  return (
    <>
      {/* 영업 유지는 확률 · 증감 값이라 80% 범위 막대를 그리지 않는다 */}
      <div className="kpi">
        <span className="k">{sv.label}</span>
        <span className="v"><SurvivalValue v={sv} /></span>
        {sv.sub && <span className="s">{sv.sub}</span>}
        {sv.note && <span className="s">{sv.note}</span>}
      </div>
      <div className="kpi">
        <span className="k">예상 월매출 <span>· 80% 범위</span></span>
        <span className="v">{sl ? <><b>{fmt(sl[1])}</b><small>만 원</small></> : <span className="badge badge-gray">정보 없음</span>}</span>
        {sl && <RangeBar range={sl} max={sl[2] * 1.15} ends={[fmt(sl[0]), fmt(sl[2])]} legend />}
        {x.data_status === '표본 부족' && <span className="s">점포가 적은 주거 지역이라 예측 오차가 클 수 있어요.</span>}
      </div>
    </>
  );
}

/** ⑥ 예산 여유(구 기준). 추천을 거치지 않았으면 안내만 */
function MarginTile({ recId, m, gu }) {
  const x = m.data;
  const v = x?.budget_margin != null ? manwon(x.budget_margin) : null;
  let value;
  if (!recId) value = <span className="badge badge-gray">추천을 거치면 표시돼요</span>;
  else if (m.loading) value = <Sk w={110} h={26} />;
  else if (m.error) value = <span className="badge badge-gray">불러오지 못했어요</span>;
  else if (v == null) value = <span className="badge badge-gray">정보 없음</span>;
  else {
    value = (
      <>
        <b className="margin" style={{ color: v >= 0 ? 'var(--green)' : 'var(--down)' }}>{signed(v)} 원</b>
        {v < 0 && <span className="badge badge-warn">예산 부족</span>}
      </>
    );
  }
  return (
    <div className="kpi">
      <span className="k">예산 여유</span>
      <span key={m.loading ? 'sk' : 'v'} className="v fade-in">{value}</span>
      <span className="s">
        {v != null
          ? `가용 예산 ${fmt(manwon(x.available_budget))}만 − 추정 초기 임대비용 ${fmt(manwon(x.estimated_rent_cost))}만 (${gu} 기준)`
          : `가용 예산에서 ${gu} 초기 임대비용(보증금\u00a0+ 월세 3개월)\u2060을 뺀 금액이에요.`}{/* 줄이 '+'로 시작하거나 ')'와 '을' 사이에서 끊기지 않게(\u00a0 · \u2060) */}
      </span>
    </div>
  );
}
