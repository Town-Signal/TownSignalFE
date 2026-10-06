import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { loadMasters } from '../../lib/masters';
import { detailPath } from '../../lib/paths';

/**
 * 예전 주소 /dong/{동 이름}(목업 시절 링크 · 북마크)을 새 주소로 옮긴다.
 * TODO(가정): ⑦로 이름을 찾아 이름이 정확히 같은 동이 1곳이면 /dong/{dong_code}로, 0곳 · 여러 곳(신사동)이면 직접 찾아보기(?q=)로.
 */
export default function LegacyDongRedirect({ name }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get('from');
  const sub = params.get('sub');

  useEffect(() => {
    let alive = true;
    (async () => {
      let target = `/search?q=${encodeURIComponent(name)}`;
      try {
        const { items } = (await api(`/regions/search?q=${encodeURIComponent(name)}`)).data;
        const same = items.filter((i) => i.dong_name === name);
        if (same.length === 1) {
          let industryCode = null;
          if (sub) {
            // 예전 주소의 sub(업종 이름) → ⑩ 업종 코드. 못 찾으면 업종 없이 연다
            industryCode = await loadMasters()
              .then((m) => m.industries.find((i) => i.name === sub)?.industry_code ?? null, () => null);
          }
          target = detailPath(same[0].dong_code, { industryCode, from });
        }
      } catch { /* 찾지 못하면 직접 찾아보기로 */ }
      if (alive) navigate(target, { replace: true });
    })();
    return () => { alive = false; };
  }, [name, from, sub, navigate]);

  return (
    <main className="page">
      <div className="card empty" role="status"><div className="desc">동네를 찾는 중…</div></div>
    </main>
  );
}
