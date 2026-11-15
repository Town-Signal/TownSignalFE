import { Sk } from '../../components/ui';
import { DESKTOP, useMediaQuery, WIDE } from '../../hooks/useMediaQuery';

const times = (n, f) => Array.from({ length: n }, (_, i) => f(i));

/**
 * 최근 추천 결과(rec_id)를 다시 받는 동안 — 2 · 3단계와 같은 배치에 회색 막대.
 * 2단계: 요약 띠 + 구 목록(넓으면 오른쪽 계산서 패널), 3단계: 제목 + 동 목록 | 상세 패널(모바일은 카드)
 */
export default function RestoreSkeleton({ step }) {
  const wide = useMediaQuery(WIDE);
  const isDesk = useMediaQuery(DESKTOP);
  if (step === 2) {
    return (
      <div className={`s2-body ${wide ? 'wide' : ''}`} aria-hidden="true">
        <div className="s2-main">
          <section className="card s2-summary"><div className="s2-sum-head sk-lines"><Sk w="55%" h={24} /><Sk w="35%" h={14} /></div></section>
          <div className="card s2-list-card">
            <div className="s2-list-head"><Sk w={180} h={18} /></div>
            <ul className="s2-list">
              {times(8, (i) => (
                <li key={i}>
                  <div className="s2-row"><span className="name"><Sk w={64} h={18} /></span><span className="budget-bar"><Sk h={10} /></span><span className="nums"><Sk w={120} h={18} /></span></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {wide && <aside className="s2-side"><div className="card s2-panel sk-lines">{times(6, (i) => <Sk key={i} w={`${90 - i * 8}%`} h={16} />)}</div></aside>}
      </div>
    );
  }
  return (
    <div className="s3" aria-hidden="true">
      <div className="s3-head"><div className="s3-title"><div className="sk-lines"><Sk w={220} h={30} /><Sk w={180} h={14} /></div></div></div>
      {isDesk ? (
        <div className="s3-desk">
          <div className="s3-rows-box">
            <div className="s3-rows"><div className="s3-rows-in">
              {times(6, (i) => <div key={i} className="s3-row"><Sk w={24} h={24} r={8} /><div className="info sk-lines"><Sk w="50%" h={18} /><Sk w="80%" h={12} /></div><Sk w={40} h={24} /></div>)}
            </div></div>
          </div>
          <div className="card s3-panel"><div className="s3-panel-in sk-lines"><Sk w="40%" h={30} /><Sk h={120} /><Sk h={160} /></div></div>
        </div>
      ) : (
        <div className="s3-cards">{times(4, (i) => <div key={i} className="s3-card sk-lines"><Sk w="50%" h={18} /><Sk w="80%" h={12} /></div>)}</div>
      )}
    </div>
  );
}
