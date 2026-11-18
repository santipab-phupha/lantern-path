import {
  useId, useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle,
  type KeyboardEvent, type PointerEvent,
} from "react";
import type { Pose, Solution } from "./planner";
import type { Scene, SceneObject } from "./scene";
import type { MoveSuggestion } from "./suggestMove";
import { FurnitureArt } from "./FurnitureArt";
import { NUDGE_CM } from "./useEditor";

// ─── Public handle exposed to App via forwardRef ──────────────────────────────

export interface FloorPlanHandle {
  zoomIn():  void;
  zoomOut(): void;
  fit():     void;
}

// ─── Viewport model ──────────────────────────────────────────────────────────
// The viewBox tracks the drawing area in CSS pixels.
// Inside it sits a single <g id="scene-root"> whose transform is:
//
//   translate(VB_W/2, VB_H/2) scale(scale) translate(-pivotX, -pivotY)
//
// pivotX/pivotY is the scene-space point that sits at the centre of the viewBox.
//
// This means clientToScene only needs the <g> element's getScreenCTM(), which
// already includes the SVG's own CSS transform, the viewBox mapping, and the g
// transform — giving pixel-accurate scene coordinates at any zoom/pan level.


const MIN_SCALE = 0.03;
const MAX_SCALE = 12;
const ZOOM_STEP = 1.35;

interface Viewport {
  pivotX: number;   // scene-space point at VB centre
  pivotY: number;
  scale:  number;
}

function fitViewport(roomW: number, roomH: number, pad: number, viewWidth: number, viewHeight: number): Viewport {
  const scale = Math.min(viewWidth / (roomW + pad * 2), viewHeight / (roomH + pad * 2));
  return {
    pivotX: roomW / 2,
    pivotY: roomH / 2,
    scale:  Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale)),
  };
}

function clampScale(s: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

// Convert client pixel → scene coords using the <g> element's CTM
function clientToSceneViaG(gEl: SVGGElement, clientX: number, clientY: number): { x: number; y: number } {
  const m = gEl.getScreenCTM();
  if (!m) return { x: 0, y: 0 };
  const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
  return { x: pt.x, y: pt.y };
}

// ─── Chair ───────────────────────────────────────────────────────────────────

function Chair({ x, y, a, halfLen, halfWid }: Pose & { halfLen: number; halfWid: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${(a * 180) / Math.PI})`} pointerEvents="none">
      <rect
        x={-halfLen} y={-halfWid} width={2 * halfLen} height={2 * halfWid}
        fill="rgba(0,122,255,0.10)" stroke="#007aff"
        strokeWidth="1.5" strokeDasharray="4 4" rx="4"
      />
      <rect x="-43" y="-23" width="63" height="46" rx="6" fill="#3a7bd5" stroke="#007aff" strokeWidth="2" />
      <path d="M-41 -19V19" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />
      <path d="M19 -17H43V17H19" fill="none" stroke="#007aff" strokeWidth="4" />
      <rect x="42" y="-19" width="15" height="38" rx="3" fill="#007aff" />
      <g fill="#1c1c1e">
        <rect x="-51" y="-35" width="73" height="8" rx="3" />
        <rect x="-51" y="27" width="73" height="8" rx="3" />
        <rect x="25" y="-26" width="15" height="7" rx="3" />
        <rect x="25" y="19" width="15" height="7" rx="3" />
      </g>
      <path d="m-17 -7 8 7-8 7" fill="none" stroke="#ffffff" strokeWidth="3"
        strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const colors = {
  ink: "#aa9884", annotation: "#d6c6b5", floor: "#382f3d",
  moss: "#a9f6cd", red: "#ffc278",
};

// ─── Drag helpers ─────────────────────────────────────────────────────────────

type ObjDrag = { pointerId: number; id: string; offsetX: number; offsetY: number };

// Touch pinch state
type PinchState = {
  id0: number; id1: number;
  startDist: number;
  startScale: number;
  anchorX: number;
  anchorY: number;
};

const keyDeltas = new Map<string, [number, number]>([
  ["ArrowLeft",  [-NUDGE_CM, 0]], ["ArrowRight", [NUDGE_CM, 0]],
  ["ArrowUp",    [0, -NUDGE_CM]], ["ArrowDown",  [0, NUDGE_CM]],
]);

// ─── Props ───────────────────────────────────────────────────────────────────

type FloorPlanProps = {
  scene:        Scene;
  selected:     string | null;
  solution:     Solution;
  suggestion?: MoveSuggestion | null;
  chairPose:    Pose;
  moveObject:   (id: string, x: number, y: number) => void;
  selectObject: (id: string | null) => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

const FloorPlan = forwardRef<FloorPlanHandle, FloorPlanProps>(function FloorPlan(
  { scene, selected, solution, chairPose, moveObject, selectObject, suggestion },
  ref,
) {
  const { room, obstacles, entrance, destination, chair } = scene;
  const halfLen = chair.length / 2 + chair.margin;
  const halfWid = chair.width  / 2 + chair.margin;
  const PAD = 80; // scene-unit padding around the room in the view

  const svgRef      = useRef<SVGSVGElement>(null);
  const gRef        = useRef<SVGGElement>(null);   // ← scene-root <g>
  const objDrag     = useRef<ObjDrag | null>(null);
  const panStart    = useRef<{ pointerId: number; svgX: number; svgY: number; pivotX: number; pivotY: number; scale: number } | null>(null);
  const pinch       = useRef<PinchState | null>(null);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const id          = useId();
  const gridId      = id + "-grid";
  const [view, setView] = useState({ w: 1000, h: 560 });
  const { w: VB_W, h: VB_H } = view;
  const tileId = id + "-tiles";
  const titleId     = id + "-title";

  const [vp, setVp] = useState<Viewport>(() => fitViewport(room.w, room.h, PAD, VB_W, VB_H));

  // Keep a stable ref to the latest vp so event handlers that capture vp don't stale-close
  const vpRef = useRef(vp);
  useEffect(() => { vpRef.current = vp; }, [vp]);

  // ── Fit ─────────────────────────────────────────────────────────────────────
  const fit = useCallback(() => {
    setVp(fitViewport(room.w, room.h, PAD, VB_W, VB_H));
  }, [room.w, room.h, VB_W, VB_H]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (w && h) setView(prev => prev.w === w && prev.h === h ? prev : { w, h });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  // Fit when room changes
  useEffect(() => { fit(); }, [fit]);

  // ── Zoom helpers ─────────────────────────────────────────────────────────────
  // Zoom so that scene point (sceneX, sceneY) stays at the same viewBox position.
  // new pivot = sceneX - (sceneX - oldPivot) * (oldScale / newScale)
  //           = sceneX + (oldPivot - sceneX) * (oldScale / newScale)
  const zoomAbout = useCallback((sceneX: number, sceneY: number, newScale: number) => {
    setVp(prev => {
      const s = clampScale(newScale);
      const ratio = prev.scale / s;
      return {
        pivotX: sceneX + (prev.pivotX - sceneX) * ratio,
        pivotY: sceneY + (prev.pivotY - sceneY) * ratio,
        scale:  s,
      };
    });
  }, []);

  function zoomAtViewboxCentre(factor: number) {
    // Zoom about the current pivot (= centre of view) so the view just scales uniformly
    setVp(prev => ({ ...prev, scale: clampScale(prev.scale * factor) }));
  }

  // ── Expose handle to parent ──────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    zoomIn:  () => zoomAtViewboxCentre(ZOOM_STEP),
    zoomOut: () => zoomAtViewboxCentre(1 / ZOOM_STEP),
    fit,
  }), [fit]);

  // ── clientToScene ────────────────────────────────────────────────────────────
  // Uses gRef so the transform includes SVG viewBox + <g> transform.
  function clientToScene(clientX: number, clientY: number) {
    return gRef.current
      ? clientToSceneViaG(gRef.current, clientX, clientY)
      : { x: 0, y: 0 };
  }

  function clientToSvg(clientX: number, clientY: number) {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: pt.x, y: pt.y };
  }

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function wheel(event: WheelEvent) {
      if (!gRef.current) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      const point = clientToSceneViaG(gRef.current, event.clientX, event.clientY);
      zoomAbout(point.x, point.y, vpRef.current.scale * factor);
    }
    svg.addEventListener("wheel", wheel, { passive: false });
    return () => svg.removeEventListener("wheel", wheel);
  }, [zoomAbout]);

  // ── Touch / pointer tracking ─────────────────────────────────────────────────
  function trackPointer(e: PointerEvent<SVGSVGElement | SVGGElement>) {
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function untrackPointer(e: PointerEvent<SVGSVGElement | SVGGElement>) {
    activePointers.current.delete(e.pointerId);
  }

  // ── Object drag ──────────────────────────────────────────────────────────────
  function onObjPointerDown(e: PointerEvent<SVGGElement>, obj: SceneObject) {
    // Only single-finger primary button (or touch without pinch in progress)
    if (e.button !== 0 && e.pointerType !== "touch") return;
    if (objDrag.current || pinch.current) return;
    trackPointer(e);
    if (activePointers.current.size >= 2) {
      untrackPointer(e); return; // let pinch handle it
    }
    const pt = clientToScene(e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.focus({ preventScroll: true });
    selectObject(obj.id);
    e.currentTarget.setPointerCapture(e.pointerId);
    objDrag.current = { pointerId: e.pointerId, id: obj.id, offsetX: pt.x - obj.x, offsetY: pt.y - obj.y };
  }

  function onObjPointerMove(e: PointerEvent<SVGGElement>) {
    if (activePointers.current.has(e.pointerId)) trackPointer(e);
    const d = objDrag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const pt = clientToScene(e.clientX, e.clientY);
    moveObject(d.id, pt.x - d.offsetX, pt.y - d.offsetY);
  }

  function onObjPointerUp(e: PointerEvent<SVGGElement>) {
    untrackPointer(e);
    if (e.pointerId === objDrag.current?.pointerId) objDrag.current = null;
  }

  function onObjKeyDown(e: KeyboardEvent<SVGGElement>, obj: SceneObject) {
    const delta = keyDeltas.get(e.key);
    if (delta) { e.preventDefault(); moveObject(obj.id, obj.x + delta[0], obj.y + delta[1]); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectObject(obj.id); }
  }

  // ── SVG-level pointer events (pan + pinch) ────────────────────────────────
  function onSvgPointerDown(e: PointerEvent<SVGSVGElement>) {
    trackPointer(e);
    const pts = [...activePointers.current.entries()];

    if (pts.length === 2 && !objDrag.current) {
      // Start pinch
      e.currentTarget.setPointerCapture(e.pointerId);
      const [[id0, p0], [id1, p1]] = pts as [[number, { x: number; y: number }], [number, { x: number; y: number }]];
      const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const midCx = (p0.x + p1.x) / 2;
      const midCy = (p0.y + p1.y) / 2;
      const midScene = clientToScene(midCx, midCy);
      pinch.current = {
        id0, id1,
        startDist: Math.max(dist, 1),
        startScale: vpRef.current.scale,
        anchorX: midScene.x,
        anchorY: midScene.y,
      };
      panStart.current = null;
      return;
    }

    if (pts.length === 1 && !objDrag.current && !pinch.current) {
      // Object drags stop propagation. Any button on the floor can pan.
      const isPan = e.button <= 2 || e.pointerType === "touch";
      if (isPan) {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const start = clientToSvg(e.clientX, e.clientY);
        panStart.current = {
          pointerId: e.pointerId,
          svgX: start.x, svgY: start.y,
          pivotX: vpRef.current.pivotX,
          pivotY: vpRef.current.pivotY,
          scale: vpRef.current.scale,
        };
      }
    }
  }

  function onSvgPointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!activePointers.current.has(e.pointerId)) return;
    trackPointer(e);

    // Pinch zoom
    if (pinch.current) {
      const { id0, id1, startDist, startScale, anchorX, anchorY } = pinch.current;
      const p0 = id0 === e.pointerId
        ? { x: e.clientX, y: e.clientY }
        : activePointers.current.get(id0);
      const p1 = id1 === e.pointerId
        ? { x: e.clientX, y: e.clientY }
        : activePointers.current.get(id1);
      if (!p0 || !p1) return;

      const dist   = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const factor = dist / startDist;
      const newScale = clampScale(startScale * factor);
      const midCx = (p0.x + p1.x) / 2;
      const midCy = (p0.y + p1.y) / 2;
      const midpoint = clientToSvg(midCx, midCy);
      setVp({
        pivotX: anchorX - (midpoint.x - VB_W / 2) / newScale,
        pivotY: anchorY - (midpoint.y - VB_H / 2) / newScale,
        scale: newScale,
      });
      return;
    }

    // Pan
    const ps = panStart.current;
    if (!ps || e.pointerId !== ps.pointerId) return;
    // Convert client movement through the SVG viewBox before converting to scene units.
    const current = clientToSvg(e.clientX, e.clientY);
    const dxScene = (current.x - ps.svgX) / ps.scale;
    const dyScene = (current.y - ps.svgY) / ps.scale;
    // Moving finger right → pivot moves left (scene scrolls right under view)
    setVp(prev => ({
      ...prev,
      pivotX: ps.pivotX - dxScene,
      pivotY: ps.pivotY - dyScene,
    }));
  }

  function onSvgPointerUp(e: PointerEvent<SVGSVGElement>) {
    untrackPointer(e);
    if (panStart.current?.pointerId === e.pointerId) panStart.current = null;
    if (pinch.current && (e.pointerId === pinch.current.id0 || e.pointerId === pinch.current.id1)) {
      pinch.current = null;
    }
  }

  function onSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!(e.target as Element).closest(".plan-table")) selectObject(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const { pivotX, pivotY, scale } = vp;
  // Transform: origin of scene-root is at VB centre, then scale, then offset by -pivot
  const gTransform = `translate(${VB_W / 2} ${VB_H / 2}) scale(${scale}) translate(${-pivotX} ${-pivotY})`;

  const complete = solution.complete;
  const path     = solution.path.map(({ x, y }, i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  const stop     = complete ? undefined : solution.path.at(-1);

  return (
    <div className="floor-plan-container">
      <svg
        ref={svgRef}
        className="floor-plan"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", userSelect: "none", width: "100%", height: "100%" }}
        role="group"
        aria-labelledby={titleId}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={onSvgPointerUp}
        onPointerCancel={onSvgPointerUp}
        onLostPointerCapture={onSvgPointerUp}
        onClick={onSvgClick}
        onContextMenu={e => e.preventDefault()}
      >
        <title id={titleId}>Floor plan</title>

        <defs>
          <radialGradient id={id + "-glow"}><stop stopColor="#ffc374" stopOpacity=".86"/>
            <stop offset=".42" stopColor="#ffac50" stopOpacity=".35"/><stop offset="1" stopColor="#ff9e47" stopOpacity="0"/></radialGradient>
          <pattern id={gridId} width="160" height="72" patternUnits="userSpaceOnUse">
            <rect width="160" height="72" fill="#3a3442"/>
            <path d="M0 0H160M0 36H160M55 0V36M135 36V72" fill="none" stroke="#504856" strokeWidth="1.8"/>
          </pattern>
          <pattern id={tileId} width="116" height="116" patternUnits="userSpaceOnUse">
            <rect width="116" height="116" fill="#46404b"/>
            <path d="M58 0l58 58-58 58L0 58Z" fill="#504852" stroke="#665b65" strokeWidth="1.6"/>
          </pattern>
        </defs>

        {/* Scene root — all draggable content lives here.
            Pointer events on obstacles go through here, so gRef.getScreenCTM()
            gives the full client→scene transform. */}
        <g ref={gRef} transform={gTransform}>

          <rect width={room.w} height={room.h} fill={`url(#${gridId})`} stroke={colors.ink} strokeWidth="6"/>
          {scene.floorInsets?.filter(inset => inset.y + inset.h <= room.h).map(inset => (
            <g key={inset.y} pointerEvents="none">
              <rect x="4" y={inset.y} width={room.w - 8} height={inset.h} fill={`url(#${tileId})`}/>
              <rect x="18" y={inset.y + 12} width={room.w - 36} height={inset.h - 24} fill="none" stroke="#847580" strokeWidth="4"/>
            </g>
          ))}
          {scene.zones?.filter(zone => zone.x < room.w && zone.y < room.h).map(zone => (
            <text key={zone.name} x={zone.x} y={zone.y} className="zone-name" style={{ fontSize: Math.max(48, 9 / scale) }} textAnchor="middle" pointerEvents="none">{zone.name}</text>
          ))}
          <g fill={colors.annotation} fontSize={Math.min(32, room.w / 30)} textAnchor="middle" dominantBaseline="middle">
            <text x={room.w / 2} y={room.h + 44}>{room.w / 100} m</text>
            <text transform={`translate(-42 ${room.h / 2}) rotate(-90)`}>{room.h / 100} m</text>
          </g>

          <circle cx={entrance.x} cy={entrance.y} r={Math.max(65, 20 / scale)} fill={`url(#${id}-glow)`} pointerEvents="none"/>
          {stop && <circle cx={stop.x} cy={stop.y} r={Math.max(52, 18 / scale)} fill={`url(#${id}-glow)`} pointerEvents="none"/>}
          {/* Route path */}
          {path && (
            <path className={complete ? "lit-path" : undefined} d={path} fill="none"
              stroke={complete ? colors.moss : colors.red}
              strokeWidth="3" vectorEffect="non-scaling-stroke"
              strokeDasharray={complete ? undefined : "10 8"}
              strokeLinecap="round" strokeLinejoin="round"
            />
          )}
          {stop && (
            <g transform={`translate(${stop.x} ${stop.y})`} fill={colors.floor} stroke={colors.red} strokeWidth="2.5">
              <circle r="11" />
              <path d="m-4 -4 8 8m0-8-8 8" strokeLinecap="round" />
            </g>
          )}

          {/* Obstacles */}
          {obstacles.map(obj => {
            const active  = selected === obj.id;
            return (
              <g
                key={obj.id}
                className="plan-table" data-suggested={suggestion?.object.id === obj.id || undefined}
                transform={`translate(${obj.x} ${obj.y})`}
                role="button" tabIndex={0}
                aria-label={obj.label} aria-pressed={active}
                style={{ cursor: "grab", touchAction: "none" }}
                onPointerDown={e => onObjPointerDown(e, obj)}
                onPointerMove={onObjPointerMove}
                onLostPointerCapture={onObjPointerUp}
                onPointerCancel={onObjPointerUp}
                onFocus={() => selectObject(obj.id)}
                onKeyDown={e => onObjKeyDown(e, obj)}
              >
                <title>{obj.label} · {obj.w} × {obj.h} cm</title>
                <rect width={obj.w} height={obj.h} fill="transparent"/>
                <FurnitureArt kind={obj.kind} width={obj.w} height={obj.h}/>
                <rect className="table-footprint" width={obj.w} height={obj.h} rx="2"
                  fill="none" stroke={active ? "#236dba" : "transparent"} strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
              </g>
            );
          })}

          {suggestion && <rect className="move-preview" x={suggestion.object.x} y={suggestion.object.y}
            width={suggestion.object.w} height={suggestion.object.h} rx="5" pointerEvents="none"
            vectorEffect="non-scaling-stroke"><title>Suggested position for {suggestion.object.label}</title></rect>}
          <g transform={`translate(${destination.x} ${destination.y})`} pointerEvents="none">
            <circle r="18" fill="white" stroke="#255f50" strokeWidth="5"/><circle r="8" fill="#255f50"/>
          </g>
          <g className="map-pins" fontSize={Math.max(9 / scale, Math.min(34, room.w / 30))} fontWeight="650" fill="#fff1d8" pointerEvents="none">
            <text textAnchor={destination.x > room.w * .85 ? "end" : "middle"} x={destination.x} y={destination.y - 33}>Destination</text>
            <text x={entrance.x} y={entrance.y - halfWid - 16}>Entrance</text>
          </g>
          {/* Wheelchair */}
          <Chair {...chairPose} halfLen={halfLen} halfWid={halfWid} />
        </g>
      </svg>
    </div>
  );
});

export default FloorPlan;
