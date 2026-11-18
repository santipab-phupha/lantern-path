/**
 * scene.test.js — custom room builder regression tests
 *
 * Run with:  node --test  (npm test)
 *
 * Tests cover: custom room geometry, obstacle add/remove, entrance/destination
 * changes, wheelchair size, corner collisions, and the three example layouts.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  planScene,
  snapToGrid,
  clamp,
  EXAMPLE_BOOK_FAIR,
  EXAMPLE_NARROW_CORNER,
  EXAMPLE_EVENT_ROOM,
} from '../src/scene.ts';

import { planGeneral, poseFits } from '../src/planner.ts';
import { makeInitialState, reducer } from '../src/useEditor.ts';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Clone a scene deeply enough for safe mutation. */
function clone(scene) {
  return JSON.parse(JSON.stringify(scene));
}

/** Build a minimal open scene for geometry tests. */
function openScene(overrides = {}) {
  return {
    room:        { w: 400, h: 400 },
    obstacles:   [],
    entrance:    { x: 72, y: 204, a: 0 },
    destination: { x: 320, y: 204 },
    chair:       { width: 70, length: 116, margin: 4 },
    anyHeading:  true,
    ...overrides,
  };
}

// ─── 1. Utilities ─────────────────────────────────────────────────────────────

describe('helpers', () => {
  it('snapToGrid rounds to nearest 8 cm', () => {
    assert.strictEqual(snapToGrid(0),   0);    // 0/8 = 0
    assert.strictEqual(snapToGrid(3),   0);    // 3/8 = 0.375 → 0
    assert.strictEqual(snapToGrid(4),   8);    // 4/8 = 0.5 → rounds up to 1 → 8
    assert.strictEqual(snapToGrid(5),   8);    // 5/8 = 0.625 → 1 → 8
    assert.strictEqual(snapToGrid(12),  16);   // 12/8 = 1.5 → rounds up to 2 → 16
    assert.strictEqual(snapToGrid(100), 104);  // 100/8 = 12.5 → 13 → 104
  });

  it('clamp stays in [lo, hi]', () => {
    assert.strictEqual(clamp(5, 10, 20),  10);
    assert.strictEqual(clamp(15, 10, 20), 15);
    assert.strictEqual(clamp(25, 10, 20), 20);
  });
});

// ─── 2. Custom room geometry ──────────────────────────────────────────────────

describe('planScene – custom room geometry', () => {
  it('open 400×400 room: entrance to destination is reachable', () => {
    const sol = planScene(openScene());
    assert.strictEqual(sol.complete, true,
      'straight east path in a clear 400×400 room should be complete');
  });

  it('room boundary reduces grid: start outside boundary is blocked', () => {
    // Shrink room so entrance is outside it
    const scene = openScene({ room: { w: 60, h: 60 } });
    const sol = planScene(scene);
    // entrance at x=72 is outside w=60 → no valid start pose
    assert.strictEqual(sol.complete, false);
  });

  it('planGeneral respects custom room width in poseFits boundary check', () => {
    const r = { w: 200, h: 200 };
    const ch = { width: 70, length: 116, margin: 4 };
    const halfLen = ch.length / 2 + ch.margin;   // 62
    const halfWid = ch.width  / 2 + ch.margin;   // 39
    // x=72 is 62+10 from left wall — fits
    assert.ok(poseFits(72, 100, 0, [], 0, r, halfLen, halfWid));
    // x=10 is 10 from left wall — 10 < 62 → does not fit
    assert.strictEqual(poseFits(10, 100, 0, [], 0, r, halfLen, halfWid), false);
  });
});

// ─── 3. Obstacle add / remove ─────────────────────────────────────────────────

describe('planScene – obstacle edits', () => {
  it('adding a wall that blocks the corridor makes the route incomplete', () => {
    const scene = openScene();
    // Insert a wall that cuts across the east–west corridor
    scene.obstacles.push({ id: 'wall-1', kind: 'wall', label: 'Wall', x: 150, y: 0, w: 100, h: 400 });
    const sol = planScene(scene);
    assert.strictEqual(sol.complete, false,
      'a full-width wall across the corridor must block the route');
  });

  it('removing the blocking wall reopens the route', () => {
    const scene = openScene();
    scene.obstacles.push({ id: 'wall-1', kind: 'wall', label: 'Wall', x: 150, y: 0, w: 100, h: 400 });
    // blocked
    assert.strictEqual(planScene(scene).complete, false);
    // remove it
    scene.obstacles = [];
    assert.strictEqual(planScene(scene).complete, true);
  });

  it('a partial-width wall that leaves room for the chair does not block', () => {
    const scene = openScene();
    // Wall only covers top half — leaves a 200 cm opening at the bottom
    // Chair body halfWid=39 → padded half=39 at y=204, needs y ± 39 = 165..243
    // Wall covers y=0..200, gap is y=200..400 (200 cm) → chair centre at y=204, fits
    scene.obstacles.push({ id: 'wall-top', kind: 'wall', label: 'Half wall', x: 150, y: 0, w: 50, h: 160 });
    const sol = planScene(scene);
    assert.strictEqual(sol.complete, true);
  });
});

// ─── 4. Entrance and destination changes ──────────────────────────────────────

describe('planScene – entrance and destination changes', () => {
  it('moving the destination through the editor snaps to a reachable planner grid point', () => {
    const initial = makeInitialState(openScene());
    const updated = reducer(initial, { type: 'setDestination', x: 319, y: 205 });
    assert.deepStrictEqual(updated.scene.destination, { x: 320, y: 204 });
    const result = planScene(updated.scene);
    assert.strictEqual(result.complete, true);
    assert.deepStrictEqual(
      { x: result.path.at(-1).x, y: result.path.at(-1).y },
      updated.scene.destination,
    );
  });

  it('moving the destination to an unreachable position returns a partial path', () => {
    const scene = openScene();
    // Surround destination with walls on all sides
    scene.obstacles = [
      { id: 'w-top',   kind: 'wall', label: 'T', x: 260, y: 160, w: 80, h: 10 },
      { id: 'w-bot',   kind: 'wall', label: 'B', x: 260, y: 230, w: 80, h: 10 },
      { id: 'w-left',  kind: 'wall', label: 'L', x: 258, y: 160, w: 10, h: 80 },
      { id: 'w-right', kind: 'wall', label: 'R', x: 330, y: 160, w: 10, h: 80 },
    ];
    scene.destination = { x: 304, y: 204 };
    const sol = planScene(scene);
    assert.strictEqual(sol.complete, false);
  });

  it('moving destination to the same side as entrance with open path → complete', () => {
    // Destination and entrance both near x=72 and x=320 on the same y level
    const scene = openScene({ destination: { x: 320, y: 204 } });
    assert.strictEqual(planScene(scene).complete, true);
  });
});

// ─── 5. Wheelchair size ───────────────────────────────────────────────────────

describe('planScene – wheelchair size', () => {
  it('small chair fits through a narrow gap that blocks the default chair', () => {
    // Gap of 100 cm between two walls — default padded half = 39, so 100 > 78 fits
    // With a wider chair (body 160 cm + margin 4 → padded 168 cm) the gap is too tight
    const scene = openScene();
    scene.obstacles = [
      { id: 'w1', kind: 'wall', label: 'Top', x: 150, y: 0,   w: 100, h: 155 },
      { id: 'w2', kind: 'wall', label: 'Bot', x: 150, y: 255, w: 100, h: 145 },
    ];
    // Default chair (70 wide, margin 4 → halfWid 39, corridor 100 > 78 ✓)
    assert.strictEqual(planScene(scene).complete, true, 'default chair should pass 100 cm gap');

    // Wide chair (body 180 cm + margin 4 → halfWid 94, needs ≥188 cm gap)
    const wideChairScene = { ...scene, chair: { width: 180, length: 116, margin: 4 } };
    assert.strictEqual(planScene(wideChairScene).complete, false, 'wide chair should not pass 100 cm gap');
  });

  it('reducing margin allows the chair to fit a tighter space', () => {
    // Gap of 82 cm: default padded width 78 (margin 4) ≈ barely fits
    // With margin=10 padded width becomes 90, should block
    const scene = openScene();
    scene.obstacles = [
      { id: 'w1', kind: 'wall', label: 'Top', x: 150, y: 0,   w: 100, h: 160 },
      { id: 'w2', kind: 'wall', label: 'Bot', x: 150, y: 244, w: 100, h: 156 },
    ];
    // margin 4 → halfWid 39, gap 84 ≥ 78 → fits
    const defaultSol = planScene(scene);
    assert.strictEqual(defaultSol.complete, true);

    // margin 10 → halfWid 45, needs 90 cm gap, only 84 → blocked
    const tightScene = { ...scene, chair: { width: 70, length: 116, margin: 10 } };
    assert.strictEqual(planScene(tightScene).complete, false);
  });
});

// ─── 6. Corner collision (Narrow Corner example) ──────────────────────────────

describe('Narrow Corner example', () => {
  it('default configuration is blocked (turn too tight)', () => {
    const sol = planScene(EXAMPLE_NARROW_CORNER);
    assert.strictEqual(sol.complete, false,
      'Narrow Corner default: both aisles exceed 78 cm but the turn must be blocked');
  });

  it('shrinking the wall width from 350 to 280 cm opens the route', () => {
    const scene = clone(EXAMPLE_NARROW_CORNER);
    // Narrow Corner has one wall: id 'nc-wall'
    scene.obstacles[0].w = 280;
    const sol = planScene(scene);
    assert.strictEqual(sol.complete, true,
      'widening the corner (wall w=280) must open a complete route');
  });

  it('both straight corridor widths exceed the padded chair width', () => {
    // Vertical aisle = room.h - wall.h = 450 - 280 = 170 cm
    // Horizontal aisle = room.w - wall.w = 600 - 350 = 250 cm
    // Padded chair width = 70 + 2*4 = 78 cm
    const wall  = EXAMPLE_NARROW_CORNER.obstacles[0];
    const { w: rw, h: rh } = EXAMPLE_NARROW_CORNER.room;
    const { width, margin } = EXAMPLE_NARROW_CORNER.chair;
    const paddedWidth = width + 2 * margin;
    const vertAisle  = rh - wall.h;  // 170
    const horizAisle = rw - wall.w;  // 250
    assert.ok(vertAisle  > paddedWidth, `vertical aisle ${vertAisle} must exceed ${paddedWidth}`);
    assert.ok(horizAisle > paddedWidth, `horizontal aisle ${horizAisle} must exceed ${paddedWidth}`);
  });
});

// ─── 7. Example layouts ───────────────────────────────────────────────────────

describe('example layouts – expected outcomes', () => {
  it('Book Fair: default layout is blocked (corner turn too tight)', () => {
    const sol = planScene(EXAMPLE_BOOK_FAIR);
    assert.strictEqual(sol.complete, false,
      'Book Fair default must be blocked (matches original plan(initial) behaviour)');
  });

  it('Book Fair: Table B shifted +40 cm → route is complete', () => {
    const scene = clone(EXAMPLE_BOOK_FAIR);
    const tableB = scene.obstacles.find(o => o.id === 'bf-tableB');
    assert.ok(tableB, 'bf-tableB must exist in EXAMPLE_BOOK_FAIR');
    tableB.x += 40;
    const sol = planScene(scene);
    assert.strictEqual(sol.complete, true,
      'Book Fair with Table B shifted +40 cm must be complete');
  });

  it('Narrow Corner: default is blocked', () => {
    assert.strictEqual(planScene(EXAMPLE_NARROW_CORNER).complete, false);
  });

  it('Event Room: default (central table in gap) is blocked', () => {
    assert.strictEqual(planScene(EXAMPLE_EVENT_ROOM).complete, false,
      'Event Room with central table in corridor must be blocked');
  });

  it('Event Room: removing the central table opens the route', () => {
    const scene = clone(EXAMPLE_EVENT_ROOM);
    scene.obstacles = scene.obstacles.filter(o => o.id !== 'er-central');
    assert.strictEqual(planScene(scene).complete, true,
      'Event Room without central table must be complete');
  });
});

// ─── 8. Mansion example ───────────────────────────────────────────────────────

import {
  EXAMPLE_MANSION,
  EXAMPLE_MANSION_BLOCKED,
} from '../src/scene.ts';
import { countryHouse } from '../src/estate.ts';

describe('Alderwick Manor reading room', () => {
  it('is reachable until the dining table is moved across its doorway', () => {
    assert.equal(planScene(countryHouse).complete, true);
    const changed = clone(countryHouse);
    const table = changed.obstacles.find(o => o.id === 'dining-table');
    Object.assign(table, { x: 2600, y: 664 });
    assert.equal(planScene(changed).complete, false);
  });
});

describe('Mansion example', () => {
  it('default mansion route is complete (route found)', () => {
    const sol = planScene(EXAMPLE_MANSION);
    assert.strictEqual(sol.complete, true,
      'Mansion default: route from entrance to destination must be complete');
  });

  it('mansion route path is non-empty', () => {
    const sol = planScene(EXAMPLE_MANSION);
    assert.ok(sol.path.length > 0, 'path must have at least one pose');
  });

  it('mansion with blocker (wardrobe in doorway) is blocked', () => {
    const sol = planScene(EXAMPLE_MANSION_BLOCKED);
    assert.strictEqual(sol.complete, false,
      'Mansion with mn-blocker in doorway must be blocked');
  });

  it('removing mn-blocker from mansion reopens the route', () => {
    const scene = clone(EXAMPLE_MANSION_BLOCKED);
    scene.obstacles = scene.obstacles.filter(o => o.id !== 'mn-blocker');
    const sol = planScene(scene);
    assert.strictEqual(sol.complete, true,
      'Removing mn-blocker must reopen the route');
  });

  it('room dimensions are ~20 m × ~16 m', () => {
    const { w, h } = EXAMPLE_MANSION.room;
    assert.ok(w >= 1800 && w <= 2200, `room width ${w} cm should be ~2000`);
    assert.ok(h >= 1400 && h <= 1800, `room height ${h} cm should be ~1600`);
  });

  it('mansion entrance and destination are inside the room', () => {
    const { room, entrance, destination } = EXAMPLE_MANSION;
    assert.ok(entrance.x >= 0 && entrance.x <= room.w, 'entrance.x in room');
    assert.ok(entrance.y >= 0 && entrance.y <= room.h, 'entrance.y in room');
    assert.ok(destination.x >= 0 && destination.x <= room.w, 'destination.x in room');
    assert.ok(destination.y >= 0 && destination.y <= room.h, 'destination.y in room');
  });

  it('mansion entrance pose fits in the default layout', () => {
    const { room, entrance, obstacles, chair } = EXAMPLE_MANSION;
    const halfLen = chair.length / 2 + chair.margin;
    const halfWid = chair.width  / 2 + chair.margin;
    const obs = obstacles.map(({ x, y, w, h }) => ({ x, y, w, h }));
    assert.ok(poseFits(entrance.x, entrance.y, entrance.a, obs, 0, room, halfLen, halfWid),
      'entrance pose must fit in the obstacle set');
  });

  it('mn-blocker obstacle exists in EXAMPLE_MANSION_BLOCKED', () => {
    const blocker = EXAMPLE_MANSION_BLOCKED.obstacles.find(o => o.id === 'mn-blocker');
    assert.ok(blocker, 'mn-blocker must be present in EXAMPLE_MANSION_BLOCKED');
    assert.ok(blocker.w >= 100 && blocker.h >= 100, 'mn-blocker should be large enough to block a doorway');
  });
});
