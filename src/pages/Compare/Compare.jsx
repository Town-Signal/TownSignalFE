import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppState } from '../../context/AppState';
import { dongInfo, dongPath, fmt, growthColor, marginOf, signed } from '../../lib/calc';
import { MobileHeader } from '../../components/Layout';
import './Compare.css';

const MAX = 4;
const na = (text) => ({ badge: text });

// [항목, 보조 설명, 셀 내용, '최고' 판정용 숫자(없으면 판정 안 함)]
const rowDefs = (last) => [
  ['종합점수', '0~100', (d) => (d.noPred ? na('예측 불가') : { txt: d.scoreTxt, className: 'score' }), (d) => d.score],
  ['생존 기간', '80% 범위', (d) => (d.noPred ? na('예측 불가') : { txt: d.survRange }), (d) => d.sv?.[1]],
  ['월매출', '80% 범위', (d) => (d.noPred ? na('예측 불가') : { txt: d.salesRange }), (d) => d.sl?.[1]],
  ['성장세', '최근 1년', (d) => (d.hasGrowth ? { txt: d.growthTxt, color: growthColor(d) } : na('정보 없음')), (d) => d.growth],
  ['임대료', '구 평균', (d) => (d.rent == null ? na('정보 없음') : { txt: `월 ${fmt(d.rent)}만 원`, warn: d.rentLow && '신뢰도 낮음' })],
  ['예산 여유', last ? '구 기준' : '추천 후 표시', (d) => {
    const m = marginOf(last, d.gu);
    return m === undefined ? { txt: '—', className: 'dash' } : m === null ? na('정보 없음') : { txt: `${signed(m)} 원`, color: 'var(--green)' };
  }, (d) => marginOf(last, d.gu)],
];

export default function Compare() {
  const { favs, favSub, last } = useAppState();
  const [params] = useSearchParams();
  // null = 아직 직접 고르지 않음 → 첫 관심 동네와 같은 업종 최대 4곳을 기본 선택
  const [picked, setPicked] = useState(() => params.get('dongs')?.split(',').filter(Boolean) ?? null);

  const sel = (picked ?? favs.filter((n) => favSub(n) === favSub(favs[0])).slice(0, MAX)).filter((n) => favs.includes(n));
  const baseSub = sel.length ? favSub(sel[0]) : null; // 처음 고른 후보지의 업종이 비교 기준
  const isOff = (n) => !sel.includes(n) && !!baseSub && favSub(n) !== baseSub;
  const toggle = (n) => {
    if (sel.includes(n)) setPicked(sel.filter((x) => x !== n));
    else if (!isOff(n) && sel.length < MAX) setPicked([...sel, n]);
  };

  const dongs = sel.map(dongInfo);
  const rows = rowDefs(last).map(([label, note, cell, value]) => {
    const nums = value ? dongs.map((d) => value(d) ?? -Infinity) : [];
    const max = Math.max(...nums);
    const best = dongs.length > 1 && Number.isFinite(max) ? nums.indexOf(max) : -1;
    return { label, note, cells: dongs.map((d, i) => ({ ...cell(d), best: i === best })) };
  });

  // 같은 구의 동은 임대료·예산 여유(구 평균)가 같게 나온다
  const byGu = {};
  dongs.forEach((d) => (byGu[d.gu] ??= []).push(d.name));
  const sameGu = Object.values(byGu).filter((a) => a.length > 1).map((a) => a.join('·')).join(', ');

  return (
    <>
      <MobileHeader title="후보지 비교" />
      <main className="page">
        <div className="page-head">
          <h1 className="page-title">관심 후보지 비교</h1>
          <p className="page-sub">관심 등록한 곳 중 최대 {MAX}곳을 골라 나란히 봐요.</p>
        </div>

        {favs.length === 0 ? (
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
              {favs.map((n) => {
                const on = sel.includes(n);
                const off = isOff(n);
                return (
                  <button
                    key={n} type="button" aria-pressed={on} aria-disabled={off}
                    className={`cmp-chip ${on ? 'on' : ''} ${off ? 'off' : ''} ${!on && sel.length >= MAX ? 'full' : ''}`}
                    title={off ? `${baseSub}와 업종이 달라 같이 비교할 수 없어요` : undefined}
                    onClick={() => toggle(n)}
                  >
                    {on ? '✓' : '+'} {n}<span>· {favSub(n)}</span>
                  </button>
                );
              })}
              <span className="cmp-count">{sel.length}/{MAX} 선택</span>
            </div>
            {baseSub && (
              <p className="cmp-base">
                <b>{baseSub}</b> 기준으로 비교해요
                {favs.some(isOff) && ' · 업종이 다른 후보지는 함께 고를 수 없어요'}
              </p>
            )}
            {sameGu && (
              <div className="cmp-info">
                <i aria-hidden="true">i</i>
                <span><b>{sameGu}</b>는 같은 자치구라 임대료·예산 여유가 같은 값으로 보여요. 두 값 모두 구 평균이라 오류가 아니에요.</span>
              </div>
            )}

            {dongs.length === 0 ? (
              <div className="card empty">
                <b className="title">비교할 동네를 골라 주세요</b>
                <span className="desc">같은 업종의 후보지를 2곳 이상 고르면 나란히 비교해 드려요</span>
              </div>
            ) : (
              <div className="card cmp-scroll">
                <table className="cmp-table" style={{ '--cols': dongs.length }}>
                  <thead>
                    <tr>
                      <td />
                      {dongs.map((d) => (
                        <th key={d.name} scope="col">
                          <Link to={dongPath(d.name, { sub: baseSub })}><b>{d.name}</b><span>{d.gu}</span></Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}<span>{row.note}</span></th>
                        {row.cells.map((c, i) => (
                          <td key={dongs[i].name}>
                            <div className={`cmp-cell ${c.className ?? ''}`} style={{ color: c.color }}>
                              {c.txt}
                              {c.best && <span className="cmp-best">최고</span>}
                              {c.badge && <span className="badge badge-gray">{c.badge}</span>}
                              {c.warn && <span className="badge badge-warn">{c.warn}</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="disclaimer">범위는 80% 확률 범위예요. 예측은 참고용이에요. 최종 판단과 책임은 사용자에게 있어요.</p>
          </>
        )}
      </main>
    </>
  );
}
