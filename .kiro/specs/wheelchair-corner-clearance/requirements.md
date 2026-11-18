# Requirements Document

## Introduction

Add an automated test suite for `src/planner.ts` that verifies route-planning behaviour under two specific table layouts. The tests run on Node 24.14.1 using native TypeScript type stripping and Node's built-in test runner with no extra dependencies. The existing planner geometry, UI, and runtime behaviour must remain unchanged.

## Requirements

### 1. Test Infrastructure

#### 1.1
The project MUST have a `test/planner.test.js` file that imports directly from `../src/planner.ts` using Node's native TypeScript type-stripping support (no transpilation step, no external test framework).

#### 1.2
`package.json` MUST include a `"test"` script that runs `node --test` so `npm test` executes the suite.

#### 1.3
The test file MUST use only Node's built-in `node:test` and `node:assert` modules; no new runtime or dev dependencies may be added.

### 2. Default-Layout Route Rejection

#### 2.1
When `plan` is called with the default `initial` table array (Table A at x=10 y=312, Table B at x=368 y=0), the returned `Solution` MUST have `complete === false`.

#### 2.2
The default aisle widths — 120 cm from the fixed wall bottom (y=192) to Table A top (y=312), and 88 cm from the fixed wall right (x=280) to Table B left (x=368) — are both wider than the padded chair width of 78 cm (70 cm + 4 cm margin each side), so corridor clearance alone does not explain the rejection; the route must be rejected because a full turning path to the goal cannot be completed within the grid/heading constraints.

### 3. Translated-Layout Route Success

#### 3.1
When Table B is moved 40 cm to the right (x=408 y=0) and `plan` is called with that modified table array, the returned `Solution` MUST have `complete === true`.

#### 3.2
When `complete === true` the returned `path` array MUST be non-empty and the final `Pose` in the path MUST have heading index 2 or 6 (i.e. `a` ≈ π/2 or ≈ 3π/2, within floating-point tolerance), matching the goal-arrival check in `plan`.

### 4. Swept-Footprint Collision Regression

#### 4.1
Given a chair pose at center (300, 220) rotating from heading 0 to heading π/4 (one heading step), and a thin obstacle `{ x: 372, y: 219, w: 1, h: 2 }`, `sweepFits` MUST return `false`.

#### 4.2
Both the start pose (heading 0) and the end pose (heading π/4) must individually pass `poseFits` with that obstacle (i.e. the collision occurs only during the intermediate arc, not at the endpoints), confirming that the sweep check catches what an endpoint-only check would miss.

#### 4.3
The test MUST use the obstacle fixture exactly as specified: `{ x: 372, y: 219, w: 1, h: 2 }`. No other obstacle geometry is acceptable for this regression.

### 5. Preservation of Existing Behaviour

#### 5.1
All exported symbols from `src/planner.ts` (`room`, `wall`, `initial`, `start`, `goal`, `chair`, `poseFits`, `shortestTurn`, `sweepFits`, `plan`, and the TypeScript interfaces) MUST remain exported and functionally unchanged after any edits made to satisfy requirements 1–4.

#### 5.2
`npm run build` MUST continue to exit with code 0 after all changes are applied.
