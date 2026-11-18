# Design: Custom Room Builder

## Overview

We generalise the existing planner and UI to work with a user-defined `Scene` instead of hard-coded constants. The original `plan()` function is wrapped by a new `planScene()` that accepts the full scene as input. The React layer is restructured around a single `useEditor` hook that owns the mutable scene state. The existing `App.tsx` / `useRoom.ts` are replaced by the new editor; the original planning constants remain exported from `planner.ts` so the existing tests keep passing.

---

## Architecture

```
src/
  planner.ts          ← unchanged public API (poseFits, sweepFits, plan, constants)
  scene.ts            ← NEW: Scene type, planScene(), example layouts, helpers
  useEditor.ts        ← NEW: full editor state hook (replaces useRoom.ts)
  App.tsx             ← REPLACED: editor shell with layout panel + inspector
  FloorPlan.tsx       ← EXTENDED: renders custom obstacles, entry/goal markers
  Inspector.tsx       ← NEW: right-panel with controls (replaces inline JSX)
  ObjectPanel.tsx     ← NEW: selected-object editor (dimensions, label, delete)
  style.css           ← EXTENDED: new editor classes on top of iOS theme
  main.tsx            ← unchanged

test/
  planner.test.js     ← UNCHANGED (existing 9 tests)
  scene.test.js       ← NEW: tests for scene.ts and planScene()
```

---

## Data Model

### `Scene`

```ts
interface Scene {
  room:        { w: number; h: number };          // cm
  obstacles:   SceneObject[];
  entrance:    { x: number; y: number; a: number }; // cm, radians
  destination: { x: number; y: number };
  chair:       { width: number; length: number; margin: number };
}
```

### `SceneObject`

```ts
interface SceneObject {
  id:    string;          // stable uuid-style key
  kind:  'wall' | 'table' | 'block';
  label: string;          // display name
  x: number; y: number;  // top-left corner, cm
  w: number; h: number;  // dimensions, cm
}
```

---

## `scene.ts` — new module

### `planScene(scene: Scene): Solution`

Builds the obstacle array `[...scene.obstacles]` and calls the generalised planner. The generalised planner is extracted into an internal `planGeneral()` that accepts:

```ts
planGeneral(options: {
  room:        { w: number; h: number };
  obstacles:   readonly Rectangle[];
  start:       Pose;
  goal:        { x: number; y: number };
  chair:       { width: number; length: number; margin: number };
  anyHeading?: boolean;   // if true, accept any heading at goal
}): Solution
```

The existing `plan()` calls `planGeneral()` with its hard-coded constants so backward compatibility is preserved.

### Example layouts

Three `Scene` objects are exported:

| Key | Description | Expected outcome |
|---|---|---|
| `EXAMPLE_BOOK_FAIR` | Original layout (wall + Table A + Table B). | `complete: false` |
| `EXAMPLE_NARROW_CORNER` | 400×400 cm room, L-shaped corner made of two wall objects; both straight corridors 100 cm wide (wider than padded chair 78 cm) but the turn is too tight. Moving the inner wall 50 cm back opens the route. | `complete: false` default |
| `EXAMPLE_EVENT_ROOM` | 600×500 cm room, five tables and two walls arranged so the destination is reachable if one central table is removed or shifted. | `complete: false` default |

---

## `useEditor.ts`

Owns the full editor state using `useReducer`:

```
State {
  scene:      Scene
  selected:   string | null       // SceneObject id, or 'entrance'/'destination'
  playback:   Playback
  chairPose:  Pose
  feedback:   string
}
```

Actions mirror the requirements: `setRoom`, `addObject`, `updateObject`, `removeObject`, `selectObject`, `setEntrance`, `setDestination`, `setChair`, `loadExample`, `reset`, `togglePlayback`, `frame`.

The solution is derived via `useMemo(() => planScene(state.scene), [state.scene])`.

Animation reuses the existing animation loop from `useRoom.ts`.

---

## `App.tsx` (new shell)

```
<header>  brand + example picker + reset button
<main>
  <div class="studio">
    <FloorPlan />         ← left panel (flex 1)
    <Inspector />         ← right panel (320px)
      <RouteSection />    outcome + run button
      <ObjectPanel />     selected object editor (conditional)
      <RoomSection />     room dimensions
      <ChairSection />    wheelchair dimensions
      <SimDisclaimer />   grid/heading note + certification disclaimer
```

On narrow viewports (< 860 px) the inspector stacks below the floor plan, using a two-column grid for RouteSection and ObjectPanel.

---

## `FloorPlan.tsx` extensions

- Renders all `SceneObject` items using the existing drag/keyboard interaction pattern.
- Renders the entrance marker (arrow) and destination marker (circle) as interactive elements that can be clicked to select/reposition.
- Colour scheme: wall = `#ebebf0` hatched, table = `#f2f2f7`, block = `#e8e8ed`.
- Selected highlight: `#ddeeff` fill + `#007aff` stroke (iOS blue, same as before).
- Destination ring uses `#34c759` (iOS green) when route is complete, `#ff3b30` (iOS red) when blocked.

---

## `ObjectPanel.tsx`

Shown in the inspector when a SceneObject is selected. Fields:

- Label (text input)
- Kind selector (wall / table / block)
- X, Y (number inputs, cm)
- Width, Height (number inputs, cm, min 10)
- Delete button

All changes dispatch `updateObject`. Delete dispatches `removeObject` and clears the selection.

---

## Planner generalisation strategy

`planner.ts` keeps every existing export unchanged. We add one new export:

```ts
export function planGeneral(options: PlanOptions): Solution
```

`plan(tables)` becomes a thin wrapper:

```ts
export function plan(tables) {
  return planGeneral({ room, obstacles: [wall, ...tables], start, goal, chair, anyHeading: false });
}
```

This satisfies Requirement 8.1 (book-fair example unchanged) and 8.2 (existing tests pass).

---

## Grid snap helpers (`scene.ts`)

```ts
function snapToGrid(v: number, step = 8): number  // round to nearest grid cell
function clamp(v: number, lo: number, hi: number): number
function newId(): string                           // crypto.randomUUID() or fallback
```

---

## Test file: `test/scene.test.js`

Uses `node:test` + `node:assert`, imports from `../src/scene.ts` and `../src/planner.ts`.

| Test group | Cases |
|---|---|
| `planScene – custom room geometry` | Small 200×200 room: entrance and destination with no obstacles → complete. |
| `planScene – obstacle blocks path` | Add a wall that cuts off the destination → blocked; remove it → complete. |
| `planScene – entrance/destination changes` | Moving destination outside reachable area → blocked. |
| `planScene – wheelchair size` | Increase chair width to 180 cm in a 200 cm corridor → blocked. |
| `planScene – corner collision` | Narrow Corner example default → blocked; widen corner → complete. |
| `Example layouts` | BOOK_FAIR → blocked; NARROW_CORNER → blocked; EVENT_ROOM → blocked; shift one object in EVENT_ROOM → complete. |

---

## Backward compatibility

- `planner.ts` exports: `room`, `wall`, `initial`, `start`, `goal`, `chair`, `poseFits`, `shortestTurn`, `sweepFits`, `plan`, `planGeneral` — all prior exports unchanged.
- `useRoom.ts` can remain or be deprecated; `useEditor.ts` supersedes it in the UI.
- `test/planner.test.js` imports only from `planner.ts` — it is not touched.
