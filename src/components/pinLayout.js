/**
 * 상위 핀 라벨이 서로 겹치지 않게 밀어낸다.
 * 입력 핀: { x, y, ox, oy, name, rank, sel } (ox/oy = 원래 위치). x/y와 collapsed를 제자리에서 갱신한다.
 * 밀어내도 겹치면 순위가 낮은 쪽을 순위 배지만 남기고 접는다(collapsed).
 */
export function relaxPins(tops, k) {
  const box = (p) => (p.collapsed ? { w: 30 * k, h: 30 * k } : { w: (p.name.length * 12.5 + 22) * k, h: 76 * k });

  const relax = (iterations) => {
    for (let it = 0; it < iterations; it++) {
      for (let i = 0; i < tops.length; i++) {
        for (let j = i + 1; j < tops.length; j++) {
          const a = tops[i], b = tops[j], A = box(a), B = box(b);
          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = (A.w + B.w) / 2 + 4 - Math.abs(dx);
          const oy = (A.h + B.h) / 2 + 4 - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          // 선택된 핀·순위 높은 핀일수록 덜 움직인다
          const wa = a.sel ? 0.15 : b.sel ? 0.85 : a.rank < b.rank ? 0.3 : 0.7;
          const wb = 1 - wa;
          if (ox < oy) { const sx = dx >= 0 ? 1 : -1; a.x -= sx * ox * wa; b.x += sx * ox * wb; }
          else { const sy = dy >= 0 ? 1 : -1; a.y -= sy * oy * wa; b.y += sy * oy * wb; }
        }
      }
      tops.forEach((p) => { p.x += (p.ox - p.x) * 0.015; p.y += (p.oy - p.y) * 0.015; });
    }
  };
  const overlaps = (a, b) => {
    const A = box(a), B = box(b);
    return Math.abs(b.x - a.x) < (A.w + B.w) / 2 && Math.abs(b.y - a.y) < (A.h + B.h) / 2;
  };

  tops.forEach((p) => { p.collapsed = false; });
  relax(160);
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let i = 0; i < tops.length; i++) {
      for (let j = i + 1; j < tops.length; j++) {
        const a = tops[i], b = tops[j];
        if (!overlaps(a, b)) continue;
        const lower = a.sel ? b : b.sel ? a : a.rank > b.rank ? a : b;
        if (!lower.collapsed && !lower.sel) { lower.collapsed = true; changed = true; }
      }
    }
    if (!changed) break;
    relax(80);
  }
}
