// 지원사업 일정 표시용 날짜 계산 — 대시보드 '청년 창업 지원 일정'(①)이 쓴다. 서버 값은 바꾸지 않는다.

/** 오늘의 한국 시간(KST) 연 · 월 */
function kstYearMonth(today) {
  // en-CA 형식은 'YYYY-MM-DD'
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(today).split('-').map(Number);
  return [y, m];
}

// TODO(가정): 공고가 매년 같은 달에 다시 열린다고 가정한 표시용 계산. 발표 뒤 서버 ① 응답 필드로 옮길지 결정.
/**
 * 마감된 ① 공고의 다음 모집 예상 연 · 월.
 * 기준 월은 apply_start의 월(없으면 apply_end의 월). 그 달이 이번 달보다 뒤면 올해, 아니면(같은 달 포함) 내년.
 * @param {{ status?: string, apply_start?: string|null, apply_end?: string|null }} p ① 응답 항목
 * @param {Date} [today]
 * @returns {{ year: number, month: number } | null} 모집 중이거나 날짜가 없으면 null
 */
export function nextExpectedMonth(p, today = new Date()) {
  if (p.status === '모집 중') return null;
  const base = p.apply_start ?? p.apply_end;
  if (!base) return null;
  const month = Number(base.slice(5, 7));
  const [y, m] = kstYearMonth(today);
  return { year: month > m ? y : y + 1, month };
}

/**
 * 다음 모집 예상 칩 문구 — 예상 연도가 오늘(KST) 연도와 같으면 '올해 예상', 크면 '내년 예상'.
 * @param {{ year: number } | null} next nextExpectedMonth 결과
 * @param {Date} [today]
 * @returns {'올해 예상' | '내년 예상' | null} next가 없으면 null
 */
export function expectedYearLabel(next, today = new Date()) {
  if (!next) return null;
  return next.year > kstYearMonth(today)[0] ? '내년 예상' : '올해 예상';
}
