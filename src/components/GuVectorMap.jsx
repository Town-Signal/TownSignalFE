import { useEffect, useMemo, useRef, useState } from 'react';
import { geoMercator, geoPath } from 'd3-geo';
import { loadGuGeo } from '../lib/geo';
import { errorKind } from '../lib/errors';
import { MapMsg } from './ui';
import './maps.css';

/**
 * 서울 25개 자치구 벡터 지도 (추천 2단계).
 * gus: { [구 geo_code(2013 통계청 5자리)]: { fill, hatch, dark, tip } } · selGu · onPick(geo_code)
 * 경계 GeoJSON의 properties.code로 잇는다(이름으로 찾지 않는다, 명세 10.8).
 */
export default function GuVectorMap({ gus, selGu, onPick }) {
  const boxRef = useRef(null);
  const [size, setSize] = useState(null);
  const [geo, setGeo] = useState(null);
  const [error, setError] = useState(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    loadGuGeo().then((g) => alive && setGeo(g), (e) => alive && setError(errorKind(e)));
    return () => { alive = false; };
  }, [tries]);
  const retry = () => { setError(null); setTries((n) => n + 1); };

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, []);

  // 투영은 크기가 바뀔 때만 다시 계산한다 (색·선택 변경과 분리)
  const shapes = useMemo(() => {
    if (!geo || !size || size.w < 10 || size.h < 10) return null;
    const pad = size.w < 480 ? 8 : 16;
    const path = geoPath(geoMercator().fitExtent([[pad, pad], [size.w - pad, size.h - pad]], geo));
    return geo.features.map((f) => ({ code: String(f.properties.code), name: f.properties.name, d: path(f), c: path.centroid(f) }));
  }, [geo, size]);

  const fontSize = size && size.w < 480 ? 9 : 11;
  const sel = shapes?.find((s) => s.code === selGu);

  return (
    <div ref={boxRef} className="gu-map">
      {!shapes && <MapMsg error={error} onRetry={retry} />}
      {shapes && (
        <svg viewBox={`0 0 ${size.w} ${size.h}`} role="group" aria-label="서울 자치구 지도">
          <defs>
            <pattern id="gu-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="#fff" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="oklch(0.75 0.01 262)" strokeWidth="2" />
            </pattern>
          </defs>
          {shapes.map((s) => {
            const g = gus[s.code];
            return (
              <path
                key={s.code} d={s.d} className="gu-shape"
                fill={g ? (g.hatch ? 'url(#gu-hatch)' : g.fill) : 'oklch(0.95 0.004 262)'}
                role="button" tabIndex={0} aria-pressed={s.code === selGu}
                onClick={() => onPick(s.code)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(s.code); } }}
              >
                <title>{s.name + (g?.tip ? ` · ${g.tip}` : '')}</title>
              </path>
            );
          })}
          {sel && <path d={sel.d} className="gu-sel" />}
          <g pointerEvents="none" fontSize={fontSize} textAnchor="middle">
            {shapes.map((s) => (
              <text
                key={s.code} x={s.c[0]} y={s.c[1] + fontSize / 3}
                fontWeight={s.code === selGu ? 800 : 600}
                fill={gus[s.code]?.dark ? '#fff' : 'oklch(0.35 0.02 262)'}
              >
                {s.name.replace(/구$/, '')}
              </text>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
