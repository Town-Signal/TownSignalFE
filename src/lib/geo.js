// 서울 경계 GeoJSON. 번들에 넣지 않고 처음 지도를 열 때 한 번만 받아 공유한다.
import { ApiError, forcedFailure } from './errors';

const cache = {};

function load(file) {
  const fail = forcedFailure();
  if (fail) return Promise.reject(new ApiError({ code: fail }));
  if (!cache[file]) {
    cache[file] = fetch(`${import.meta.env.BASE_URL}geo/${file}`)
      .then((r) => {
        if (!r.ok) throw Object.assign(new Error(`geo ${r.status}`), { status: r.status });
        return r.json();
      })
      .catch((e) => {
        delete cache[file]; // 다음 진입 때 다시 시도
        throw e;
      });
  }
  return cache[file];
}

/** 자치구 경계 (25개) */
export const loadGuGeo = () => load('seoul_municipalities_geo_simple.json');
/** 행정동 경계. 실패해도 구 지도는 그릴 수 있게 null로 떨어뜨린다 */
export const loadDongGeo = () => load('seoul_submunicipalities_geo_simple.json').catch(() => null);
