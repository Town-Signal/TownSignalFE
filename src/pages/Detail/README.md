# 상세 분석 (`/dong/:dong_code?industry_code=&from=rec|search`)

한 행정동의 예측·성장세·예산 여유·임대료·업종 분포·매출 추이·유동 인구를 보여 줍니다(명세 10.5).

- 파일: `Detail.jsx`, `LegacyDongRedirect.jsx`, `SalesTrend.jsx`, `FootTraffic.jsx`, `Detail.css`
- 입력: 경로의 dong_code(8자리), `industry_code`(없으면 ts-cond → ts-last의 업종), `from`(뒤로가기 목적지)
- API: ⑪ 상권 현황 · ⑫ 예측 · ⑬ 요약을 병렬로, ts-last에 rec_id가 있으면 ⑥ 예산 여유. 업종 이름은 ⑩(`lib/masters`)
- 상태: 전역 `favs`(아직 동 이름 기준 — F4), `last`, `cond` / 차트 내부의 hover, 연령대 펼침

## 요소

| 영역 | 데이터 | 예외 |
|---|---|---|
| 상단 | 동명 · 구명(⑪), 업종명(⑩), 주거지역 배지(⑫ data_status "표본 부족"), 추천 배지(from=rec 또는 ts-last.top에 이 동), 종합점수(⑫ total_score), ♡ | 점수 없음 → — |
| AI 요약 | ⑬ summary_text, "자동 생성된 요약이에요" | null이면 영역 숨김 |
| 예상 생존 · 월매출 | ⑫ 중앙값 + 80% 범위(p10~p90), 월매출은 sales_monthly_* | 업종 없음 → "업종을 고르면 예측을 볼 수 있어요", "예측 불가" → 안내 |
| 성장세 | ⑪ growth | 값 없음 → "정보 없음", 신뢰도 낮음 배지 |
| 예산 여유 | ⑥ budget_margin(만 원), 가용 예산 − 추정 초기 임대비용 | rec_id 없음 → "추천을 거치면 표시돼요", null(도봉구) → "정보 없음", 음수 → "예산 부족" |
| 임대료 | ⑪ rent.monthly_rent(만 원/월) + basis | null → "정보 없음", confidence 낮음 → 배지 |
| 업종 분포 | ⑪ total_store_count + industry_distribution 비율 막대, 선택 업종 강조 | 없음 → "조회 불가"(상권분석 대상 아님) 또는 "데이터 없음" |
| 최근 매출 추이 | ⑪ sales_trend 8분기 막대(per_store_monthly_amount), 최고 분기 강조, 2024Q1 상권 기준 변경 경계선 | 빠진 분기 → 빈 막대, 전체 없음 → "조회 불가" |
| 유동 인구 | ⑪ population_latest — 시간대 6구간(피크 강조) · 성별 비율 · 연령대(펼침) | 없음 → "데이터 없음" |
| 하단 | 면책 문구, 상권 지표 · 임대료 기준 분기 | |

## 예외

- 없는 dong_code(⑪ DONG_NOT_FOUND) → "찾을 수 없는 동네예요" + [직접 찾아보기].
- 예전 주소 `/dong/{동 이름}` → ⑦로 찾아 이름이 같은 동이 1곳이면 새 주소로, 아니면 직접 찾아보기 `?q=`(가정).
