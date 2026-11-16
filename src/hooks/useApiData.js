import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toApiError } from '../lib/errors';

/**
 * GET 한 건을 영역 단위로 불러온다. path가 null이면 부르지 않는다.
 * 반환: { data, meta, error(ApiError), loading, retry }. 경로가 바뀌거나 화면을 떠나면 늦게 온 응답은 버린다.
 * 받은 상태에는 그 경로(for)를 함께 둔다 — 경로가 바뀐 첫 렌더(effect 전)에 이전 경로의 데이터를 돌려주지 않게
 */
export function useApiData(path) {
  const [state, setState] = useState({ for: path, loading: !!path });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!path) { setState({ for: path, loading: false }); return undefined; }
    let alive = true;
    setState({ for: path, loading: true });
    api(path)
      .then((json) => { if (alive) setState({ for: path, data: json.data, meta: json.meta, loading: false }); })
      .catch((e) => { if (alive) setState({ for: path, error: toApiError(e), loading: false }); });
    return () => { alive = false; };
  }, [path, tries]);

  const retry = useCallback(() => setTries((n) => n + 1), []);
  if (state.for !== path) return { loading: !!path, retry };
  const { data, meta, error, loading } = state;
  return { data, meta, error, loading, retry };
}
