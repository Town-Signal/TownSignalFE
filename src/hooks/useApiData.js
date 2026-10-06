import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { toApiError } from '../lib/errors';

/**
 * GET 한 건을 영역 단위로 불러온다. path가 null이면 부르지 않는다.
 * 반환: { data, meta, error(ApiError), loading, retry }. 경로가 바뀌거나 화면을 떠나면 늦게 온 응답은 버린다.
 */
export function useApiData(path) {
  const [state, setState] = useState({ loading: !!path });
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!path) { setState({ loading: false }); return undefined; }
    let alive = true;
    setState({ loading: true });
    api(path)
      .then((json) => { if (alive) setState({ data: json.data, meta: json.meta, loading: false }); })
      .catch((e) => { if (alive) setState({ error: toApiError(e), loading: false }); });
    return () => { alive = false; };
  }, [path, tries]);

  const retry = useCallback(() => setTries((n) => n + 1), []);
  return { ...state, retry };
}
