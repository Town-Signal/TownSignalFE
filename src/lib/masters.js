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

/** ⑩ 목록에서 업종 코드 → 업종 행. 없으면 null */
export const findIndustry = (industries, code) => industries?.find((i) => i.industry_code === code) ?? null;

/** ⑩ 목록 → { 대분류: [{ code, name }] } (서버 순서: 외식업 → 서비스업 → 소매업 → 이름) */
export const groupIndustries = (items) => items.reduce((acc, i) => {
  (acc[i.category] ??= []).push({ code: i.industry_code, name: i.name });
  return acc;
}, {});
