# Design Document

## Overview

This document describes the technical approach for adding a Node.js test suite to `make-room` that exercises `src/planner.ts` via its existing public exports. No new runtime dependencies are introduced. The test file is written as plain JavaScript so Node 24.14.1's native TypeScript type-stripping can load the TypeScript source directly without a build step.

## Architecture

### Component Interactions

```
npm test
  └─ node --test
       └─ test/planner.test.js          (new file, plain JS, node:test + node:assert)
            └─ import ../src/planner.ts  (Node strips TS types at load time)
                 ├─ poseFits()
                 ├─ sweepFits()
                 ├─ plan()
                 └─ initial, start, goal, chair constants
```

The test file is the only new artifact. `package.json` gains one script entry. `src/planner.ts` is not modified.

### Runtime Prerequisites

Node 24.14.1 enables TypeScript type stripping by default, so `import` resolves `.ts` files by stripping type annotations before evaluation with no CLI flag required. No `tsconfig.json` changes are needed for the test runner because Vite/tsc only runs during `npm run build`.

## Components and Interfaces

| Component | Type | Description |
|---|---|---|
| `test/planner.test.js` | New file | Node.js test suite; imports from `../src/planner.ts` |
| `package.json` `"test"` script | Modified entry | Runs `node --test` |
| `src/planner.ts` | Unchanged | Existing module; exports `poseFits`, `sweepFits`, `plan`, and constants |

## Component Design

### `test/planner.test.js`

The file uses `node:test` (`test`, `describe`) and `node:assert` (`strictEqual`, `ok`). All test cases import the named exports from `../src/planner.ts`.

#### Test group 1 — Default layout rejects the route

```js
import { plan, initial } from '../src/planner.ts';

test('default layout: plan returns complete === false', () => {
  const sol = plan(initial);
  assert.strictEqual(sol.complete, false);
});
```

This asserts Requirement 2.1. No geometry is changed; the default `initial` array is used verbatim.

#### Test group 2 — Translated layout finds a complete route

Table B is shifted 40 cm right by constructing a new array:

```js
const shiftedTables = initial.map(t =>
  t.id === 'B' ? { ...t, x: t.x + 40 } : t
);
const sol = plan(shiftedTables);
assert.strictEqual(sol.complete, true);
```

The final heading check (Requirement 3.2) reads the last pose from `sol.path` and verifies `a` is within `1e-9` of `Math.PI / 2` or `Math.PI * 3 / 2` (headings 2 and 6 at `headingStep = 2π/8`):

```js
const last = sol.path[sol.path.length - 1];
const h2 = Math.PI / 2;
const h6 = (3 * Math.PI) / 2;
assert.ok(Math.abs(last.a - h2) < 1e-9 || Math.abs(last.a - h6) < 1e-9);
```

#### Test group 3 — Swept-footprint regression

The isolated fixture from the specification:

```js
const obstacle = { x: 372, y: 219, w: 1, h: 2 };
const from = { x: 300, y: 220, a: 0 };
const to   = { x: 300, y: 220, a: Math.PI / 4 };

// Both endpoints must fit (collision is only mid-arc)
assert.ok(poseFits(from.x, from.y, from.a, [obstacle]), 'start pose fits');
assert.ok(poseFits(to.x,   to.y,   to.a,   [obstacle]), 'end pose fits');

// The sweep must collide
assert.strictEqual(sweepFits(from, to, [obstacle]), false);
```

This satisfies Requirements 4.1–4.3 and documents the regression clearly.

### `package.json` change

Add to the `"scripts"` block:

```json
"test": "node --test"
```

Node 24.14.1 strips TypeScript types by default; no extra flag is needed. `node --test` discovers test files automatically and loads `../src/planner.ts` via native type stripping.

## Data Models

No new data models are introduced. The test file consumes the existing exported types (`Pose`, `Rectangle`, `Table`, `Solution`) only as values; TypeScript type annotations are absent in the `.js` test file.

## Error Handling

Each `assert` call throws if the condition is not met; `node --test` captures the thrown `AssertionError` and reports the failing test with its message. No additional error-handling wrappers are needed.

## Testing Strategy

The test suite is the entire deliverable. Each of the three test groups maps directly to a requirements group, so passing `npm test` is the acceptance criterion for this feature. `npm run build` verifies that no source files were broken.

## Correctness Properties

### Property 1: Default layout always rejects
For any call to `plan(initial)`, the result satisfies `complete === false` (the default layout is always blocked).
**Validates: Requirements 2.1**

### Property 2: Translated layout always succeeds
For `plan(initial.map(t => t.id === 'B' ? {...t, x: t.x + 40} : t))`, the result satisfies `complete === true` and the final path pose has `a` equal to `Math.PI / 2` or `3 * Math.PI / 2`.
**Validates: Requirements 3.1, 3.2**

### Property 3: Sweep catches mid-arc collision
For the obstacle `{ x: 372, y: 219, w: 1, h: 2 }` and rotation from 0 to π/4 at center (300, 220): `poseFits` returns `true` for both endpoint poses, and `sweepFits` returns `false` for the transition.
**Validates: Requirements 4.1, 4.2, 4.3**
