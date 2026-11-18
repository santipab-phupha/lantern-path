import { useRef, useState } from "react";
import { MousePointer2, RotateCcw, ZoomIn, ZoomOut, Maximize2, LampWallDown, Layers2, Ruler } from "lucide-react";
import FloorPlan, { type FloorPlanHandle } from "./FloorPlan";
import { FurnitureFinishes } from "./FurnitureArt";
import Inspector from "./Inspector";
import { useEditor } from "./useEditor";

export default function App() {
  const editor = useEditor();
  const {
    scene, selected, solution, chairPose, playback, feedback, planning, planError,
    examples, loadExample, reset, togglePlayback,
    setRoom, setChair, addObject, updateObject, removeObject,
    selectObject, setEntrance, setDestination,
  } = editor;

  const [example, setExample] = useState(examples[0]);
  const floorPlanRef = useRef<FloorPlanHandle>(null);

  const complete = solution.complete;
  const playbackLabel =
    playback === "finished"
      ? complete ? "Reached the destination." : "Stopped before the destination."
      : "";

  // Adapters for FloorPlan
  function moveObject(id: string, x: number, y: number) {
    const obj = scene.obstacles.find(o => o.id === id);
    if (obj) updateObject({ ...obj, x: Math.round(x), y: Math.round(y) });
  }

  return (
    <>
      <FurnitureFinishes/>
      {/* ── Navigation bar ─────────────────────────────────────────────── */}
      <header className="masthead">
        <div className="page-width masthead-inner">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">
              <LampWallDown size={22} strokeWidth={1.65}/>
            </span>
            Lantern Path
            <span className="brand-context">Accessibility studio</span>
          </div>

          <div className="header-actions">
            <div className="example-picker">
              <label className="sr-only" htmlFor="example-select">Load example</label>
              <select
                id="example-select"
                className="example-select"
                value={example}
                onChange={e => { setExample(e.target.value); loadExample(e.target.value); }}
              >
                {examples.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <button type="button" className="reset-button" onClick={reset} title="Reset simulation">
              <RotateCcw size={15} aria-hidden="true" /> <span>Reset simulation</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────────── */}
      <main className="page-width">
        <div className="intro">
          <div className="manor-sky" aria-hidden="true"><i/><b/></div>
          <div><h1>{example}</h1><p>Explore the floor plan and find room for a wheelchair to turn.</p></div>
          <div className="dimensions"><Ruler size={17}/> {scene.room.w / 100} × {scene.room.h / 100} m <span/> {(scene.room.w * scene.room.h / 10000).toLocaleString("en", { maximumFractionDigits: 1 })} m²</div>
        </div>

        <div className="studio" data-route={complete ? "pass" : "blocked"}>
          {/* ── Floor plan panel ─────────────────────────────────────── */}
          <section className="plan-panel" aria-labelledby="floor-heading">
            <header className="plan-toolbar">
              <h2 id="floor-heading"><Layers2 size={17} aria-hidden="true"/> Ground floor</h2>
              <div className="toolbar-right">
                <span className="drag-hint">
                  <MousePointer2 size={13} aria-hidden="true" /> Drag to move · Scroll to zoom
                </span>
                <div className="zoom-controls" role="group" aria-label="Zoom controls">
                  <button type="button" title="Zoom in"
                    onClick={() => floorPlanRef.current?.zoomIn()}>
                    <ZoomIn size={14} aria-hidden="true" />
                  </button>
                  <button type="button" title="Zoom out"
                    onClick={() => floorPlanRef.current?.zoomOut()}>
                    <ZoomOut size={14} aria-hidden="true" />
                  </button>
                  <button type="button" title="Fit to view"
                    onClick={() => floorPlanRef.current?.fit()}>
                    <Maximize2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </header>

            <div className="drawing">
              <FloorPlan
                ref={floorPlanRef}
                scene={scene}
                suggestion={editor.suggestion}
                selected={selected}
                solution={solution}
                chairPose={chairPose}
                moveObject={moveObject}
                selectObject={selectObject}
              />
            </div>

            <footer className="legend">
              <span><i className="clearance-key" aria-hidden="true" />Chair clearance</span>
              <span><i className="path-key" aria-hidden="true" />{planning ? "Checking route" : complete ? "Route to destination" : "Partial route"}</span>
              <span className="floor-count">{scene.obstacles.filter(obj => obj.kind !== "wall").length} furnishings</span>
            </footer>
          </section>

          {/* ── Inspector sidebar ─────────────────────────────────────── */}
          <aside className="inspector" aria-label="Controls">
            <Inspector
              scene={scene}
              selected={selected}
              solution={solution}
              planning={planning}
              planError={planError}
              playback={playback}
              playbackLabel={playbackLabel}
              suggestion={editor.suggestion}
              adviceFailed={editor.adviceFailed}
              feedback={feedback}
              onTogglePlayback={togglePlayback}
              onSetRoom={setRoom}
              onSetChair={setChair}
              onAddObject={addObject}
              onUpdateObject={updateObject}
              onRemoveObject={removeObject}
              onSetEntrance={(x, y) => setEntrance({ x, y, a: scene.entrance.a })}
              onSetDestination={setDestination}
            />
          </aside>
        </div>
      </main>
    </>
  );
}
