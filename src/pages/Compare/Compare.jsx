import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { api } from '../../lib/api';
import { toApiError } from '../../lib/errors';
import { findIndustry } from '../../lib/masters';
import { detailPath, isDongCode } from '../../lib/paths';
import { fmt, growthText, manwon, quarterText, requestIdText, signed } from '../../lib/format';
import { useApiError } from '../../hooks/useApiError';
import { useDongNames } from '../../hooks/useDongNames';
import { useIndustries } from '../../hooks/useIndustries';
import { MobileHeader } from '../../components/Layout';
import { BoxMsg } from '../../components/ui';
import './Compare.css';

const MAX = 4;
const na = (text) => ({ badge: text });
const rateColor = (rate) => (rate >= 0 ? 'var(--green)' : 'var(--down)');
const won = (v) => fmt(manwon(v));

/**
 * 비교표 행: [항목, 보조 설명, 셀 내용(⑭ 항목 → 표시), '최고' 판정값(클수록 좋음, 없으면 판정 안 함)].
 * '최고'는 받은 값끼리 견주는 표시용 비교일 뿐이다(10.6 가정). 임대비용은 낮은 쪽이 최고.
 */
const rowDefs = (hasRec) => [
  ['종합점수', '0~100', (d) => (d.total_score == null ? na('예측 불가') : { txt: String(d.total_score), className: 'score' }), (d) => d.total_score],
  ['예상 생존', '중앙값 · 80% 범위', (d) => (d.survival_p50 == null ? na('예측 불가') : {
    txt: `${d.survival_p50}개월`, sub: d.survival_range && `${d.survival_range[0]}~${d.survival_range[1]}개월`,
  }), (d) => d.survival_p50],
  ['예상 월매출', '중앙값 · 80% 범위', (d) => (d.sales_monthly_p50 == null ? na('예측 불가') : {
    txt: `${won(d.sales_monthly_p50)}만`, sub: d.sales_monthly_range && `${won(d.sales_monthly_range[0])}~${won(d.sales_monthly_range[1])}만`,
  }), (d) => d.sales_monthly_p50],
  ['성장세', '최근 1년', (d) => (d.growth_rate == null ? na('정보 없음') : { txt: growthText(d.growth_rate), color: rateColor(d.growth_rate) }), (d) => d.growth_rate],
  ['추정 초기 임대비용', '구 평균 · 보증금 + 월세 3개월', (d) => (d.estimated_rent_cost == null ? na('정보 없음') : {
    txt: `${won(d.estimated_rent_cost)}만 원`, warn: d.rent_confidence === '낮음' && '신뢰도 낮음',
  }), (d) => (d.estimated_rent_cost == null ? null : -d.estimated_rent_cost)],
  ['예산 여유', hasRec ? '구 기준' : '추천 후 표시', (d) => {
    if (!hasRec) return { txt: '추천을 거치면 표시돼요', className: 'dash' };
    if (d.budget_margin == null) return na('정보 없음');
    const v = manwon(d.budget_margin);
    return { txt: `${signed(v)} 원`, color: v >= 0 ? 'var(--green)' : 'var(--down)', warn: d.passed === '제외' && '예산 부족' };
  }, (d) => (hasRec ? d.budget_margin : null)],
];

export default function Compare() {
  const { favs, favIndustry, last } = useAppState();
  const handleError = useApiError();
  const [params] = useSearchParams();
  const industries = useIndustries();

  // 후보: 관심 동네 + 상세에서 넘어온 현재 동(?dongs=…&industry_code=…, 10.6 1)
  const fromDongs = (params.get('dongs') ?? '').split(',').filter(isDongCode);
  const fromIndustry = params.get('industry_code');
  const candidates = [...favs, ...fromDongs.filter((c) => !favs.includes(c))];
  const industryOf = (c) => (favs.includes(c) ? favIndustry(c) : fromIndustry || favIndustry(c));
  const names = useDongNames(candidates);
  const label = (c) => names[c]?.dong_name ?? c;

  // null = 아직 직접 고르지 않음 → 첫 후보와 같은 업종 최대 4곳을 기본 선택
  const [picked, setPicked] = useState(() => (fromDongs.length ? fromDongs.slice(0, MAX) : null));
  const firstIndustry = candidates.map(industryOf).find(Boolean);
  const sel = (picked ?? candidates.filter((c) => industryOf(c) === firstIndustry).slice(0, MAX))
    .filter((c) => candidates.includes(c) && industryOf(c));
  const baseIndustry = sel.length ? industryOf(sel[0]) : null; // 처음 고른 후보지의 업종이 비교 기준
  // TODO(가정): 업종을 모르는 후보(ts-fav-sub · ts-cond · ts-last 모두 없음)는 고를 수 없다
  const isOff = (c) => !sel.includes(c) && (!industryOf(c) || (!!baseIndustry && industryOf(c) !== baseIndustry));
  const toggle = (c) => {
    if (sel.includes(c)) setPicked(sel.filter((x) => x !== c));
    else if (!isOff(c) && sel.length < MAX) setPicked([...sel, c]);
  };
  const industryName = (code) => findIndustry(industries, code)?.name ?? '업종 정보 없음';

  // ⑭ 비교 — 선택이 바뀔 때마다. rec_id가 있으면 예산 여유 · passed까지(스냅샷 기준)
  const recId = last?.rec_id ?? null;
  const reqKey = JSON.stringify({ dong_codes: sel, industry_code: baseIndustry, rec_id: recId });
  const [cmp, setCmp] = useState({});
  const [tries, setTries] = useState(0);
  useEffect(() => {
    const req = JSON.parse(reqKey);
    if (!req.dong_codes.length || !req.industry_code) { setCmp({}); return undefined; }
    if (!req.rec_id) delete req.rec_id;
    let alive = true;
    setCmp((cur) => ({ ...cur, loading: true, error: null }));
    api('/regions/compare', { method: 'POST', body: req })
      .then((json) => { if (alive) setCmp({ data: json.data, meta: json.meta, hasRec: !!req.rec_id }); })
      .catch((e) => {
        if (!alive) return;
        const err = toApiError(e);
        // REC_NOT_FOUND → ts-last의 rec_id만 지운다. rec_id가 바뀌어 rec_id 없이 다시 부른다
        if (err.code === 'REC_NOT_FOUND') handleError(err);
        else setCmp({ error: err });
      });
    return () => { alive = false; };
  }, [reqKey, tries, handleError]);

  const items = cmp.data?.comparison_items ?? [];
  const rows = rowDefs(!!cmp.hasRec).map(([rowLabel, note, cell, value]) => {
    const nums = value ? items.map((d) => value(d) ?? -Infinity) : [];
    const max = Math.max(...nums);
    const best = items.length > 1 && Number.isFinite(max) && nums.filter((n) => n === max).length === 1 ? nums.indexOf(max) : -1;
    return { label: rowLabel, note, cells: items.map((d, i) => ({ ...cell(d), best: i === best })) };
  });

  // 같은 자치구의 동은 임대료 · 예산 여유(구 평균)가 같게 나온다(10.8)
  const byGu = {};
  items.forEach((d) => (byGu[d.district_code] ??= []).push(`${d.dong_name}(${d.district_name})`));
  const sameGu = Object.values(byGu).filter((a) => a.length > 1).map((a) => a.join(' · ')).join(', ');
  const single = items.length === 1;

  return (
    <>
      <MobileHeader title="후보지 비교" />
      <main className="page">
        <div className="page-head">
          <h1 className="page-title">관심 후보지 비교</h1>
          <p className="page-sub">관심 등록한 곳 중 최대 {MAX}곳을 골라 나란히 봐요.</p>
        </div>

        {candidates.length === 0 ? (
          <div className="card empty">
            <div className="icon">♡</div>
            <div className="title">비교할 관심 동네가 없어요</div>
            <div className="desc">추천 결과나 검색에서 ♡를 눌러 1곳 이상 등록해 주세요.</div>
            <div className="actions">
              <Link to="/recommend" className="btn-primary">조건으로 추천받기</Link>
              <Link to="/search" className="btn-ghost">직접 찾아보기</Link>
            </div>
          </div>
        ) : (
          <>
            <div className="cmp-chips">
              {candidates.map((c) => {
                const on = sel.includes(c);
                const off = isOff(c);
                const ic = industryOf(c);
                return (
                  <button
                    key={c} type="button" aria-pressed={on} aria-disabled={off}
                    className={`cmp-chip ${on ? 'on' : ''} ${off ? 'off' : ''} ${!on && sel.length >= MAX ? 'full' : ''}`}
                    title={!ic ? '업종 정보가 없어 비교할 수 없어요' : off ? `${industryName(baseIndustry)}와 업종이 달라 같이 비교할 수 없어요` : undefined}
                    onClick={() => toggle(c)}
                  >
                    {on ? '✓' : '+'} {label(c)}<span>{names[c]?.district_name ? `${names[c].district_name} · ` : ''}{industryName(ic)}</span>
                  </button>
                );
              })}
              <span className="cmp-count">{sel.length}/{MAX} 선택</span>
            </div>
            {baseIndustry && (
              <p className="cmp-base">
                <b>{industryName(baseIndustry)}</b> 기준으로 비교해요
                {candidates.some(isOff) && ' · 업종이 다른 후보지는 함께 고를 수 없어요'}
              </p>
            )}
            {sameGu && (
              <div className="cmp-info">
                <i aria-hidden="true">i</i>
                <span><b>{sameGu}</b>는 같은 자치구라 임대료 · 예산 여유가 같은 값으로 보여요. 두 값 모두 구 단위 데이터라 오류가 아니에요.</span>
              </div>
            )}

            {!sel.length ? (
              <div className="card empty">
                <b className="title">비교할 동네를 골라 주세요</b>
                <span className="desc">같은 업종의 후보지를 2곳 이상 고르면 나란히 비교해 드려요</span>
              </div>
            ) : cmp.error ? (
              <div className="card">
                <BoxMsg title="비교 정보를 불러오지 못했어요" desc={`잠시 후 다시 시도해 주세요.${requestIdText(cmp.error)}`} onRetry={() => setTries((n) => n + 1)} />
              </div>
            ) : !items.length ? (
              <div className="card empty" role="status"><span className="desc">비교 정보를 불러오는 중…</span></div>
            ) : (
              <div className={`card cmp-scroll ${cmp.loading ? 'cmp-loading' : ''}`}>
                <table className="cmp-table" style={{ '--cols': items.length + (single ? 1 : 0) }}>
                  <thead>
                    <tr>
                      <td />
                      {items.map((d) => (
                        <th key={d.dong_code} scope="col">
                          <Link to={detailPath(d.dong_code, { industryCode: baseIndustry })}><b>{d.dong_name}</b><span>{d.district_name}</span></Link>
                        </th>
                      ))}
                      {single && <th scope="col" className="cmp-slot">비교할 상권을 1곳 더 골라주세요</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}<span>{row.note}</span></th>
                        {row.cells.map((c, i) => (
                          <td key={items[i].dong_code}>
                            <div className={`cmp-cell ${c.className ?? ''}`} style={{ color: c.color }}>
                              {c.txt}
                              {c.best && <span className="cmp-best">최고</span>}
                              {c.badge && <span className="badge badge-gray">{c.badge}</span>}
                              {c.warn && <span className="badge badge-warn">{c.warn}</span>}
                              {c.sub && <span className="cmp-sub">80% 범위 {c.sub}</span>}
                            </div>
                          </td>
                        ))}
                        {single && <td className="cmp-slot" />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="disclaimer">
              예측은 참고용이에요. 최종 판단과 책임은 사용자에게 있어요.
              {cmp.meta?.base_quarter && ` 상권 지표 기준 ${quarterText(cmp.meta.base_quarter)}.`}
            </p>
          </>
        )}
      </main>
    </>
  );
}
