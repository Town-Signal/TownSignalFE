# TownSignalFE

타운시그널의 프론트엔드. 서울 청년 예비창업자가 조건을 입력하면 받을 수 있는 지원금으로 자치구별 가용 예산을 계산하고, 감당 가능한 창업 후보 행정동을 추천하는 웹 서비스다.

서버(API · 배치)는 [TownSignalServer](https://github.com/Town-Signal/TownSignalServer)에 따로 있다. 프론트와 서버는 코드가 아니라 API 명세로만 엮인다.

## 화면

| 화면 | 경로 | 내용 |
| --- | --- | --- |
| 대시보드 | `/` | 최근 추천 결과, 관심 창업지, 마감 임박 지원사업 공고 |
| 조건으로 추천받기 | `/recommend` | 조건 입력 → 자치구별 가용 예산 → 추천 행정동 (3단계) |
| 직접 찾아보기 | `/search` | 행정동 검색, 업종별 랭킹 지도 |
| 상권 상세 | `/dong/{dong_code}` | 예상 생존 · 월매출(80% 구간), 성장세, 예산 여유, 임대료, 업종 분포, 유동 인구 |
| 상권 비교 | `/compare` | 관심 동네 1~4곳 나란히 비교 |

## 기술 스택

React 18 · JavaScript(JSX) · Vite 5 · react-router-dom 6 · Recharts · Leaflet(OpenStreetMap). 전역 상태는 React Context, 사용자 기록은 localStorage.

## 원칙

- 계산 로직을 두지 않는다. 예산 · 점수 · 예측은 모두 서버 값을 표시만 한다.
- 로그인이 없다. 최근 추천 · 관심 동네 · 최근 입력 조건은 브라우저 localStorage에 저장한다(`ts-favs` · `ts-cond` · `ts-last`).
- 예측 수치는 항상 중앙값과 80% 구간을 함께 보여주고, 결측은 0이 아니라 "정보 없음"으로 표시한다.
- 모든 API 응답은 공통 봉투(`status` · `code` · `message` · `data` · `errors` · `warnings` · `meta`)로 온다.

API · 화면 규격은 「타운시그널 전체 명세」 v1.6(8장 API, 10장 화면)과 화면명세서 v0.2를 따른다.

## 커밋 규칙

- 커밋: `<Type>(<Scope>): <Subject>` / PR 제목: `<Type>: <Subject>`
- Type: feat · fix · docs · style · refactor · chore · todo
- 제목은 명령조로 쓰고 날짜는 적지 않는다.
