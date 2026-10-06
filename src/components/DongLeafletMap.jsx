import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './maps.css';
import { loadDongGeo, loadGuGeo } from '../lib/geo';
import { errorKind } from '../lib/errors';
import { relaxPins } from './pinLayout';
import { MapMsg } from './ui';

const PRI = 'oklch(0.47 0.17 262)';
const DEEP = 'oklch(0.32 0.12 262)';
const isDesktop = () => window.innerWidth >= 900;
// 모바일은 하단 시트가 지도 아래쪽을 가리므로 그만큼 비워 두고 맞춘다
const bottomPad = () => (isDesktop() ? 0 : Math.round(window.innerHeight * 0.28));

/**
 * 실제 지도(OSM 타일) 위에 구/동 경계와 순위 핀을 올린다 (직접찾기 · 추천 3단계).
 * passGus: Set<구>(옅게 채울 구) · selGu: 동 경계까지 보여줄 구
 * pins: [{ name, gu, score, rank, sel }] — 순위 10위까지는 라벨 핀, 나머지는 점
 * padLeft: 데스크톱에서 지도 왼쪽을 가리는 패널 폭
 */
export default function DongLeafletMap({ passGus, selGu, pins, padLeft = 0, onPickDong, onPickGu }) {
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
    Promise.all([loadGuGeo(), loadDongGeo()]).then(([gu, dong]) => {
      if (!alive) return;
      c.gu = gu;
      c.dong = dong;
      dong?.features.forEach((f) => { c.dongCenter[f.properties.name] = L.geoJSON(f).getBounds().getCenter(); });
      c.guLayer = L.geoJSON(gu, {
        pane: 'guPane',
        onEachFeature: (f, layer) => {
          layer.on('click', () => handlers.current.onPickGu?.(f.properties.name));
          layer.bindTooltip(f.properties.name, { permanent: true, direction: 'center', className: 'gu-label' });
        },
      }).addTo(c.map);
      setStatus('ready');
    }, (e) => alive && setStatus(errorKind(e)));
    return () => { alive = false; };
  }, [tries]);

  useEffect(() => {
    if (status === 'ready') draw(ctx.current, { passGus, selGu, pins, padLeft });
  }, [status, passGus, selGu, pins, padLeft]);

  return (
    <div className="dong-map">
      <div ref={elRef} className="leaflet-host" style={{ width: '100%', height: '100%' }} />
      {status !== 'ready' && (
        <MapMsg error={status === 'loading' ? null : status} onRetry={() => { setStatus('loading'); setTries((n) => n + 1); }} />
      )}
    </div>
  );
}

function guCenter(c, name) {
  const f = c.gu.features.find((x) => x.properties.name === name);
  return f ? L.geoJSON(f).getBounds().getCenter() : null;
}

function draw(c, { passGus, selGu, pins: pinData, padLeft }) {
  const { map } = c;
  const left = isDesktop() ? padLeft : 0;

  c.guLayer.setStyle((f) => {
    const name = f.properties.name;
    const sel = name === selGu;
    const pass = passGus.has(name);
    return {
      color: sel ? PRI : 'oklch(0.55 0.03 262)', weight: sel ? 2.5 : 0.8, dashArray: sel ? null : '3 3',
      fillColor: pass ? 'oklch(0.8 0.08 262)' : '#fff', fillOpacity: pass ? 0.18 : 0,
    };
  });
  c.guLayer.eachLayer((layer) => {
    const el = layer.getTooltip()?.getElement();
    if (el) el.style.opacity = layer.feature.properties.name === selGu ? 1 : 0.55;
  });

  // 선택된 구 안의 동 경계
  if (c.dongLayer) { map.removeLayer(c.dongLayer); c.dongLayer = null; }
  const guFeature = c.gu.features.find((f) => f.properties.name === selGu);
  if (c.dong && guFeature) {
    const code = String(guFeature.properties.code);
    c.dongLayer = L.geoJSON(
      { type: 'FeatureCollection', features: c.dong.features.filter((f) => String(f.properties.code).slice(0, 5) === code) },
      { pane: 'dongPane', interactive: false, style: { color: PRI, weight: 0.8, opacity: 0.45, fill: false } },
    ).addTo(map);
  }

  const pins = pinData
    .map((p) => ({ ...p, ll: c.dongCenter[p.name] || guCenter(c, p.gu), top: !!p.rank && p.rank <= 10 }))
    .filter((p) => p.ll);
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

  // 핀 구성이 바뀌면 화면을 다시 맞춘다 (처음엔 서울 전체, 이후엔 핀 범위)
  const key = pins.map((p) => p.name).sort().join(',');
  if (key !== c.fitKey) {
    if (pins.length && !selPin) {
      map.invalidateSize();
      if (!c.fitKey) map.fitBounds(c.guLayer.getBounds(), { paddingTopLeft: [left + 8, 8], paddingBottomRight: [8, 8], animate: false });
      else map.fitBounds(pinBounds(), { paddingTopLeft: [left, 0], paddingBottomRight: [0, bottomPad()], maxZoom: 13 });
    }
    c.fitKey = key;
  }

  // 선택이 바뀌면 그 동으로 날아가고 경계를 강조한다
  const selKey = selPin ? selPin.name : '';
  if (selKey !== c.lastSel) {
    if (c.focusLayer) { map.removeLayer(c.focusLayer); c.focusLayer = null; }
    if (selPin) {
      const feature = c.dong?.features.find((f) => f.properties.name === selPin.name);
      const bounds = feature ? L.geoJSON(feature).getBounds() : L.latLngBounds([selPin.ll, selPin.ll]);
      map.flyToBounds(bounds, { paddingTopLeft: [left + 60, 60], paddingBottomRight: [60, bottomPad() + 60], maxZoom: 15, duration: 0.45, easeLinearity: 0.5 });
      if (feature) c.focusLayer = L.geoJSON(feature, { pane: 'dongPane', interactive: false, style: { color: PRI, weight: 2.5, fillColor: PRI, fillOpacity: 0.12 } }).addTo(map);
    } else if (pins.length) {
      map.flyToBounds(pinBounds(), { paddingTopLeft: [left, 0], paddingBottomRight: [0, bottomPad()], maxZoom: 13, duration: 0.4, easeLinearity: 0.5 });
    }
    c.lastSel = selKey;
  }

  renderPins(c);
}

function pinHtml(p) {
  if (!p.top) {
    return p.sel
      ? `<div class="dot" style="width:32px;height:32px;background:${PRI};color:#fff;border-color:${PRI};font-size:11px">${p.score}</div><div class="in" style="top:-30px"><div class="nm" style="background:${DEEP};color:#fff">${p.name}</div></div>`
      : `<div class="dot">${p.score}</div>`;
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
    `<div class="nm" style="background:${p.sel ? DEEP : light ? '#fff' : PRI};color:${light ? PRI : '#fff'};${light ? 'box-shadow:0 1px 3px oklch(0.3 0.03 262 / 0.25);border:1px solid oklch(0.47 0.17 262 / 0.45)' : ''}">${p.name}</div>` +
    `<div class="sc">${p.score}${p.score === '—' ? '' : '점'}</div></div>`;
}

// 핀은 수가 적고 줌/이동마다 통째로 다시 배치해야 해서 Leaflet 마커 대신 pane에 직접 그린다
function renderPins(c) {
  const { map, pinPane, pins } = c;
  pinPane.replaceChildren();
  if (!pins.length) return;
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
    wrap.className = 'pin-w';
    wrap.style.transform = `translate(${p.ox}px,${p.oy}px)`;
    const dx = p.x - p.ox, dy = p.y - p.oy, dist = Math.hypot(dx, dy);
    // 라벨이 원래 위치에서 밀려났으면 지시선으로 잇는다
    if (p.top && dist > 6) {
      wrap.insertAdjacentHTML('beforeend', `<div class="pin-ld" style="width:${dist}px;transform:rotate(${Math.atan2(dy, dx)}rad)"></div><div class="pin-ldot"></div>`);
    }
    const marker = document.createElement('div');
    marker.className = 'pin-mk';
    marker.style.transform = `translate(${dx}px,${dy}px) scale(${k})`;
    marker.title = `${p.name} · ${p.gu} · ${p.score}점`;
    marker.innerHTML = pinHtml(p);
    marker.addEventListener('click', (e) => { e.stopPropagation(); c.handlers.current.onPickDong?.(p.name); });
    wrap.appendChild(marker);
    frag.appendChild(wrap);
  });
  pinPane.appendChild(frag);
}
