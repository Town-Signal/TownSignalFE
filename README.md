# TownSignalFE

타운시그널의 프론트엔드. 서울 청년 예비창업자가 조건을 입력하면, 받을 수 있는 지원금으로 자치구별 가용 예산을 계산하고 창업 후보 행정동을 추천한다.

- 서비스: https://town-signal.vercel.app (main에 머지하면 Vercel이 자동 배포)
- 서버(API · 배치): [TownSignalServer](https://github.com/Town-Signal/TownSignalServer). 프론트와 서버는 API로만 엮인다

## 화면

| 화면 | 경로 | 내용 |
| --- | --- | --- |
| 대시보드 | `/` | 최근 추천, 관심 창업지, 마감 임박 지원사업 |
| 조건으로 추천받기 | `/recommend` | 조건 입력 → 자치구별 가용 예산 → 추천 행정동 |
| 직접 찾아보기 | `/search` | 행정동 검색, 업종별 랭킹 지도 |
| 상권 상세 | `/dong/{dong_code}?industry_code=` | 예상 매출 · 생존(80% 범위), 성장세, 예산 여유, 매출 추이 등 |
| 상권 비교 | `/compare` | 관심 동네 1~4곳 비교 |

React 18 · JavaScript(JSX) · Vite 6 · react-router-dom 6 · Leaflet · d3-geo. 상태는 React Context, 사용자 기록은 localStorage.

## 로컬 실행

1. 서버를 먼저 8000 포트로 띄운다 — TownSignalServer README의 "로컬 실행"(더미 데이터 적재까지 하면 화면이 끝까지 보인다).
2. 프론트를 띄운다.

```bash
npm install
npm run dev        # http://localhost:5173
npm run lint && npm run build
```

API는 항상 상대 경로 `/api/...`로 부른다. 넘겨주는 곳만 다르다.

| 환경 | `/api/*`를 넘기는 곳 |
| --- | --- |
| 로컬 | `vite.config.js` 프록시 → `http://localhost:8000` |
| 운영 | `vercel.json` rewrites → AWS EC2 API |

## 원칙

- 계산하지 않는다. 예산 · 점수 · 예측은 서버 값을 보여주기만 한다(정렬 탭 재정렬만 예외).
- 로그인이 없다. 관심 동네 · 최근 조건 · 최근 추천은 localStorage(`ts-favs` · `ts-fav-sub` · `ts-cond` · `ts-last`)에 둔다.
- 결측은 0이 아니라 "정보 없음" · "예측 불가"로 표시한다.
- API 응답은 공통 봉투(`status` · `code` · `data` · `errors` …)로 온다. 해석은 `src/lib/api.js`, 오류 안내는 `src/lib/errors.js`.
- 화면 · API 규격은 노션 「타운시그널 전체 명세」와 화면명세서를 따른다.

## 커밋 규칙

- 커밋 `<Type>(<Scope>): <Subject>` · PR 제목 `<Type>: <Subject>`
- Type: feat · fix · docs · style · refactor · chore · todo. 제목은 명령조, 날짜는 적지 않는다.
