export interface Rectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Table extends Rectangle {
  id: string;
}

export interface Pose {
  x: number;
  y: number;
  a: number;
}

export interface Solution {
  complete: boolean;
  path: Pose[];
}

// All distances are in centimetres. The chair pivots about its centre.
export const room = { w: 580, h: 424 };
export const wall: Rectangle = { x: 0, y: 0, w: 280, h: 192 };
export const initial: Table[] = [
  { id: "A", x: 10, y: 312, w: 350, h: 86 },
  { id: "B", x: 368, y: 0, w: 140, h: 280 },
];
export const start: Pose = { x: 80, y: 236, a: 0 };
export const goal = { x: 328, y: 76 };
export const chair = { length: 116, width: 70, margin: 4 };

const step = 8;
const gridYOffset = 4;
const headings = 8;
const headingStep = (2 * Math.PI) / headings;

// ─── poseFits ────────────────────────────────────────────────────────────────
// poseFits is intentionally NOT chair-aware; it receives half-extents via its
// closure over halfLength/halfWidth from the module level for the original API,
// and via the generalised API below.

const _halfLength = chair.length / 2 + chair.margin;
const _halfWidth  = chair.width  / 2 + chair.margin;

export function poseFits(
  x: number,
  y: number,
  angle: number,
  obstacles: readonly Rectangle[],
  padding = 0,
  roomDims = room,
  halfLen = _halfLength,
  halfWid = _halfWidth,
): boolean {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const absCosine = Math.abs(cosine);
  const absSine = Math.abs(sine);
  const length = halfLen + padding;
  const width  = halfWid + padding;
  const radiusX = length * absCosine + width * absSine;
  const radiusY = length * absSine   + width * absCosine;

  if (x - radiusX < 0 || y - radiusY < 0 || x + radiusX > roomDims.w || y + radiusY > roomDims.h) return false;

  for (const obstacle of obstacles) {
    const halfObstacleWidth  = obstacle.w / 2;
    const halfObstacleHeight = obstacle.h / 2;
    const dx = x - obstacle.x - halfObstacleWidth;
    const dy = y - obstacle.y - halfObstacleHeight;
    if (Math.abs(dx) >= radiusX + halfObstacleWidth || Math.abs(dy) >= radiusY + halfObstacleHeight) continue;
    if (Math.abs(dx * cosine + dy * sine) >= length + halfObstacleWidth * absCosine + halfObstacleHeight * absSine) continue;
    if (Math.abs(-dx * sine + dy * cosine) >= width  + halfObstacleWidth * absSine  + halfObstacleHeight * absCosine) continue;
    return false;
  }
  return true;
}

export function shortestTurn(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

// Enclose each short translation or rotation in its padded midpoint footprint.
export function sweepFits(
  from: Pose,
  to: Pose,
  obstacles: readonly Rectangle[],
  roomDims = room,
  halfLen = _halfLength,
  halfWid = _halfWidth,
): boolean {
  const cornerRadius = Math.hypot(halfLen, halfWid);

  if (from.x !== to.x || from.y !== to.y) {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const pieces = Math.ceil(distance / 2);
    for (let index = 0; index < pieces; index++) {
      const t = (index + 0.5) / pieces;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      if (!poseFits(x, y, from.a, obstacles, distance / (2 * pieces), roomDims, halfLen, halfWid)) return false;
    }
    return true;
  }

  const turn = shortestTurn(from.a, to.a);
  const pieces = 12;
  const padding = (cornerRadius * Math.abs(turn)) / (2 * pieces);
  for (let index = 0; index < pieces; index++) {
    const angle = from.a + (turn * (index + 0.5)) / pieces;
    if (!poseFits(from.x, from.y, angle, obstacles, padding, roomDims, halfLen, halfWid)) return false;
  }
  return true;
}

// ─── PlanOptions ─────────────────────────────────────────────────────────────

export interface PlanOptions {
  room:       { w: number; h: number };
  obstacles:  readonly Rectangle[];
  start:      Pose;
  goal:       { x: number; y: number };
  chair:      { width: number; length: number; margin: number };
  anyHeading?: boolean;   // accept all 8 headings at goal (default: false → heading 2 or 6 only)
}

export function planGeneral(options: PlanOptions): Solution {
  const { room: r, obstacles, start: s, goal: g, chair: ch, anyHeading = false } = options;
  const halfLen = ch.length / 2 + ch.margin;
  const halfWid = ch.width  / 2 + ch.margin;

  if (!poseFits(s.x, s.y, s.a, obstacles, 0, r, halfLen, halfWid)) return { complete: false, path: [] };

  const cols = Math.ceil(r.w / step);
  const rows = Math.ceil(r.h / step);
  const yOffset = step / 2;   // keep grid cells half-step from boundary

  function encode(col: number, row: number, h: number): number {
    return (row * cols + col) * headings + h;
  }

  function decode(id: number): Pose {
    const cell = Math.floor(id / headings);
    return {
      x: (cell % cols) * step,
      y: Math.floor(cell / cols) * step + yOffset,
      a: (id % headings) * headingStep,
    };
  }

  const capacity = cols * rows * headings;
  const unvisited = -2;
  const parents = new Int32Array(capacity).fill(unvisited);
  const queue   = new Int32Array(capacity);

  const startCol = Math.round(s.x / step);
  const startRow = Math.round((s.y - yOffset) / step);
  const startH   = Math.round(s.a / headingStep) % headings;
  const first    = encode(startCol, startRow, startH);

  let head = 0, tail = 1;
  let best = first, nearest = Infinity;
  let complete = false;
  queue[0] = first;
  parents[first] = -1;

  while (head < tail) {
    const id    = queue[head++];
    const pose  = decode(id);
    const h     = id % headings;
    const dist  = Math.hypot(g.x - pose.x, g.y - pose.y);
    if (dist < nearest) { nearest = dist; best = id; }

    const goalReached = dist === 0 && (anyHeading || h === 2 || h === 6);
    if (goalReached) { best = id; complete = true; break; }

    const col = Math.round(pose.x / step);
    const row = Math.round((pose.y - yOffset) / step);
    const dx  = Math.round(Math.cos(pose.a));
    const dy  = Math.round(Math.sin(pose.a));

    const neighbours = [
      [col + dx, row + dy, h],
      [col - dx, row - dy, h],
      [col, row, (h + 1) % headings],
      [col, row, (h + headings - 1) % headings],
    ];

    for (const [nc, nr, nh] of neighbours) {
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const next = encode(nc, nr, nh);
      if (parents[next] !== unvisited) continue;
      if (!sweepFits(pose, decode(next), obstacles, r, halfLen, halfWid)) continue;
      parents[next] = id;
      queue[tail++] = next;
    }
  }

  const path: Pose[] = [];
  for (let id = best; id !== -1; id = parents[id]) path.push(decode(id));
  return { complete, path: path.reverse() };
}

// ─── Original plan() — preserved for backward compatibility ──────────────────

const _cols = 73;
const _rows = 54;

function _encode(column: number, row: number, heading: number): number {
  return (row * _cols + column) * headings + heading;
}

function _decode(id: number): Pose {
  const cell = Math.floor(id / headings);
  return {
    x: (cell % _cols) * step,
    y: Math.floor(cell / _cols) * step + gridYOffset,
    a: (id % headings) * headingStep,
  };
}

export function plan(tables: readonly Table[]): Solution {
  const obstacles = [wall, ...tables];
  if (!poseFits(start.x, start.y, start.a, obstacles)) return { complete: false, path: [] };

  const capacity = _cols * _rows * headings;
  const unvisited = -2;
  const parents = new Int32Array(capacity).fill(unvisited);
  const queue = new Int32Array(capacity);
  const first = _encode(start.x / step, (start.y - gridYOffset) / step, 0);
  let head = 0;
  let tail = 1;
  let best = first;
  let nearest = Infinity;
  let complete = false;
  queue[0] = first;
  parents[first] = -1;

  while (head < tail) {
    const id = queue[head++];
    const pose = _decode(id);
    const heading = id % headings;
    const distance = Math.hypot(goal.x - pose.x, goal.y - pose.y);
    if (distance < nearest) {
      nearest = distance;
      best = id;
    }
    if (distance === 0 && (heading === 2 || heading === 6)) {
      best = id;
      complete = true;
      break;
    }

    const column = pose.x / step;
    const row = (pose.y - gridYOffset) / step;
    const dx = Math.round(Math.cos(pose.a));
    const dy = Math.round(Math.sin(pose.a));
    const neighbours = [
      [column + dx, row + dy, heading],
      [column - dx, row - dy, heading],
      [column, row, (heading + 1) % headings],
      [column, row, (heading + headings - 1) % headings],
    ];
    for (const [nextColumn, nextRow, nextHeading] of neighbours) {
      if (nextColumn < 0 || nextColumn >= _cols || nextRow < 0 || nextRow >= _rows) continue;
      const next = _encode(nextColumn, nextRow, nextHeading);
      if (parents[next] !== unvisited || !sweepFits(pose, _decode(next), obstacles)) continue;
      parents[next] = id;
      queue[tail++] = next;
    }
  }

  const path: Pose[] = [];
  for (let id = best; id !== -1; id = parents[id]) path.push(_decode(id));
  return { complete, path: path.reverse() };
}
