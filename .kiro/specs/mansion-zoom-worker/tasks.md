# Tasks: Mansion, Zoom/Pan, Async Planner

- [x] 1. Add `EXAMPLE_MANSION` to `src/scene.ts` and make it the default in `useEditor.ts`
- [x] 2. Create `src/plannerWorker.ts` (Web Worker that runs `planGeneral`)
- [x] 3. Replace `useMemo(planScene)` in `useEditor.ts` with an async worker-based hook; add "Calculating…" state
- [x] 4. Add zoom/pan/fit to `src/FloorPlan.tsx` using SVG `viewBox` transforms
- [x] 5. Add zoom toolbar buttons (zoom-in, zoom-out, fit) to the floor plan panel in `App.tsx` / `style.css`
- [x] 6. Add mansion + blocker tests to `test/scene.test.js`
- [x] 7. Run `npm test` — all tests pass
- [x] 8. Run `npm run build` — exits 0
