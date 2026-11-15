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

/** 행정동 경계 상자 가운데 { geo_code: [경도, 위도] } */
function boxCenters(geo) {
  const out = {};
  geo.features.forEach((f) => {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    const walk = (c) => (typeof c[0] === 'number'
      ? ([x0, y0, x1, y1] = [Math.min(x0, c[0]), Math.min(y0, c[1]), Math.max(x1, c[0]), Math.max(y1, c[1])])
      : c.forEach(walk));
    walk(f.geometry.coordinates);
    out[String(f.properties.code)] = [(x0 + x1) / 2, (y0 + y1) / 2];
  });
  return out;
}
let centersPromise = null;
/**
 * 행정동 중심점(경계 상자 가운데). 한 번만 계산해 지도 핀(DongLeafletMap) · 가까운 동네(직접찾기)가 같이 쓴다.
 * 경계를 못 받으면 {}(다음에 다시 시도)
 */
export function loadDongCenters() {
  centersPromise ??= loadDongGeo().then((geo) => {
    if (!geo) { centersPromise = null; return {}; }
    return boxCenters(geo);
  });
  return centersPromise;
}
