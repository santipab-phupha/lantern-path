# Tasks: Custom Room Builder

## Dependency graph

```
Wave 1: [1]              ← generalise planner.ts
Wave 2: [2]              ← scene.ts (depends on 1)
Wave 3: [3]              ← useEditor.ts (depends on 2)
Wave 4: [4, 5, 6]        ← UI components (depend on 3)
Wave 5: [7]              ← wire everything in App.tsx + style.css
Wave 6: [8]              ← tests
Wave 7: [9, 10]          ← verify npm test + npm run build
```

---

## Tasks

- [ ] 1. Add `planGeneral` to `planner.ts`
  - Export a new `planGeneral(options: PlanOptions): Solution` function that accepts room, obstacles, start, goal, chair, and an `anyHeading` flag.
  - Refactor `plan(tables)` to be a thin wrapper around `planGeneral` using the existing constants. All existing exports remain unchanged.
  - _Requirements: 5.4, 8.1, 8.2_

- [ ] 2. Create `src/scene.ts`
  - Define and export `Scene`, `SceneObject`, `PlanOptions` types.
  - Export `planScene(scene: Scene): Solution`.
  - Export `snapToGrid`, `newId`, `clampToRoom` helpers.
  - Export three example scenes: `EXAMPLE_BOOK_FAIR`, `EXAMPLE_NARROW_CORNER`, `EXAMPLE_EVENT_ROOM`.
  - _Requirements: 1.2, 3.3, 9.5, 9.6_

- [ ] 3. Create `src/useEditor.ts`
  - Full editor state hook using `useReducer`.
  - Actions: `setRoom`, `addObject`, `updateObject`, `removeObject`, `selectObject`, `setEntrance`, `setDestination`, `setChair`, `loadExample`, `reset`, `togglePlayback`, `frame`.
  - Solution derived with `useMemo(() => planScene(state.scene), [state.scene])`.
  - Animation loop reused from `useRoom.ts`.
  - _Requirements: 1.1, 1.3, 2.1–2.5, 3.1–3.2, 4.1–4.2, 5.1–5.2_

- [ ] 4. Create `src/ObjectPanel.tsx`
  - Inspector section rendered when a `SceneObject` is selected.
  - Fields: label, kind, x, y, width, height, delete button.
  - _Requirements: 2.2–2.6_

- [ ] 5. Create `src/Inspector.tsx`
  - Right-panel component: RouteSection, ObjectPanel (conditional), RoomSection, ChairSection, SimDisclaimer.
  - _Requirements: 3.1–3.2, 4.1–4.2, 5.3, 7.1–7.2_

- [ ] 6. Extend `src/FloorPlan.tsx`
  - Render all `SceneObject` items with drag + keyboard interaction.
  - Render entrance and destination markers as interactive SVG elements.
  - Apply colour scheme: wall = hatched gray, table = light gray, block = mid gray; selected = iOS blue.
  - _Requirements: 2.2, 6.1–6.3_

- [ ] 7. Rewrite `src/App.tsx` and extend `src/style.css`
  - App uses `useEditor` and renders `FloorPlan` + `Inspector`.
  - Header: brand, example picker dropdown, reset button.
  - Extend style.css with editor-specific classes (room-section, chair-section, object-panel, example-picker, sim-disclaimer).
  - _Requirements: 1.2, 1.3, 7.1–7.2_

- [ ] 8. Create `test/scene.test.js`
  - Import from `../src/scene.ts` and `../src/planner.ts`.
  - Test groups: custom geometry, obstacle add/remove, entrance/destination change, wheelchair size, corner collision, example layouts.
  - _Requirements: 9.1–9.6_

- [ ] 9. Run `npm test` — all tests (old + new) must pass (exit 0)

- [ ] 10. Run `npm run build` — must exit 0

## Notes

- Do not modify `test/planner.test.js` or `src/planner.ts` exported symbols.
- `planGeneral` internal grid constants (cols, rows, headings, step) derive from room dimensions: `cols = Math.ceil(room.w / step)`, `rows = Math.ceil(room.h / step)`.
- Example scenes must be self-contained (no reference to planner module constants).
