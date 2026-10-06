// dong_code → 동 이름 · 구 이름 · geo_code. ⑫ 예측 응답에 이름이 없어서(관심 카드 · 비교 칩)
// ⑧ 자치구 목록(한 번) + 필요한 구의 ⑨ 행정동 목록(구별로 한 번)으로 찾는다. district_code = dong_code 앞 5자리.
import { api } from './api';

let districtsPromise = null;
const dongsByDistrict = {};

const loadDistricts = () => {
  districtsPromise ??= api('/regions/districts')
    .then((json) => Object.fromEntries(json.data.items.map((d) => [d.district_code, d.name])))
    .catch((e) => { districtsPromise = null; throw e; });
  return districtsPromise;
};
const loadDongs = (districtCode) => {
  dongsByDistrict[districtCode] ??= api(`/regions/dongs?district_code=${districtCode}`)
    .then((json) => json.data.items)
    .catch((e) => { delete dongsByDistrict[districtCode]; throw e; });
  return dongsByDistrict[districtCode];
};

/** { [dong_code]: { dong_name, district_name, geo_code } }. 못 찾은 코드는 빠진다(화면은 코드로 대신 표시) */
export async function loadDongNames(codes) {
  const names = await loadDistricts();
  const districts = [...new Set(codes.map((c) => c.slice(0, 5)))];
  const lists = await Promise.all(districts.map((d) => loadDongs(d).catch(() => [])));
  const out = {};
  lists.flat().forEach((x) => {
    if (codes.includes(x.dong_code)) {
      out[x.dong_code] = { dong_name: x.name, district_name: names[x.district_code] ?? null, geo_code: x.geo_code ?? null };
    }
  });
  return out;
}
