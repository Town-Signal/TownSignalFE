# TownSignalFE

타운시그널의 프론트엔드. 서울 청년 예비창업자가 조건을 입력하면 받을 수 있는 지원금으로 자치구별 가용 예산을 계산하고, 감당 가능한 창업 후보 행정동을 추천하는 웹 서비스다.

서버(API · 배치)는 [TownSignalServer](https://github.com/Town-Signal/TownSignalServer)에 따로 있다. 프론트와 서버는 코드가 아니라 API 명세로만 엮인다.

## 화면

| 화면 | 경로 | 내용 | API |
| --- | --- | --- | --- |
| 대시보드 | `/` | 최근 추천 결과, 관심 창업지, 마감 임박 지원사업 공고 | ① ⑤ ⑫ |
| 조건으로 추천받기 | `/recommend` | 조건 입력 → 자치구별 가용 예산 → 추천 행정동 (3단계) | ⑩ ⑰ ② ③ ④ ⑤ |
| 직접 찾아보기 | `/search` | 행정동 검색, 업종별 랭킹 지도 | ⑦ ⑧ ⑨ ⑩ ⑫ ⑱ |
| 상권 상세 | `/dong/{dong_code}?industry_code=` | 예상 생존 · 월매출(80% 범위), 성장세, 예산 여유, 임대료, 업종 분포, 매출 추이, 유동 인구 | ⑪ ⑫ ⑬ ⑥ |
| 상권 비교 | `/compare` | 관심 동네 1~4곳 나란히 비교 | ⑭ |

## 기술 스택

React 18 · JavaScript(JSX) · Vite 6 · react-router-dom 6 · Leaflet(OpenStreetMap 타일) · d3-geo(자치구 벡터 지도) · ESLint 9.
전역 상태는 React Context, API 호출은 `fetch`(`src/lib/api.js`), 사용자 기록은 localStorage. 차트는 라이브러리 없이 직접 그린다(Recharts 없음).

## 로컬에서 실행하기

1. **서버를 먼저 띄운다.** TownSignalServer README의 로컬 실행법대로 DB를 준비하고 API를 8000 포트로 실행한다(`uvicorn api.main:app --port 8000`). 화면을 끝까지 보려면 서버 쪽 더미 데이터 적재가 필요하다.
2. 프론트 의존성을 설치하고 개발 서버를 띄운다.

   ```bash
   npm install
   npm run dev        # http://localhost:5173
   ```

3. 프론트는 항상 같은 출처 상대 경로 `/api/...`만 부른다. 개발 서버에서는 `vite.config.js`의 프록시가 `/api` · `/health`를 `http://localhost:8000`으로 넘긴다. 서버가 꺼져 있으면 화면마다 "다시 시도" 오류 안내가 나온다.
4. 확인 명령

   ```bash
   npm run lint
   npm run build      # dist/
   ```

운영(Vercel)에서는 `vercel.json`의 rewrites가 `/api/*`를 API 서버로 넘기고, 그 밖의 경로는 `index.html`로 보낸다(새로고침 대응). API 서버 주소는 아직 자리표시(`TODO-EC2-HOST`)다.

## 원칙

- 계산 로직을 두지 않는다. 예산 · 점수 · 예측은 모두 서버 값을 표시만 한다(정렬 탭 재정렬만 예외).
- 로그인이 없다. 사용자 기록은 브라우저 localStorage에만 둔다 — `ts-favs`(관심 dong_code 목록) · `ts-fav-sub`(동별 업종 코드) · `ts-cond`(최근 입력 조건) · `ts-last`(최근 추천 rec_id와 요약).
- 예측 수치는 중앙값과 80% 범위를 함께 보여주고, 결측은 0이 아니라 "정보 없음" · "예측 불가"로 표시한다.
- 모든 API 응답은 공통 봉투(`status` · `code` · `message` · `data` · `errors` · `warnings` · `meta`)로 온다. 해석은 `src/lib/api.js`, 오류 안내는 `src/lib/errors.js` · `src/hooks/useApiError.js`.
- 지도 경계(`public/geo`, 2013년 통계청 코드)와는 서버가 내려주는 `geo_code`로 잇는다.

API · 화면 규격은 「타운시그널 전체 명세」 v2.0(8장 API, 10장 화면)과 화면명세서 v0.3을 따른다.

## 커밋 규칙

- 커밋: `<Type>(<Scope>): <Subject>` / PR 제목: `<Type>: <Subject>`
- Type: feat · fix · docs · style · refactor · chore · todo
- 제목은 명령조로 쓰고 날짜는 적지 않는다.
