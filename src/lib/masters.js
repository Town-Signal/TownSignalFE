// ⑩ 업종 · ⑰ 자격증 목록은 앱에서 한 번만 받아 모듈 안에 둔다(명세 8.6 ⑰). 실패하면 다음 호출 때 다시 받는다.
import { api } from './api';

let mastersPromise = null;

/** { industries: ⑩ items, certificates: ⑰ items } */
export function loadMasters() {
  mastersPromise ??= Promise.all([api('/regions/industries'), api('/certificates')])
    .then(([industries, certificates]) => ({ industries: industries.data.items, certificates: certificates.data.items }))
    .catch((e) => { mastersPromise = null; throw e; });
  return mastersPromise;
}

let districtsPromise = null;

/** ⑧ 자치구 목록 [{ district_code, name }] — 1단계 '거주 구' 선택 칸 · lib/dongNames가 같이 쓴다. ⑩ · ⑰과 따로 받아, 실패해도 1단계를 막지 않는다 */
export function loadDistricts() {
  districtsPromise ??= api('/regions/districts')
    .then((json) => json.data.items)
    .catch((e) => { districtsPromise = null; throw e; });
  return districtsPromise;
}

// 서울시 추정매출(OA-22175)에 2021~2025 내내 없는 업종 37개(노승민 11/11 · 노션 15) — 점포 데이터에는 있다.
// shortcut: ⑩ 응답에 매출 유무 값이 없어 프론트에 목록을 둔다, 서버가 그 값을 주면 이 목록을 지운다.
const NO_SALES = new Set([
  'CS200004', 'CS200009', 'CS200010', 'CS200011', 'CS200012', 'CS200013', 'CS200014', 'CS200015', 'CS200018', 'CS200020',
  'CS200021', 'CS200022', 'CS200023', 'CS200027', 'CS200035', 'CS200038', 'CS200039', 'CS200040', 'CS200041', 'CS200042',
  'CS200043', 'CS200044', 'CS200045', 'CS200046', 'CS200047',
  'CS300005', 'CS300012', 'CS300013', 'CS300023', 'CS300030', 'CS300034', 'CS300037', 'CS300038', 'CS300039', 'CS300040',
  'CS300041', 'CS300042',
]);
/** 매출 데이터가 있는 업종인지(추천 업종 선택에서는 없는 업종을 숨긴다) */
export const hasSales = (code) => !NO_SALES.has(code);

/** ⑩ 목록에서 업종 코드 → 업종 행. 없으면 null */
export const findIndustry = (industries, code) => industries?.find((i) => i.industry_code === code) ?? null;

/** ⑩ 목록 → { 대분류: [{ code, name }] } (서버 순서: 외식업 → 서비스업 → 소매업 → 이름) */
export const groupIndustries = (items) => items.reduce((acc, i) => {
  (acc[i.category] ??= []).push({ code: i.industry_code, name: i.name });
  return acc;
}, {});
