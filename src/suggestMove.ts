import { planScene, type Scene, type SceneObject } from "./scene.ts";
import { poseFits, sweepFits, type Pose } from "./planner.ts";

export interface MoveSuggestion {
  object: SceneObject;
  distance: number;
  direction: string;
}

const directions = [
  { dx: 1, dy: 0, name: "right" }, { dx: -1, dy: 0, name: "left" },
  { dx: 0, dy: 1, name: "down" }, { dx: 0, dy: -1, name: "up" },
] as const;

// Distance to the nearest solid edge along a straight furniture slide.
// The room boundary is treated as another edge.
function clearance(obj: SceneObject, others: SceneObject[], scene: Scene, dx: number, dy: number) {
  const horizontal = dx !== 0;
  const sign = dx || dy;
  const start = horizontal ? obj.x : obj.y;
  const size = horizontal ? obj.w : obj.h;
  const side = horizontal ? obj.y : obj.x;
  const span = horizontal ? obj.h : obj.w;
  const roomSize = horizontal ? scene.room.w : scene.room.h;
  let free = sign > 0 ? roomSize - start - size : start;
  for (const other of others) {
    const cross = horizontal ? other.y : other.x;
    const width = horizontal ? other.h : other.w;
    if (cross >= side + span || cross + width <= side) continue;
    const edge = horizontal ? other.x : other.y;
    const depth = horizontal ? other.w : other.h;
    const gap = sign > 0 ? edge - start - size : start - edge - depth;
    if (gap >= 0) free = Math.min(free, gap);
  }
  return Math.floor(free);
}

export function suggestMove(scene: Scene, stop: Pose): MoveSuggestion | null {
  const proximity = (obj: SceneObject) => Math.hypot(
    Math.max(obj.x - stop.x, stop.x - obj.x - obj.w, 0),
    Math.max(obj.y - stop.y, stop.y - obj.y - obj.h, 0),
  );
  const nearby = scene.obstacles.filter(o => o.kind !== "wall")
    .sort((a, b) => proximity(a) - proximity(b)).slice(0, 6);

  for (const object of nearby) {
    const others = scene.obstacles.filter(o => o.id !== object.id);
    // If removing this piece entirely cannot open a route, moving it cannot either.
    const open = planScene({ ...scene, obstacles: others });
    if (!open.complete) continue;
    const halfLength = scene.chair.length / 2 + scene.chair.margin;
    const halfWidth = scene.chair.width / 2 + scene.chair.margin;
    const reach = Math.hypot(halfLength, halfWidth) * 1.1 + 16;
    const fits = (pose: Pose, moved: SceneObject[]) =>
      poseFits(pose.x, pose.y, pose.a, moved, 0, scene.room, halfLength, halfWidth);
    // The other obstacles already cleared this path. Only the shifted object
    // needs a new swept collision check for each translation and turn.
    const clearsPath = (object: SceneObject) => {
      const moved = [object];
      if (!fits(scene.entrance, moved) || !fits(open.path[0], moved)) return false;
      return open.path.every((pose, i) => {
        if (i === 0 || pose.x < object.x - reach || pose.x > object.x + object.w + reach ||
            pose.y < object.y - reach || pose.y > object.y + object.h + reach) return true;
        return sweepFits(open.path[i - 1], pose, moved, scene.room, halfLength, halfWidth);
      });
    };
    let witness: MoveSuggestion | null = null;
    for (const { dx, dy, name } of directions) {
      const limit = clearance(object, others, scene, dx, dy);
      for (let step = 8; step <= limit + 7; step += 8) {
        const cm = Math.min(step, limit);
        if (cm < 1 || (witness && cm >= witness.distance)) break;
        const moved = { ...object, x: object.x + dx * cm, y: object.y + dy * cm };
        if (clearsPath(moved)) {
          witness = { object: moved, distance: cm, direction: name };
          break;
        }
      }
    }
    if (witness) return witness;

    for (const { dx, dy, name } of directions) {
      const limit = clearance(object, others, scene, dx, dy);
      if (limit < 1) continue;
      const moved = (cm: number) => ({ ...object, x: object.x + dx * cm, y: object.y + dy * cm });
      const opens = (cm: number) => planScene({ ...scene, obstacles: [...others, moved(cm)] }).complete;
      // An intermediate placement may work even if the far end blocks another door.
      const probes = [...new Set([Math.min(40, limit), limit, Math.ceil(limit / 2)])];
      const success = probes.find(opens);
      if (!success) continue;
      return { object: moved(success), distance: success, direction: name };
    }

  }
  return null;
}
