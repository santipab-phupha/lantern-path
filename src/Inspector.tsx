import { useState } from "react";
import { furniture, furnitureKinds, type FurnitureKind } from "./furniture";
import { FurnitureArt } from "./FurnitureArt";
import {
  ChevronDown, CircleCheck, CircleMinus, Play, RotateCcw, Square,
} from "lucide-react";
import type { Scene, SceneObject } from "./scene";
import type { Solution } from "./planner";
import type { Playback } from "./useEditor";
import type { MoveSuggestion } from "./suggestMove";
import ObjectPanel from "./ObjectPanel";

type Props = {
  scene:          Scene;
  selected:       string | null;
  suggestion?: MoveSuggestion | null;
  adviceFailed: boolean;
  solution:       Solution;
  planning:       boolean;
  planError:      boolean;
  playback:       Playback;
  playbackLabel:  string;
  feedback:       string;
  onTogglePlayback: () => void;
  onSetRoom:      (w: number, h: number) => void;
  onSetChair:     (chair: Scene["chair"]) => void;
  onAddObject: (kind: FurnitureKind) => void;
  onUpdateObject: (obj: SceneObject) => void;
  onRemoveObject: (id: string) => void;
  onSetEntrance:  (x: number, y: number) => void;
  onSetDestination:(x: number, y: number) => void;
};

function NumInput({
  label, value, min = 1, step = 1, onChange,
}: {
  label: string; value: number; min?: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <label className="insp-field">
      <span>{label}</span>
      <input
        type="number" value={value} min={min} step={step}
        onChange={e => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) onChange(v); }}
      />
    </label>
  );
}

export default function Inspector({
  scene, selected, solution, planning, planError, playback, playbackLabel, feedback,
  onTogglePlayback, onSetRoom, onSetChair,
  onAddObject, onUpdateObject, onRemoveObject, onSetEntrance, onSetDestination, suggestion, adviceFailed,
}: Props) {
  const [allFurniture, setAllFurniture] = useState(false);
  const complete = solution.complete;
  const running  = playback === "running";
  const RunIcon  = running ? Square : playback === "finished" ? RotateCcw : Play;
  const runLabel = running ? "Stop" : playback === "finished" ? "Run again" : "Run simulation";
  const isError  = !planning && planError;

  const selectedObj = selected
    ? scene.obstacles.find(o => o.id === selected) ?? null
    : null;

  return (
    <>
      {/* Route status */}
      <section className="inspector-section">
        <h2>Route check</h2>
        <div className={`outcome${planning ? " outcome--calculating" : ""}`} aria-live="polite">
          {planning
            ? <span className="calculating-spinner" aria-hidden="true" />
            : complete
              ? <CircleCheck size={20} aria-hidden="true" />
              : <CircleMinus size={20} aria-hidden="true" />}
          <strong>{planning ? "Calculating…" : isError ? "Calculation failed" : complete ? "Route found" : "Route blocked"}</strong>
        </div>
        <p className="route-detail">
          {planning
            ? "Running the wheelchair simulation…"
            : isError
              ? "The route could not be calculated. Change the layout to try again."
              : complete
              ? "The wheelchair can reach the destination with the current layout."
              : "No complete path found — the dashed line shows how far the route reached."}
        </p>
        {!planning && !complete && !isError && (
          <div className="move-advice" role="status">
            <h3>Furniture suggestion</h3>
            {suggestion ? <>
              <p>Move <strong>{suggestion.object.label}</strong> {suggestion.distance} cm {suggestion.direction}.
                The wheelchair can reach the destination with this change.</p>
              <button type="button" onClick={() => onUpdateObject(suggestion.object)}>Apply move</button>
            </> : <p>{adviceFailed ? "The move check could not finish. Adjust the layout to try again."
              : suggestion === undefined ? "Testing furniture positions…"
              : "No single move found among the positions tested. Try moving two pieces or widening the passage."}</p>}
          </div>
        )}
        <button type="button" className="run-button" onClick={onTogglePlayback} disabled={planning || isError || !solution.path.length}>
          <RunIcon size={16} aria-hidden="true" /> {runLabel}
        </button>
        {playbackLabel && <p className="playback-status" role="status">{playbackLabel}</p>}
        {feedback      && <p className="insp-feedback" role="alert">{feedback}</p>}
      </section>

      {/* Selected object editor */}
      {selectedObj && (
        <ObjectPanel
          obj={selectedObj}
          onChange={onUpdateObject}
          onRemove={onRemoveObject}
        />
      )}

      <section className="inspector-section library" aria-label="Furniture library">
        <div className="section-heading"><h2>Furniture library</h2><button type="button" aria-expanded={allFurniture}
          onClick={() => setAllFurniture(!allFurniture)}>{allFurniture ? "Show less" : "View all"}</button></div>
        <div className="library-grid">
          {(allFurniture ? furnitureKinds : furnitureKinds.slice(0, 6)).map(kind => {
            const item = furniture[kind];
            const ratio = Math.min(56 / item.w, 37 / item.h);
            return <button key={kind} className="library-piece" type="button" onClick={() => onAddObject(kind)} aria-label={`Add ${item.label.toLowerCase()}`}>
              <span><FurnitureArt kind={kind} width={item.w * ratio} height={item.h * ratio}/></span>
              {item.label}
            </button>;
          })}
        </div>
      </section>

      {/* Room dimensions */}
      <details className="inspector-section settings"><summary>Room settings <ChevronDown size={15}/></summary>
        <div className="insp-row">
          <NumInput
            label="Width (cm)" value={scene.room.w} min={100} step={8}
            onChange={v => onSetRoom(v, scene.room.h)}
          />
          <NumInput
            label="Depth (cm)" value={scene.room.h} min={100} step={8}
            onChange={v => onSetRoom(scene.room.w, v)}
          />
        </div>
        <div className="insp-row" style={{ marginTop: 10 }}>
          <NumInput
            label="Entrance X" value={scene.entrance.x} min={0}
            onChange={v => onSetEntrance(v, scene.entrance.y)}
          />
          <NumInput
            label="Entrance Y" value={scene.entrance.y} min={0}
            onChange={v => onSetEntrance(scene.entrance.x, v)}
          />
        </div>
        <div className="insp-row">
          <NumInput
            label="Destination X" value={scene.destination.x} min={0}
            onChange={v => onSetDestination(v, scene.destination.y)}
          />
          <NumInput
            label="Destination Y" value={scene.destination.y} min={0}
            onChange={v => onSetDestination(scene.destination.x, v)}
          />
        </div>
      </details>

      <details className="inspector-section settings"><summary>Wheelchair settings <ChevronDown size={15}/></summary>
        <div className="insp-row">
          <NumInput
            label="Width (cm)"  value={scene.chair.width}  min={1}
            onChange={v => onSetChair({ ...scene.chair, width: v })}
          />
          <NumInput
            label="Length (cm)" value={scene.chair.length} min={1}
            onChange={v => onSetChair({ ...scene.chair, length: v })}
          />
        </div>
        <div className="insp-row">
          <NumInput
            label="Margin (cm)" value={scene.chair.margin} min={0}
            onChange={v => onSetChair({ ...scene.chair, margin: v })}
          />
        </div>
      </details>

      {/* Disclaimer */}
      <details className="assumptions">
        <summary>
          Simulation details <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <p>
          The simulation places the wheelchair on an 8 cm grid and tests
          8 headings (45° steps). A navigable route may be missed if the
          gap is real but falls between grid positions or requires a
          heading not in the 45° set. This is a planning model — not an
          accessibility certification and must not be used as one.
        </p>
      </details>
    </>
  );
}
