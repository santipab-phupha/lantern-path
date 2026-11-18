import { useEffect, useMemo, useReducer } from "react";
import { initial, plan, poseFits, room, shortestTurn, start, wall } from "./planner";
import type { Pose, Rectangle, Table } from "./planner";

export const NUDGE_CM = 10;
export type Playback = "idle" | "running" | "finished";

interface State {
  tables: Table[];
  selected: number;
  chairPose: Pose;
  playback: Playback;
  moveFeedback: string;
}

type Action =
  | { type: "select"; index: number }
  | { type: "move"; index: number; x: number; y: number }
  | { type: "nudge"; dx: number; dy: number }
  | { type: "reset" }
  | { type: "togglePlayback"; hasPath: boolean }
  | { type: "frame"; pose: Pose; done: boolean; tables: Table[] };

const initialState: State = {
  tables: initial,
  selected: 1,
  chairPose: start,
  playback: "idle",
  moveFeedback: "",
};

function overlaps(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveTable(state: State, index: number, x: number, y: number): State {
  const table = state.tables[index];
  if (!table) return state;
  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  const candidate = {
    ...table,
    x: Math.min(room.w - table.w, Math.max(0, roundedX)),
    y: Math.min(room.h - table.h, Math.max(0, roundedY)),
  };

  const rejectsMove =
    overlaps(candidate, wall) ||
    state.tables.some((other, otherIndex) => otherIndex !== index && overlaps(candidate, other)) ||
    !poseFits(start.x, start.y, start.a, [candidate]);
  if (rejectsMove) {
    return { ...state, selected: index, moveFeedback: "Keep tables clear of walls, other tables, and the wheelchair’s starting position." };
  }
  if (candidate.x === table.x && candidate.y === table.y) {
    const hitBoundary = candidate.x !== roundedX || candidate.y !== roundedY;
    return { ...state, selected: index, moveFeedback: hitBoundary ? "The table is at the room boundary." : "" };
  }

  return {
    ...state,
    tables: state.tables.map((current, currentIndex) => currentIndex === index ? candidate : current),
    selected: index,
    chairPose: start,
    playback: "idle",
    moveFeedback: "",
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "select":
      return { ...state, selected: action.index, moveFeedback: "" };
    case "move":
      return moveTable(state, action.index, action.x, action.y);
    case "nudge": {
      const table = state.tables[state.selected];
      return moveTable(state, state.selected, table.x + action.dx, table.y + action.dy);
    }
    case "reset":
      return initialState;
    case "togglePlayback":
      if (state.playback === "running") return { ...state, chairPose: start, playback: "idle" };
      return action.hasPath ? { ...state, chairPose: start, playback: "running" } : state;
    case "frame":
      if (state.playback !== "running" || action.tables !== state.tables) return state;
      return { ...state, chairPose: action.pose, playback: action.done ? "finished" : "running" };
  }
}

export function useRoom() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { tables, playback } = state;
  const solution = useMemo(() => plan(tables), [tables]);

  useEffect(() => {
    if (playback !== "running") return;
    const { path } = solution;
    const times = [0];
    for (let index = 1; index < path.length; index++) {
      const prior = path[index - 1];
      const next = path[index];
      const distance = Math.hypot(next.x - prior.x, next.y - prior.y);
      times.push(times[index - 1] + (distance ? distance * 8 : 420));
    }

    const began = performance.now();
    let segment = 0;
    let frameId = requestAnimationFrame(animate);

    function animate(now: number) {
      const elapsed = Math.max(0, now - began);
      while (segment + 1 < path.length && times[segment + 1] <= elapsed) segment++;
      const from = path[segment];
      const to = path[segment + 1];
      if (!to) {
        dispatch({ type: "frame", pose: from, done: true, tables });
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
        tables,
      });
      frameId = requestAnimationFrame(animate);
    }

    return () => cancelAnimationFrame(frameId);
  }, [playback, solution, tables]);

  return {
    ...state,
    solution,
    moveTable: (index: number, x: number, y: number) => dispatch({ type: "move", index, x, y }),
    nudgeTable: (dx: number, dy: number) => dispatch({ type: "nudge", dx, dy }),
    selectTable: (index: number) => dispatch({ type: "select", index }),
    reset: () => dispatch({ type: "reset" }),
    togglePlayback: () => dispatch({ type: "togglePlayback", hasPath: solution.path.length > 0 }),
  };
}
