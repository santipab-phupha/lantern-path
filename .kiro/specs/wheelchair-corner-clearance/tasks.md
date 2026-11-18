# Implementation Plan: Wheelchair Corner Clearance

## Overview

Create `test/planner.test.js` and add an `npm test` script. The file imports from `src/planner.ts` directly using Node 24's native TypeScript type stripping. Three test groups cover default-layout rejection, translated-layout success, and the swept-footprint mid-arc collision regression. No source files are modified.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3", "4", "5"] },
    { "wave": 4, "tasks": ["6"] },
    { "wave": 5, "tasks": ["7"] }
  ]
}
```

## Relevant Files

- `test/planner.test.js` — new test file (to be created)
- `package.json` — add `"test"` script
- `src/planner.ts` — read-only reference; must not be modified

## Tasks

- [x] 1. Create `test/` directory and `test/planner.test.js`
  - Create the directory `test/` at the workspace root if it does not already exist.
  - Write `test/planner.test.js` as plain JavaScript (no TypeScript syntax) using only `node:test` and `node:assert`.
  - Add an import line `import { poseFits, sweepFits, plan, initial } from '../src/planner.ts';` at the top.
  - **Acceptance:** File exists at `test/planner.test.js` and can be parsed by Node without syntax errors.
  - _Requirements: 1.1, 1.3_

- [x] 2. Add `npm test` script to `package.json`
  - Open `package.json` and add `"test": "node --test"` to the `"scripts"` object.
  - **Acceptance:** `npm test` resolves to the node command without throwing a "missing script" error.
  - _Requirements: 1.2_

- [x] 3. Write test: default layout rejects the route
  - In `test/planner.test.js`, add a `test()` block that calls `plan(initial)` and asserts `sol.complete === false` with `assert.strictEqual`.
  - **Acceptance:** The test passes with `npm test` using the unmodified `initial` array.
  - _Requirements: 2.1, 2.2_

- [x] 4. Write test: translated layout finds a complete route
  - Add a `test()` block that constructs `shiftedTables` by mapping `initial` and adding 40 to `x` for the table whose `id === 'B'`.
  - Assert `sol.complete === true`.
  - Assert that the final `Pose` in `sol.path` has `a` within `1e-9` of `Math.PI / 2` or `(3 * Math.PI) / 2`.
  - **Acceptance:** Both assertions pass with `npm test`.
  - _Requirements: 3.1, 3.2_

- [x] 5. Write test: swept-footprint regression
  - Add a `test()` block using the exact fixture: `obstacle = { x: 372, y: 219, w: 1, h: 2 }`, `from = { x: 300, y: 220, a: 0 }`, `to = { x: 300, y: 220, a: Math.PI / 4 }`.
  - Assert `poseFits(from.x, from.y, from.a, [obstacle])` is truthy (start endpoint fits).
  - Assert `poseFits(to.x, to.y, to.a, [obstacle])` is truthy (end endpoint fits).
  - Assert `sweepFits(from, to, [obstacle])` is strictly `false` (mid-arc collision detected).
  - **Acceptance:** All three assertions pass with `npm test`.
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Run `npm test` and verify all tests pass
  - Execute `npm test` in the workspace root.
  - Confirm exit code is 0 and all test cases are reported as passing.
  - Record the exact output (number of passing tests, any warnings).
  - **Acceptance:** Exit code 0, zero failing tests.
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 7. Run `npm run build` and verify it still succeeds
  - Execute `npm run build` in the workspace root.
  - Confirm exit code is 0 and the `dist/` output is produced without errors.
  - **Acceptance:** Exit code 0; no TypeScript or Vite errors.
  - _Requirements: 5.1, 5.2_

## Notes

- Do not modify `src/planner.ts` or any other source file.
- Node 24.14.1 strips TypeScript types natively; no extra flag is needed. The `npm test` script is `node --test`, which discovers and runs `test/planner.test.js` and imports `../src/planner.ts` directly.
- The swept-footprint obstacle fixture must not be altered; it is specified to expose an exact geometric edge case.
