/**
 * scene.ts — Custom room layout data model and planner adapter.
 *
 * A Scene describes everything the generalised planner needs: room dimensions,
 * rectangular obstacles, the wheelchair's start pose, the destination, and the
 * wheelchair's physical dimensions.  planScene() converts a Scene into a call
 * to planGeneral() and returns a Solution.
 */

import { planGeneral, type Rectangle, type Pose, type Solution } from "./planner.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

import type { FurnitureKind } from "./furniture.ts";

export type ObstacleKind = FurnitureKind;

export interface SceneObject {
  id: string;
  kind: ObstacleKind;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scene {
  room: { w: number; h: number };
  obstacles: SceneObject[];
  floorInsets?: { y: number; h: number }[];
  zones?: { name: string; x: number; y: number }[];
  entrance: Pose;             // wheelchair start: x, y, heading (radians)
  destination: { x: number; y: number };
  chair: { width: number; length: number; margin: number };
  anyHeading: boolean;        // if true accept any arrival heading (not just ↑ ↓)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GRID_STEP = 8;

/** Round a value to the nearest grid cell. */
export function snapToGrid(v: number, step = GRID_STEP): number {
  return Math.round(v / step) * step;
}

/** Clamp v to [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Clamp a position to stay within the room, accounting for chair extents. */
export function clampToRoom(
  x: number,
  y: number,
  roomW: number,
  roomH: number,
  halfLen: number,
  halfWid: number,
): { x: number; y: number } {
  return {
    x: clamp(x, halfLen, roomW - halfLen),
    y: clamp(y, halfWid, roomH - halfWid),
  };
}

let _counter = 0;
/** Generate a stable, unique string id. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `obj-${Date.now()}-${++_counter}`;
}

/** Convert SceneObject[] to Rectangle[] for the planner. */
export function toRectangles(objects: readonly SceneObject[]): Rectangle[] {
  return objects.map(({ x, y, w, h }) => ({ x, y, w, h }));
}

// ─── planScene ───────────────────────────────────────────────────────────────

export function planScene(scene: Scene): Solution {
  return planGeneral({
    room: scene.room,
    obstacles: toRectangles(scene.obstacles),
    start: scene.entrance,
    goal: scene.destination,
    chair: scene.chair,
    anyHeading: scene.anyHeading,
  });
}

// ─── Example layouts ─────────────────────────────────────────────────────────

/**
 * EXAMPLE_BOOK_FAIR
 * The original Make Room book-fair layout reproduced as a Scene.
 * Expected result: complete === false (corner turn too tight by default).
 * Move Table B 40 cm right → complete === true.
 */
export const EXAMPLE_BOOK_FAIR: Scene = {
  room: { w: 580, h: 424 },
  obstacles: [
    { id: "bf-wall",    kind: "wall",  label: "Corner wall", x: 0,   y: 0,   w: 280, h: 192 },
    { id: "bf-tableA",  kind: "table", label: "Table A",     x: 10,  y: 312, w: 350, h: 86  },
    { id: "bf-tableB",  kind: "table", label: "Table B",     x: 368, y: 0,   w: 140, h: 280 },
  ],
  entrance:    { x: 80, y: 236, a: 0 },
  destination: { x: 328, y: 76 },
  chair:       { width: 70, length: 116, margin: 4 },
  anyHeading:  false,   // original uses heading-2/6 arrival check
};

/**
 * EXAMPLE_NARROW_CORNER
 * A 600×450 cm room with a single large corner wall (350×280 cm).
 * Both straight corridors are wider than the padded wheelchair (vertical 170 cm,
 * horizontal 250 cm), but the corner turn is too tight.
 * Expected result: complete === false.
 * Shrink the wall width to 280 cm → complete === true.
 */
export const EXAMPLE_NARROW_CORNER: Scene = {
  room: { w: 600, h: 450 },
  obstacles: [
    { id: "nc-wall", kind: "wall", label: "Corner wall", x: 0, y: 0, w: 350, h: 280 },
  ],
  entrance:    { x: 80, y: 324, a: 0 },
  destination: { x: 384, y: 68 },
  chair:       { width: 70, length: 116, margin: 4 },
  anyHeading:  true,
};

/**
 * EXAMPLE_EVENT_ROOM
 * A 700×500 cm event room with two long tables forming a corridor,
 * and a central table that blocks the passage.
 * Expected result: complete === false.
 * Remove or move the central table (id "er-central") → complete === true.
 */
export const EXAMPLE_EVENT_ROOM: Scene = {
  room: { w: 700, h: 500 },
  obstacles: [
    { id: "er-top",     kind: "table", label: "Table Top",     x: 200, y: 80,  w: 300, h: 120 },
    { id: "er-bottom",  kind: "table", label: "Table Bottom",  x: 200, y: 300, w: 300, h: 120 },
    { id: "er-central", kind: "table", label: "Central table", x: 280, y: 200, w: 100, h: 100 },
  ],
  entrance:    { x: 72, y: 252, a: 0 },
  destination: { x: 632, y: 252 },
  chair:       { width: 70, length: 116, margin: 4 },
  anyHeading:  true,
};

/**
 * EXAMPLE_MANSION
 * A 2000×1600 cm (20 m × 16 m) mansion floor plan.
 *
 * Rooms (approximate):
 *   West wing  (x 0–600):   Entrance hall (south), sitting room (north)
 *   Central    (x 600–1200): Study / dining corridor
 *   East wing  (x 1200–2000): Library (north), master bedroom (top-right)
 *
 * Structural walls create doorway openings; furniture fills each room.
 *
 * Default result:   complete === true  (route found through the halls)
 * With mn-blocker:  complete === false (wardrobe fills the central doorway)
 * Remove mn-blocker → complete === true  again
 */
export const EXAMPLE_MANSION: Scene = {
  room: { w: 2000, h: 1600 },
  obstacles: [
    // ── Structural walls ───────────────────────────────────────────
    // Vertical divider 1: x=600  (opening at y=780–980)
    { id: "mn-v1a", kind: "wall", label: "Wall",    x: 600,  y: 0,    w: 20, h: 780  },
    { id: "mn-v1b", kind: "wall", label: "Wall",    x: 600,  y: 980,  w: 20, h: 620  },
    // Vertical divider 2: x=1200 (opening at y=580–840)
    { id: "mn-v2a", kind: "wall", label: "Wall",    x: 1200, y: 0,    w: 20, h: 580  },
    { id: "mn-v2b", kind: "wall", label: "Wall",    x: 1200, y: 840,  w: 20, h: 760  },
    // Horizontal divider 1: y=600, west wing  (opening at x=0–120)
    { id: "mn-h1",  kind: "wall", label: "Wall",    x: 120,  y: 600,  w: 460, h: 20  },
    // Horizontal divider 2: y=1000, central    (opening at x=560–620)
    { id: "mn-h2",  kind: "wall", label: "Wall",    x: 620,  y: 1000, w: 560, h: 20  },
    // Vertical divider 3: x=1600 (opening at y=400–620)
    { id: "mn-v3",  kind: "wall", label: "Wall",    x: 1600, y: 620,  w: 20, h: 980  },
    // Horizontal divider 3: y=400, east wing  (opening at x=1200–1220 is the gap)
    { id: "mn-h3",  kind: "wall", label: "Wall",    x: 1220, y: 400,  w: 780, h: 20  },

    // ── Furniture ─────────────────────────────────────────────────
    { id: "mn-sofa",  kind: "sofa", label: "Sofa",      x: 40,   y: 650,  w: 200, h: 80  },
    { id: "mn-tbl1",  kind: "table", label: "Din. table",x: 720,  y: 120,  w: 300, h: 140 },
    { id: "mn-tbl2",  kind: "table", label: "Side table",x: 720,  y: 860,  w: 280, h: 120 },
    { id: "mn-bed1",  kind: "bed", label: "Bed (guest)",x:1280, y: 60,   w: 280, h: 200 },
    { id: "mn-bed2",  kind: "bed", label: "Master bed", x:1680, y: 60,   w: 280, h: 200 },
    { id: "mn-desk",  kind: "desk", label: "Desk",      x: 1700, y: 700,  w: 240, h: 100 },
  ],
  entrance:    { x: 72, y: 804, a: 0 },        // heading east, west wall, mid-height
  destination: { x: 1760, y: 500 },             // master bedroom area
  chair:       { width: 70, length: 116, margin: 4 },
  anyHeading:  true,
};

/**
 * EXAMPLE_MANSION_BLOCKED
 * Same as EXAMPLE_MANSION but with mn-blocker (a wardrobe in the central doorway).
 * Expected result: complete === false.
 */
export const EXAMPLE_MANSION_BLOCKED: Scene = {
  ...EXAMPLE_MANSION,
  obstacles: [
    ...EXAMPLE_MANSION.obstacles,
    { id: "mn-blocker", kind: "wardrobe", label: "Wardrobe", x: 630, y: 795, w: 350, h: 170 },
  ],
};
