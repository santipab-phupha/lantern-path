/**
 * wheelchair-corner-clearance regression tests
 *
 * Run with:  node --test  (npm test)
 *
 * Node 24 strips TypeScript types natively, so we can import directly
 * from ../src/planner.ts without a separate transpile step.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  poseFits,
  sweepFits,
  plan,
  initial,
  wall,
  goal,
} from '../src/planner.ts';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Build the obstacle list that plan() uses internally. */
function obstacles(tables) {
  return [wall, ...tables];
}

// ─── aisle geometry constants ────────────────────────────────────────────────

const tableA      = initial.find(t => t.id === 'A');
const tableB      = initial.find(t => t.id === 'B');
const CHAIR_PADDED_WIDTH = 78; // cm (70 body + 2×4 margin)

// Horizontal aisle: gap between fixed wall bottom (y=192) and Table A top (y=312)
const HORIZ_AISLE = tableA.y - (wall.y + wall.h);   // 312 - 192 = 120 cm
// Vertical aisle:  gap between fixed wall right (x=280) and Table B left (x=368)
const VERT_AISLE  = tableB.x - (wall.x + wall.w);   // 368 - 280 = 88 cm

// ─── 1. Default layout: both aisles are wide enough but route is still blocked
// ─────────────────────────────────────────────────────────────────────────────
describe('default layout', () => {
  it('horizontal aisle exceeds padded chair width (120 > 78)', () => {
    assert.ok(
      HORIZ_AISLE > CHAIR_PADDED_WIDTH,
      `expected ${HORIZ_AISLE} > ${CHAIR_PADDED_WIDTH}`,
    );
  });

  it('vertical aisle exceeds padded chair width (88 > 78)', () => {
    assert.ok(
      VERT_AISLE > CHAIR_PADDED_WIDTH,
      `expected ${VERT_AISLE} > ${CHAIR_PADDED_WIDTH}`,
    );
  });

  it('plan(initial) is rejected – no complete turning route exists', () => {
    const sol = plan(initial);
    assert.strictEqual(
      sol.complete,
      false,
      'expected complete === false for the unmodified default layout',
    );
  });
});

// ─── 2. Translated layout: Table B shifted 40 cm right → route found ─────────
describe('Table B shifted +40 cm (vertical aisle 128 cm)', () => {
  const shiftedTables = initial.map(t =>
    t.id === 'B' ? { ...t, x: t.x + 40 } : t,
  );

  it('plan finds a complete route', () => {
    const sol = plan(shiftedTables);
    assert.strictEqual(sol.complete, true, 'expected complete === true after shifting Table B');
  });

  it('final heading is vertical (3π/2 ≈ 4.712)', () => {
    const sol = plan(shiftedTables);
    assert.ok(sol.path.length > 0, 'path must not be empty');
    const lastPose = sol.path[sol.path.length - 1];
    assert.strictEqual(lastPose.x, goal.x, `final x must equal goal.x (${goal.x})`);
    assert.strictEqual(lastPose.y, goal.y, `final y must equal goal.y (${goal.y})`);
    const PI_HALF  = Math.PI / 2;
    const PI_3HALF = 3 * Math.PI / 2;
    const nearHalf  = Math.abs(lastPose.a - PI_HALF)  < 1e-9;
    const near3Half = Math.abs(lastPose.a - PI_3HALF) < 1e-9;
    assert.ok(
      nearHalf || near3Half,
      `final heading ${lastPose.a} is not close to π/2 or 3π/2`,
    );
  });

  it('every consecutive step in the path passes sweepFits', () => {
    const sol  = plan(shiftedTables);
    const obs  = obstacles(shiftedTables);
    for (let i = 0; i < sol.path.length - 1; i++) {
      const ok = sweepFits(sol.path[i], sol.path[i + 1], obs);
      assert.ok(ok, `step ${i} failed sweepFits (${JSON.stringify(sol.path[i])} → ${JSON.stringify(sol.path[i+1])})`);
    }
  });
});

// ─── 3. Swept-footprint mid-arc regression ────────────────────────────────────
//
// Obstacle sits to the right of the chair centre.  Both endpoint poses clear
// it, but an intermediate orientation during the arc collides – a collision
// that endpoint-only checks would miss entirely.
describe('swept-footprint mid-arc regression', () => {
  const obstacle = { x: 372, y: 219, w: 1, h: 2 };
  const from     = { x: 300, y: 220, a: 0 };
  const to       = { x: 300, y: 220, a: Math.PI / 4 };
  const obs      = [obstacle];

  it('start endpoint fits (heading 0)', () => {
    assert.ok(
      poseFits(from.x, from.y, from.a, obs),
      'start pose should fit – obstacle is just outside the unrotated footprint',
    );
  });

  it('end endpoint fits (heading π/4)', () => {
    assert.ok(
      poseFits(to.x, to.y, to.a, obs),
      'end pose should fit – obstacle is just outside the π/4 footprint',
    );
  });

  it('sweepFits returns false – intermediate orientation collides', () => {
    assert.strictEqual(
      sweepFits(from, to, obs),
      false,
      'sweepFits must detect the mid-arc collision that endpoint checks miss',
    );
  });
});
