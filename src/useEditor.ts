import { useEffect, useReducer, useState } from "react";
import { shortestTurn, poseFits, type Solution } from "./planner.ts";
import {
  type Scene, type SceneObject,
  toRectangles, snapToGrid, clamp, newId,
  EXAMPLE_BOOK_FAIR, EXAMPLE_NARROW_CORNER, EXAMPLE_EVENT_ROOM, EXAMPLE_MANSION,
} from "./scene.ts";
import type { Pose } from "./planner.ts";

import type { MoveSuggestion } from "./suggestMove.ts";
import { countryHouse, midnightManor } from "./estate.ts";
import { furniture } from "./furniture.ts";

export const NUDGE_CM = 10;
export type Playback = "idle" | "running" | "finished";

export const EXAMPLES: Record<string, Scene> = {
  "Midnight Manor": midnightManor,
  "Alderwick Manor": countryHouse,
  "Mansion":        EXAMPLE_MANSION,
  "Book Fair":      EXAMPLE_BOOK_FAIR,
  "Narrow Corner":  EXAMPLE_NARROW_CORNER,
  "Event Room":     EXAMPLE_EVENT_ROOM,
};

// ─── State ───────────────────────────────────────────────────────────────────

interface EditorState {
  scene:     Scene;
  selected:  string | null;
  playback:  Playback;
  chairPose: Pose;
  feedback:  string;
}

export function makeInitialState(scene: Scene): EditorState {
  return {
    scene,
    selected:  null,
    playback:  "idle",
    chairPose: scene.entrance,
    feedback:  "",
  };
}

const DEFAULT_STATE = makeInitialState(midnightManor);

// ─── Actions ─────────────────────────────────────────────────────────────────

type EditorAction =
  | { type: "setRoom";       w: number; h: number }
  | { type: "addObject";     kind: SceneObject["kind"] }
  | { type: "updateObject";  obj: SceneObject }
  | { type: "removeObject";  id: string }
  | { type: "selectObject";  id: string | null }
  | { type: "setEntrance";   pose: Pose }
  | { type: "setDestination"; x: number; y: number }
  | { type: "setChair";      chair: Scene["chair"] }
  | { type: "loadExample";   name: string }
  | { type: "reset" }
  | { type: "togglePlayback"; hasPath: boolean }
  | { type: "frame";          pose: Pose; done: boolean; scene: Scene };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function halfExtents(ch: Scene["chair"]) {
  return {
    halfLen: ch.length / 2 + ch.margin,
    halfWid: ch.width  / 2 + ch.margin,
  };
}

function objectsExcept(objects: SceneObject[], id: string) {
  return objects.filter(o => o.id !== id);
}

function collidesWithOthers(candidate: SceneObject, others: SceneObject[]): boolean {
  return others.some(o =>
    candidate.x < o.x + o.w && candidate.x + candidate.w > o.x &&
    candidate.y < o.y + o.h && candidate.y + candidate.h > o.y,
  );
}

function outOfBounds(o: SceneObject, room: { w: number; h: number }): boolean {
  return o.x < 0 || o.y < 0 || o.x + o.w > room.w || o.y + o.h > room.h;
}

function entranceClear(entrance: Pose, obstacles: readonly SceneObject[], scene: Scene): boolean {
  const { halfLen, halfWid } = halfExtents(scene.chair);
  return poseFits(entrance.x, entrance.y, entrance.a, toRectangles(obstacles), 0, scene.room, halfLen, halfWid);
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function reducer(state: EditorState, action: EditorAction): EditorState {
  const { scene } = state;

  switch (action.type) {

    case "setRoom": {
      const w = Math.max(100, action.w);
      const h = Math.max(100, action.h);
      const obstacles = scene.obstacles.filter(
        o => o.x + o.w <= w && o.y + o.h <= h,
      );
      return {
        ...state,
        scene: { ...scene, room: { w, h }, obstacles },
        playback: "idle",
        chairPose: scene.entrance,
        feedback: "",
      };
    }

    case "addObject": {
      const spec = furniture[action.kind];
      const obj: SceneObject = {
        id: newId(), kind: action.kind, label: spec.label,
        x: 0, y: 0, w: spec.w, h: spec.h,
      };
      // Try the centre of the visible floor first, then scan available space.
      function fits(x: number, y: number) {
        obj.x = x;
        obj.y = y;
        return !outOfBounds(obj, scene.room)
          && !collidesWithOthers(obj, scene.obstacles)
          && entranceClear(scene.entrance, [obj], scene);
      }
      let placed = fits(snapToGrid((scene.room.w - obj.w) / 2), snapToGrid((scene.room.h - obj.h) / 2));
      for (let y = 0; !placed && y + obj.h <= scene.room.h; y += 8) {
        for (let x = 0; !placed && x + obj.w <= scene.room.w; x += 8) placed = fits(x, y);
      }
      if (!placed) return { ...state, feedback: `No space for a ${spec.label.toLowerCase()} at its standard size.` };
      return {
        ...state,
        scene: { ...scene, obstacles: [...scene.obstacles, obj] },
        selected: obj.id,
        playback: "idle",
        chairPose: scene.entrance,
        feedback: "",
      };
    }

    case "updateObject": {
      const { obj } = action;
      const others = objectsExcept(scene.obstacles, obj.id);

      const clamped: SceneObject = {
        ...obj,
        w: Math.max(10, obj.w),
        h: Math.max(10, obj.h),
        x: clamp(obj.x, 0, scene.room.w - Math.max(10, obj.w)),
        y: clamp(obj.y, 0, scene.room.h - Math.max(10, obj.h)),
      };

      if (collidesWithOthers(clamped, others) || outOfBounds(clamped, scene.room)) {
        return { ...state, feedback: "Object overlaps another or is out of bounds." };
      }

      const updatedObstacles = scene.obstacles.map(o => o.id === obj.id ? clamped : o);

      if (!entranceClear(scene.entrance, updatedObstacles, { ...scene, obstacles: updatedObstacles })) {
        return { ...state, feedback: "Cannot move here — entrance would be blocked." };
      }

      return {
        ...state,
        scene: { ...scene, obstacles: updatedObstacles },
        playback: "idle",
        chairPose: scene.entrance,
        feedback: "",
      };
    }

    case "removeObject": {
      const obstacles = scene.obstacles.filter(o => o.id !== action.id);
      return {
        ...state,
        scene: { ...scene, obstacles },
        selected: state.selected === action.id ? null : state.selected,
        playback: "idle",
        chairPose: scene.entrance,
        feedback: "",
      };
    }

    case "selectObject":
      return { ...state, selected: action.id, feedback: "" };

    case "setEntrance": {
      const { halfLen, halfWid } = halfExtents(scene.chair);
      const fits = poseFits(
        action.pose.x, action.pose.y, action.pose.a,
        toRectangles(scene.obstacles), 0, scene.room, halfLen, halfWid,
      );
      if (!fits) return { ...state, feedback: "Entrance position is blocked or out of bounds." };
      return {
        ...state,
        scene: { ...scene, entrance: action.pose },
        playback: "idle",
        chairPose: action.pose,
        feedback: "",
      };
    }

    case "setDestination": {
      // Grid x = col*8; grid y = row*8 + 4 (yOffset = step/2).
      // snapToGrid(v) = round(v/8)*8 is correct for x but wrong for y.
      // Correct y snap: round((y-4)/8)*8 + 4
      const x = snapToGrid(action.x);
      const y = Math.round((action.y - 4) / 8) * 8 + 4;
      if (x < 0 || y < 0 || x > scene.room.w || y > scene.room.h) {
        return { ...state, feedback: "Destination is outside the room." };
      }
      return {
        ...state,
        scene: { ...scene, destination: { x, y } },
        playback: "idle",
        chairPose: scene.entrance,
        feedback: "",
      };
    }

    case "setChair": {
      const chair = {
        width:  Math.max(1, action.chair.width),
        length: Math.max(1, action.chair.length),
        margin: Math.max(0, action.chair.margin),
      };
      return {
        ...state,
        scene: { ...scene, chair },
        playback: "idle",
        chairPose: scene.entrance,
        feedback: "",
      };
    }

    case "loadExample": {
      const example = EXAMPLES[action.name];
      if (!example) return state;
      return makeInitialState(example);
    }

    case "reset":
      return makeInitialState(state.scene);

    case "togglePlayback":
      if (state.playback === "running") {
        return { ...state, chairPose: scene.entrance, playback: "idle" };
      }
      return action.hasPath
        ? { ...state, chairPose: scene.entrance, playback: "running" }
        : state;

    case "frame":
      if (state.playback !== "running" || action.scene !== state.scene) return state;
      return {
        ...state,
        chairPose: action.pose,
        playback: action.done ? "finished" : "running",
      };
  }
}

// ─── Worker-based async planner ───────────────────────────────────────────────
// We terminate + recreate the worker on every new scene to prevent a
// growing backlog of obsolete BFS jobs during rapid dragging. The worker
// cannot be interrupted mid-run, so termination is the only way to clear it.

const EMPTY_SOLUTION: Solution = { complete: false, path: [] };

function useAsyncPlanner(scene: Scene) {
  type Result = { scene: Scene; solution?: Solution; suggestion?: MoveSuggestion | null; failed?: boolean; adviceFailed?: boolean };
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    const worker = new Worker(new URL("./plannerWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<Pick<Result, "solution" | "suggestion">>) => {
      setResult(previous => ({ ...(previous?.scene === scene ? previous : {}), scene, ...data }));
    };
    worker.onerror = () => setResult(previous => previous?.scene === scene && previous.solution
      ? { ...previous, adviceFailed: true }
      : { scene, failed: true });
    worker.postMessage(scene);
    return () => { worker.onmessage = null; worker.onerror = null; worker.terminate(); };
  }, [scene]);

  const current = result?.scene === scene ? result : null;
  return {
    solution: current?.solution ?? EMPTY_SOLUTION,
    planning: !current?.solution && !current?.failed,
    planError: Boolean(current?.failed),
    suggestion: current?.suggestion,
    adviceFailed: Boolean(current?.adviceFailed),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEditor() {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);
  const { scene, playback } = state;
  const planner = useAsyncPlanner(scene);
  const { solution } = planner;

  // ── Animation loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (playback !== "running") return;
    const { path } = solution;
    if (path.length === 0) return;

    const times = [0];
    for (let i = 1; i < path.length; i++) {
      const prior = path[i - 1];
      const next  = path[i];
      const dist  = Math.hypot(next.x - prior.x, next.y - prior.y);
      times.push(times[i - 1] + (dist ? dist * 8 : 420));
    }

    const began = performance.now();
    let segment = 0;
    let frameId = requestAnimationFrame(animate);

    function animate(now: number) {
      const elapsed = Math.max(0, now - began);
      while (segment + 1 < path.length && times[segment + 1] <= elapsed) segment++;
      const from = path[segment];
      const to   = path[segment + 1];
      if (!to) {
        dispatch({ type: "frame", pose: from, done: true, scene });
        return;
      }
      const progress = (elapsed - times[segment]) / (times[segment + 1] - times[segment]);
      dispatch({
        type: "frame",
        pose: {
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
          a: from.a + shortestTurn(from.a, to.a) * progress,
        },
        done: false,
        scene,
      });
      frameId = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(frameId);
  }, [playback, solution, scene]);

  return {
    ...state,
    ...planner,
    examples: Object.keys(EXAMPLES),
    setRoom:         (w: number, h: number) => dispatch({ type: "setRoom", w, h }),
    addObject:       (kind: SceneObject["kind"]) => dispatch({ type: "addObject", kind }),
    updateObject:    (obj: SceneObject) => dispatch({ type: "updateObject", obj }),
    removeObject:    (id: string) => dispatch({ type: "removeObject", id }),
    selectObject:    (id: string | null) => dispatch({ type: "selectObject", id }),
    setEntrance:     (pose: Pose) => dispatch({ type: "setEntrance", pose }),
    setDestination:  (x: number, y: number) => dispatch({ type: "setDestination", x, y }),
    setChair:        (chair: Scene["chair"]) => dispatch({ type: "setChair", chair }),
    loadExample:     (name: string) => dispatch({ type: "loadExample", name }),
    reset:           () => dispatch({ type: "reset" }),
    togglePlayback:  () => dispatch({ type: "togglePlayback", hasPath: solution.path.length > 0 }),
  };
}
