// dong_code → 동 이름 · 구 이름. 기본은 ⑫ 예측 응답의 dong_name · district_name을 쓴다.
// 업종을 모르는 동만 ⑫를 부를 수 없어서, 그때만 ⑧ 자치구 목록(한 번) + 필요한 구의 ⑨ 행정동 목록(구별로 한 번)으로 찾는다.
// district_code = dong_code 앞 5자리.
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

const pick = (x) => ({ dong_name: x.dong_name, district_name: x.district_name });

/** 업종을 아는 동: ⑫ 응답의 이름. 실패하면 빠진다 */
const namesFromPredictions = (pairs) => Promise.all(pairs.map(([code, industryCode]) => (
  api(`/regions/predictions/${code}/${industryCode}`).then((json) => [code, pick(json.data)], () => null)
))).then((rows) => Object.fromEntries(rows.filter(Boolean)));

/** 업종을 모르는 동(대체 경로): ⑧ · ⑨ 목록에서 찾는다. 못 찾은 코드는 빠진다 */
async function namesFromLists(codes) {
  if (!codes.length) return {};
  const guNames = await loadDistricts();
  const districts = [...new Set(codes.map((c) => c.slice(0, 5)))];
  const lists = await Promise.all(districts.map((d) => loadDongs(d).catch(() => [])));
  const out = {};
  lists.flat().forEach((x) => {
    if (codes.includes(x.dong_code)) out[x.dong_code] = { dong_name: x.name, district_name: guNames[x.district_code] ?? null };
  });
  return out;
}

// 한 번 찾은 이름은 기억해 둔다 — 이름은 업종과 상관없어서, 비교 화면을 다시 열 때마다 동마다 ⑫를 또 부르지 않게
const nameCache = {};

/**
 * [[dong_code, industry_code | null], …] → { [dong_code]: { dong_name, district_name } }.
 * 업종이 있으면 ⑫, 없으면 ⑧ · ⑨. 이미 찾은 동은 다시 부르지 않는다. 못 찾은 코드는 빠진다(화면은 코드로 대신 표시)
 */
export async function loadDongNames(pairs) {
  const todo = pairs.filter(([c]) => !nameCache[c]);
  const [withIndustry, withoutIndustry] = [todo.filter(([, ic]) => ic), todo.filter(([, ic]) => !ic).map(([c]) => c)];
  const [a, b] = await Promise.all([namesFromPredictions(withIndustry), namesFromLists(withoutIndustry)]);
  Object.assign(nameCache, b, a);
  return Object.fromEntries(pairs.map(([c]) => [c, nameCache[c]]).filter(([, v]) => v));
}
