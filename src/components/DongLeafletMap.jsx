import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './maps.css';
import { loadDongCenters, loadDongGeo, loadGuGeo } from '../lib/geo';
import { errorKind } from '../lib/errors';
import { REDUCED_MOTION } from '../hooks/useMediaQuery';
import { relaxPins } from './pinLayout';
import { MapMsg } from './ui';

const PRI = 'oklch(0.47 0.17 262)';
const DEEP = 'oklch(0.32 0.12 262)';
const isDesktop = () => window.innerWidth >= 900;
// 모바일은 하단 시트가 지도 아래쪽을 가리므로 그만큼 비워 두고 맞춘다
const bottomPad = () => (isDesktop() ? 0 : Math.round(window.innerHeight * 0.28));
const reduceMotion = () => window.matchMedia(REDUCED_MOTION).matches;
/** 레이어 · pane이 서서히 나타나게(Web Animations — CSS 규칙이 닿지 않아 동작 줄이기를 직접 확인) */
const fadeIn = (el, delay = 0) => { if (el && !reduceMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay, easing: 'ease-out', fill: 'backwards' }); };

/**
 * 지도가 움직인 뒤(moveend) 핀을 다시 그린다. enter면 움직이는 동안 핀을 숨겼다가 멈추면 차례로 나타나게, pop이면 그 핀만 한 번 톡.
 * fit · fly를 부르기 전에 걸어야 한다(움직임이 없으면 moveend가 그 자리에서 바로 오기도 한다). moveend가 안 와도 0.9초 뒤 그린다
 */
function afterMove(c, opts) {
  c.hidePins = !!opts.enter;
  const done = () => {
    if (c.moveDone !== done) return;
    c.moveDone = null;
    c.hidePins = false;
    renderPins(c, opts);
  };
  c.moveDone = done;
  c.map.once('moveend', done);
  setTimeout(done, 900);
}

/**
 * 실제 지도(OSM 타일) 위에 구/동 경계와 순위 핀을 올린다 (직접찾기 · 추천 3단계).
 * 경계와는 이름이 아니라 geo_code(2013 통계청 코드 — 구 5자리 · 동 7자리)로 잇는다(명세 10.8).
 * passGus: Set<구 geo_code>(옅게 채울 구) · selGu: 동 경계까지 보여줄 구 geo_code
 * pins: [{ key: dong_code, geo, name, gu, score, rank, sel }] — geo가 없는 핀은 그리지 않는다.
 *   순위 10위까지는 라벨 핀, 나머지는 점
 * fills: { [동 geo_code]: { color, key } } — 동 경계 색칠(직접찾기). 누르면 onPickDong(key)
 * padLeft: 데스크톱에서 지도 왼쪽을 가리는 패널 폭
 */
const NO_PASS = new Set();
export default function DongLeafletMap({ passGus = NO_PASS, selGu, pins, fills, padLeft = 0, onPickDong, onPickGu }) {
  const elRef = useRef(null);
  const ctx = useRef(null);
  const handlers = useRef({});
  const [status, setStatus] = useState('loading');
  const [tries, setTries] = useState(0);

  useEffect(() => { handlers.current = { onPickDong, onPickGu }; });

  useEffect(() => {
    const map = L.map(elRef.current, { zoomControl: false, minZoom: 10, maxZoom: 17, zoomSnap: 0.25, wheelPxPerZoomLevel: 90 })
      .setView([37.5665, 126.978], 11);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19, keepBuffer: 4, updateWhenZooming: false,
    }).addTo(map);
    map.createPane('guPane').style.zIndex = 350;
    map.createPane('dongPane').style.zIndex = 360;
    const pinPane = map.createPane('pinPane');
    pinPane.style.zIndex = 650;

    map.createPane('fillPane').style.zIndex = 355;
    const c = { map, pinPane, pins: [], fitKey: '', lastSel: '', dongCenter: {}, handlers };
    ctx.current = c;

    const relayout = () => renderPins(c);
    map.on('zoomend moveend', relayout);
    map.on('zoomstart', () => { pinPane.style.transition = 'opacity .1s'; pinPane.style.opacity = '0.5'; });
    map.on('zoomend', () => { pinPane.style.opacity = '1'; });
    // 패널 접힘·회전 등 컨테이너 크기 변화
    const ro = new ResizeObserver(() => { map.invalidateSize(); relayout(); });
    ro.observe(elRef.current);

    return () => { ro.disconnect(); map.remove(); ctx.current = null; };
  }, []);

  useEffect(() => {
    const c = ctx.current;
    let alive = true;
    Promise.all([loadGuGeo(), loadDongGeo(), loadDongCenters()]).then(([gu, dong, centers]) => {
      if (!alive) return;
      c.gu = gu;
      c.dong = dong;
      // 중심점은 lib/geo에서 한 번만 계산해 둔 것을 쓴다(동마다 Leaflet 레이어를 만들어 구하지 않는다)
      c.dongCenter = Object.fromEntries(Object.entries(centers).map(([k, [x, y]]) => [k, L.latLng(y, x)]));
      c.guLayer = L.geoJSON(gu, {
        pane: 'guPane',
        onEachFeature: (f, layer) => {
          layer.on('click', () => handlers.current.onPickGu?.(String(f.properties.code)));
          layer.bindTooltip(esc(f.properties.name), { permanent: true, direction: 'center', className: 'gu-label' });
        },
      }).addTo(c.map);
      setStatus('ready');
    }, (e) => alive && setStatus(errorKind(e)));
    return () => { alive = false; };
  }, [tries]);

  useEffect(() => {
    if (status === 'ready') draw(ctx.current, { passGus, selGu, pins, fills, padLeft });
  }, [status, passGus, selGu, pins, fills, padLeft]);

  return (
    <div className="dong-map">
      <div ref={elRef} className="leaflet-host" style={{ width: '100%', height: '100%' }} />
      {status !== 'ready' && (
        <MapMsg error={status === 'loading' ? null : status} onRetry={() => { setStatus('loading'); setTries((n) => n + 1); }} />
      )}
    </div>
  );
}

const codeOf = (f) => String(f.properties.code);

/** 동 경계 색칠 레이어. fills가 바뀔 때만 다시 만든다 */
function drawFills(c, fills) {
  if (fills === c.lastFills) return;
  c.lastFills = fills;
  if (c.fillLayer) { c.map.removeLayer(c.fillLayer); c.fillLayer = null; }
  if (!fills || !c.dong) return;
  fadeIn(c.map.getPane('fillPane')); // 업종이 바뀌면 색이 서서히 바뀌어 나타난다
  c.fillLayer = L.geoJSON(c.dong, {
    pane: 'fillPane',
    style: (f) => {
      const v = fills[codeOf(f)];
      return { color: '#fff', weight: 0.6, fillColor: v?.color ?? 'oklch(0.9 0.004 262)', fillOpacity: v ? 0.62 : 0.25 };
    },
    onEachFeature: (f, layer) => {
      const v = fills[codeOf(f)];
      if (v?.key) layer.on('click', () => c.handlers.current.onPickDong?.(v.key));
      layer.bindTooltip(esc(v?.tip ?? f.properties.name), { sticky: true, className: 'dong-tip' });
    },
  }).addTo(c.map);
}

function draw(c, { passGus, selGu, pins: pinData, fills, padLeft }) {
  const { map } = c;
  const left = isDesktop() ? padLeft : 0;

  c.guLayer.setStyle((f) => {
    const code = codeOf(f);
    const sel = code === selGu;
    const pass = passGus.has(code);
    return {
      color: sel ? PRI : 'oklch(0.55 0.03 262)', weight: sel ? 2.5 : 0.8, dashArray: sel ? null : '3 3',
      fillColor: pass ? 'oklch(0.8 0.08 262)' : '#fff', fillOpacity: pass ? 0.18 : 0,
    };
  });
  c.guLayer.eachLayer((layer) => {
    const el = layer.getTooltip()?.getElement();
    if (el) el.style.opacity = codeOf(layer.feature) === selGu ? 1 : 0.55;
  });

  // 선택된 구 안의 동 경계
  if (c.dongLayer) { map.removeLayer(c.dongLayer); c.dongLayer = null; }
  drawFills(c, fills);
  const guFeature = c.gu.features.find((f) => codeOf(f) === selGu);
  if (c.dong && guFeature) {
    const code = codeOf(guFeature);
    c.dongLayer = L.geoJSON(
      { type: 'FeatureCollection', features: c.dong.features.filter((f) => String(f.properties.code).slice(0, 5) === code) },
      { pane: 'dongPane', interactive: false, style: { color: PRI, weight: 0.8, opacity: 0.45, fill: false } },
    ).addTo(map);
  }

  const pins = pinData
    .map((p) => ({ ...p, ll: p.geo ? c.dongCenter[p.geo] : null, top: !!p.rank && p.rank <= 10 }))
    .filter((p) => p.ll); // 경계가 없는 동(geo_code null · 2013년 이후 신설)은 지도에서 뺀다
  pins.forEach((p) => {
    if (!p.top) return;
    p.t = (11 - p.rank) / 10;
    p.R = p.sel ? 50 : Math.round(24 + p.t * 22);
    p.podium = p.rank <= 3;
  });
  // 그리는 순서: 일반 → 상위 → 선택 (뒤에 그린 것이 위로)
  pins.sort((a, b) => (a.sel - b.sel) || (a.top - b.top) || ((b.rank || 99) - (a.rank || 99)));
  c.pins = pins;

  const selPin = pins.find((p) => p.sel);
  const pinBounds = () => L.latLngBounds(pins.map((p) => p.ll)).pad(0.15);

  // 핀 구성이 바뀌면 화면을 다시 맞추고(처음엔 서울 전체, 이후엔 핀 범위) 새 핀이 차례로 나타난다
  let enter = false;
  const key = pins.map((p) => p.key).sort().join(',');
  if (key !== c.fitKey) {
    if (pins.length && !selPin) {
      map.invalidateSize();
      if (!c.fitKey) {
        map.fitBounds(c.guLayer.getBounds(), { paddingTopLeft: [left + 8, 8], paddingBottomRight: [8, 8], animate: false });
        enter = true; // 움직임 없이 바로 맞추므로 이번에 그리면서 나타나게
      } else {
        afterMove(c, { enter: true }); // 이동하는 동안 숨겼다가 멈추면 나타나게
        map.fitBounds(pinBounds(), { paddingTopLeft: [left, 0], paddingBottomRight: [0, bottomPad()], maxZoom: 13 });
      }
    } else enter = pins.length > 0; // 동을 고른 채 업종을 바꾼 경우 — 이동 없이 그 자리에서
    c.fitKey = key;
  }

  // 선택이 바뀌면 그 동으로 날아가고 경계를 강조한다
  const selKey = selPin ? selPin.key : '';
  if (selKey !== c.lastSel) {
    if (c.focusLayer) { map.removeLayer(c.focusLayer); c.focusLayer = null; }
    if (selPin) {
      const feature = c.dong?.features.find((f) => codeOf(f) === selPin.geo);
      const bounds = feature ? L.geoJSON(feature).getBounds() : L.latLngBounds([selPin.ll, selPin.ll]);
      afterMove(c, { pop: selPin.key }); // 날아간 뒤 고른 핀이 한 번 톡
      map.flyToBounds(bounds, { paddingTopLeft: [left + 60, 60], paddingBottomRight: [60, bottomPad() + 60], maxZoom: 15, duration: 0.45, easeLinearity: 0.5 });
      if (feature) {
        c.focusLayer = L.geoJSON(feature, { pane: 'dongPane', interactive: false, style: { color: PRI, weight: 2.5, fillColor: PRI, fillOpacity: 0.12 } }).addTo(map);
        c.focusLayer.eachLayer((l) => fadeIn(l.getElement(), 300)); // 날아가는 동안 기다렸다가 경계가 서서히
      }
    } else if (pins.length) {
      map.flyToBounds(pinBounds(), { paddingTopLeft: [left, 0], paddingBottomRight: [0, bottomPad()], maxZoom: 13, duration: 0.4, easeLinearity: 0.5 });
    }
    c.lastSel = selKey;
  }

  renderPins(c, { enter });
}

// 핀 · 툴팁은 문자열 HTML로 그리므로 API에서 온 글자(동 이름 · 점수 · 툴팁)는 꼭 이스케이프한다(데이터에 태그가 섞여도 실행되지 않게)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function pinHtml(p) {
  const name = esc(p.name);
  const score = esc(p.score);
  if (!p.top) {
    return p.sel
      ? `<div class="dot" style="width:32px;height:32px;background:${PRI};color:#fff;border-color:${PRI};font-size:11px">${score}</div><div class="in" style="top:-30px"><div class="nm" style="background:${DEEP};color:#fff">${name}</div></div>`
      : `<div class="dot">${score}</div>`;
  }
  const alpha = p.sel ? 0.3 : (0.06 + p.t * 0.22).toFixed(3);
  const filled = p.sel || p.podium;
  const light = !filled;
  const halo =
    (p.podium && !p.sel ? `<div class="halo" style="width:${(p.R + 7) * 2}px;height:${(p.R + 7) * 2}px;border:1px dashed oklch(0.47 0.17 262 / 0.35)"></div>` : '') +
    `<div class="halo" style="width:${p.R * 2}px;height:${p.R * 2}px;background:oklch(0.47 0.17 262 / ${alpha});border:${p.sel ? 2 : p.podium ? 1.4 : 1}px solid ${filled ? PRI : 'oklch(0.47 0.17 262 / 0.3)'}"></div>`;
  if (p.collapsed) return `${halo}<div class="in"><div class="rank" style="background:${PRI};color:#fff">${p.rank}</div></div>`;
  return `${halo}<div class="in">` +
    `<div class="rank" style="${p.rank === 1 ? 'min-width:30px;height:26px;font-size:15px;' : ''}background:${filled ? (p.sel ? DEEP : PRI) : '#fff'};color:${filled ? '#fff' : PRI}">${p.rank}</div>` +
    `<div class="nm" style="background:${p.sel ? DEEP : light ? '#fff' : PRI};color:${light ? PRI : '#fff'};${light ? 'box-shadow:0 1px 3px oklch(0.3 0.03 262 / 0.25);border:1px solid oklch(0.47 0.17 262 / 0.45)' : ''}">${name}</div>` +
    `<div class="sc">${score}${p.score === '—' ? '' : '점'}</div></div>`;
}

// 핀은 수가 적고 줌/이동마다 통째로 다시 배치해야 해서 Leaflet 마커 대신 pane에 직접 그린다.
// 그래서 등장 애니메이션은 enter · pop을 받은 그 한 번만 붙인다(끌거나 확대할 때마다 다시 재생되지 않게)
function renderPins(c, { enter = false, pop = null } = {}) {
  const { map, pinPane, pins } = c;
  pinPane.replaceChildren();
  if (!pins.length || c.hidePins) return;
  const k = window.innerWidth < 480 ? 0.82 : 1;
  pins.forEach((p) => {
    const pt = map.latLngToLayerPoint(p.ll);
    p.ox = p.x = pt.x;
    p.oy = p.y = pt.y;
  });
  relaxPins(pins.filter((p) => p.top), k);

  const frag = document.createDocumentFragment();
  pins.forEach((p) => {
    const wrap = document.createElement('div');
    wrap.className = `pin-w ${enter ? 'enter' : ''}`;
    // 1위부터 차례로(45ms 간격), 순위 밖 점은 그 뒤에 한꺼번에
    if (enter) wrap.style.setProperty('--d', `${p.top ? (p.rank - 1) * 45 : 480}ms`);
    wrap.style.transform = `translate(${p.ox}px,${p.oy}px)`;
    const dx = p.x - p.ox, dy = p.y - p.oy, dist = Math.hypot(dx, dy);
    // 라벨이 원래 위치에서 밀려났으면 지시선으로 잇는다
    if (p.top && dist > 6) {
      wrap.insertAdjacentHTML('beforeend', `<div class="pin-ld" style="width:${dist}px;transform:rotate(${Math.atan2(dy, dx)}rad)"></div><div class="pin-ldot"></div>`);
    }
    const marker = document.createElement('div');
    marker.className = `pin-mk ${pop === p.key ? 'pop' : ''}`;
    marker.style.transform = `translate(${dx}px,${dy}px) scale(${k})`;
    marker.title = `${p.name} · ${p.gu} · ${p.score}점`;
    marker.innerHTML = pinHtml(p);
    marker.addEventListener('click', (e) => { e.stopPropagation(); c.handlers.current.onPickDong?.(p.key); });
    wrap.appendChild(marker);
    frag.appendChild(wrap);
  });
  pinPane.appendChild(frag);
}
