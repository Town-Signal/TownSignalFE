import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { DEFAULT_SUB } from '../../lib/data';
import { SALES_MAX, SURV_MAX, detailExtra, dongInfo, fmt, growthColor, marginOf, signed } from '../../lib/calc';
import { MobileHeader } from '../../components/Layout';
import { BackIcon, GrowthLowBadge, HeartButton, LevelLegend, LevelRow, RangeBar, ResidentialBadge } from '../../components/ui';
import SalesTrend from './SalesTrend';
import FootTraffic from './FootTraffic';
import './Detail.css';

// 행정동×업종 분기 평균 점포 수가 이보다 적으면 표본 부족으로 예측 숫자를 숨긴다
const MIN_SAMPLE = 5;

function summarize(d, x, sub, lowSample) {
  if (lowSample) return `${d.name}은 ${x.peakAge} 유동 인구가 많은 곳이지만, ${sub} 점포가 분기 평균 ${x.selStoreCount}곳뿐이라 매출·생존 예측을 보여드리기 어려워요. 업종 분포와 매출 추이를 먼저 살펴보세요.`;
  if (d.noPred) return `${d.name}은 ${x.peakAge} 유동 인구가 많은 곳이지만, ${sub} 업종은 점포 수가 적어 매출·생존 예측이 어려워요. 실제 매출 추이를 먼저 확인해 보세요.`;
  if (d.residential) return `${d.name}은 점포가 적은 주거 중심 동네예요. 경쟁은 적지만 월매출 중앙값이 ${fmt(d.sl[1])}만 원으로 낮은 편이라, 생활 밀착형 업종에 더 어울려요.`;
  const verdict = d.score >= 70 ? '균형이 좋은' : d.score >= 55 ? '무난한' : '신중히 볼 필요가 있는';
  return `${d.name}은 ${x.peakAge} 유동 인구가 많고, ${sub} 기준 예상 월매출 ${fmt(d.sl[1])}만 원 · 생존 ${d.sv[1]}개월로 ${verdict} 후보예요.${d.hasGrowth ? ` 최근 1년 매출은 ${d.growthTxt} 변했어요.` : ''}`;
}

export default function Detail() {
  const { name } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { favs, toggleFav, last } = useAppState();

  const d = dongInfo(name);
  const from = params.get('from');
  const fromRec = from === 'rec';

  const back = () => {
    if (fromRec) navigate(`/recommend?step=3&sel=${encodeURIComponent(name)}`);
    else if (location.key !== 'default') navigate(-1); // 앱 안에서 들어온 경우
    else navigate(from === 'search' ? '/search' : '/');
  };

  if (!d) {
    return (
      <>
        <MobileHeader title="행정동 상세" left={<button type="button" className="mob-header-btn" aria-label="뒤로가기" onClick={back}>‹</button>} />
        <main className="page">
          <div className="card empty">
            <div className="icon">?</div>
            <div className="title">{name} 데이터가 없어요</div>
            <div className="desc">이 동네에는 점포 데이터가 없어요. 다른 동네를 찾아보세요.</div>
            <div className="actions"><Link to="/search" className="btn-primary">직접 찾아보기</Link></div>
          </div>
        </main>
      </>
    );
  }

  const sub = params.get('sub') || last?.sub || DEFAULT_SUB;
  const x = detailExtra(name, sub);
  const lowSample = !d.noPred && x.selStoreCount != null && x.selStoreCount < MIN_SAMPLE;
  const noPred = d.noPred || lowSample;
  const margin = marginOf(last, d.gu);
  const fav = favs.includes(name);
  const onFav = () => toggleFav(name, sub);

  const rentNote = d.rent == null ? `${d.gu}는 임대료 조사 자료가 없어요. 직접 확인이 필요해요.`
    : d.rentLow ? `${d.gu} 평균값이에요. 이 구는 조사된 상권이 1곳뿐이라 실제와 차이가 클 수 있어요.`
      : `이 동이 아닌 ${d.gu} 전체의 평균값이에요.`;
  const growthWhy = d.growthLowWhy && `${d.growthLowWhy} 믿기 어려워요.`;

  return (
    <>
      <MobileHeader
        title="행정동 상세"
        left={<button type="button" className="mob-header-btn" aria-label="뒤로가기" onClick={back}>‹</button>}
        right={<HeartButton on={fav} className="plain" onClick={onFav} />}
      />
      <main className="page detail" key={name}>
        <button type="button" className="round-btn desk-only detail-back" aria-label="뒤로가기" title="뒤로가기" onClick={back}><BackIcon /></button>

        <div className="detail-hero">
          <div className="detail-id">
            <div className="detail-name">
              <h1>{d.name}</h1>
              {d.residential && <ResidentialBadge lg />}
            </div>
            <div className="detail-tags"><span>{d.gu}</span><span>{sub}</span></div>
          </div>
          <div className="detail-score">
            <div><b>{noPred ? '—' : d.scoreTxt}</b><span>종합점수 / 100</span></div>
            <HeartButton on={fav} className="lg desk-only" onClick={onFav} />
          </div>
        </div>

        <div className="ai-summary">
          <span className="ai-tag"><i>AI</i>AI가 분석하여 생성한 문장이에요</span>
          <p>{summarize(d, x, sub, lowSample)}</p>
        </div>

        <div className="detail-grid">
          <section className="card detail-card pred">
            <h2 className="card-title">예상 생존 기간 · 예상 월매출</h2>
            {noPred ? (
              <div className="pred-none">
                <span className="tag">{lowSample ? '표본이 적어 신뢰할 수 없음' : '예측 불가'}</span>
                <b>{lowSample ? `${sub} 점포가 평균 ${x.selStoreCount}곳뿐이라 예측하기 어려워요` : `${sub} 예측에 필요한 데이터가 부족해요`}</b>
                <span>아래 업종 분포·매출 추이·유동 인구는 실제 데이터라 그대로 볼 수 있어요.</span>
              </div>
            ) : (
              <div className="pred-metrics">
                <div>
                  <div className="metric-head"><span>예상 생존 기간</span><span><b>{d.sv[1]}</b>개월</span></div>
                  <RangeBar range={d.sv} max={SURV_MAX} />
                  <div className="pred-range">80% 범위 {d.sv[0]}~{d.sv[2]}개월</div>
                </div>
                <div>
                  <div className="metric-head"><span>예상 월매출</span><span><b>{fmt(d.sl[1])}</b>만 원</span></div>
                  <RangeBar range={d.sl} max={SALES_MAX} />
                  <div className="pred-range">80% 범위 {fmt(d.sl[0])}~{fmt(d.sl[2])}만 원</div>
                </div>
              </div>
            )}
            <p className="disclaimer">예측은 참고용이에요. 최종 판단과 책임은 사용자에게 있어요.</p>
          </section>

          <div className="detail-side">
            <div className="detail-pair">
              <section className="card stat-card">
                <div className="stat-head">
                  <h2 className="card-title">성장세</h2>
                  {growthWhy && <GrowthLowBadge title={growthWhy} />}
                </div>
                {d.hasGrowth
                  ? <b className="stat-value" style={{ color: growthColor(d) }}>{d.growthTxt}</b>
                  : <span className="badge badge-gray lg">정보 없음</span>}
                <span className="stat-note">{growthWhy ? `${growthWhy} 증감률은 참고만 해 주세요.` : '최근 1년 매출이 직전 1년보다 이만큼 변했어요.'}</span>
              </section>
              {/* 예산 여유는 추천 이력이 있을 때만 (없으면 성장세·임대료 2블록) */}
              {last && (
                <section className="card stat-card">
                  <h2 className="card-title">예산 여유</h2>
                  {margin == null
                    ? <span className="badge badge-gray lg">정보 없음</span>
                    : <b className="stat-value" style={{ color: margin >= 0 ? 'var(--green)' : 'var(--down)' }}>{signed(margin)} 원</b>}
                  <span className="stat-note">가용 예산에서 {d.gu} 초기 임대비용을 뺀 금액이에요.<br />(초기 임대비용 = 보증금 + 월세 3개월)</span>
                </section>
              )}
            </div>
            <section className="card stat-card rent">
              <div className="stat-head">
                <h2 className="card-title">임대료</h2>
                {d.rentLow && <span className="badge badge-warn lg">신뢰도 낮음</span>}
                {d.rent == null && <span className="badge badge-gray lg">정보 없음</span>}
              </div>
              {d.rent != null && <b className="stat-value">월 {fmt(d.rent)}만 원</b>}
              <span className="stat-note lg">{rentNote}</span>
            </section>
          </div>

          <section className="card detail-card dist">
            <div className="detail-card-head">
              <h2 className="card-title">업종 분포</h2>
              <LevelLegend title="업종별 점포 수를 서울시 전체 행정동 기준 하위 33% · 중위 · 상위 33%로 나눴어요" />
            </div>
            {x.dist.map((r) => <LevelRow key={r.label} label={r.label} w={r.w} hit={r.sel} />)}
          </section>

          <SalesTrend quarters={x.quarters} lastQ={x.lastQ} sub={sub} />
          <FootTraffic male={x.male} female={x.female} ages={x.ages} />
        </div>

        <div className="card detail-cta">
          <div className="text"><b>{d.name}, 다른 곳과도 견줘볼까요?</b><span>관심 상권과 나란히 놓고 비교해요</span></div>
          <div className="actions">
            <Link to={fromRec ? '/recommend?step=3' : '/search'} className="btn-ghost">{fromRec ? '다른 추천 동네 보기' : '다른 동네 검색'}</Link>
            <Link to="/compare" className="btn-primary">관심 상권과 비교하기 <span>›</span></Link>
          </div>
        </div>
      </main>
    </>
  );
}
