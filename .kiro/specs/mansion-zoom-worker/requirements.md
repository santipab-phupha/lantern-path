# Requirements: Mansion Example, Zoom/Pan, Async Planner

## 1  Mansion Example

### 1.1
Add `EXAMPLE_MANSION` to `scene.ts`: a ~2000×1600 cm (20 m × 16 m) floor plan with named rooms, wide halls, furniture, one entrance and one destination. The default route must be **complete**. A named obstacle (`mn-blocker`) placed in a doorway must make the route **blocked**; removing it reopens it.

### 1.2
`EXAMPLE_MANSION` becomes the initial example loaded in `useEditor.ts` (replacing Book Fair as the default).

### 1.3
All three prior examples (Book Fair, Narrow Corner, Event Room) remain available and their existing test assertions continue to pass.

---

## 2  Performance: Async Planner

### 2.1
The 20 m × 16 m grid has ~400 000 nodes; a full BFS scan takes ~290 ms on the main thread. The UI **must not block** the main thread during planning. Planning runs in a Web Worker.

### 2.2
The worker receives `PlanOptions` and returns a `Solution`. The worker file is `src/plannerWorker.ts`, compiled by Vite as a worker module.

### 2.3
While planning is in progress (worker busy), the UI shows a **"Calculating…"** indicator in the route-check section and disables the Run button.

### 2.4
When the layout changes (obstacles moved/added/removed, room size changed, chair dimensions changed), the in-flight worker task is cancelled and a new one is started. The displayed result always matches the current layout.

### 2.5
An incomplete result (worker cancelled mid-run) is **never** displayed as the route status. The status updates only when the worker returns a full result for the current layout.

### 2.6
The original synchronous `planGeneral` and `planScene` remain exported from `planner.ts` / `scene.ts` unchanged so existing tests keep passing.

---

## 3  Zoom, Pan, Reset-to-Fit

### 3.1
The floor-plan SVG supports pinch-to-zoom and scroll-to-zoom. Zoom range: 0.1× to 10×.

### 3.2
The plan supports drag-to-pan (two-finger drag on touch, middle-mouse or space+drag on desktop).

### 3.3
A "Fit" button (or toolbar icon) resets the viewport to show the entire floor plan inside the drawing area.

### 3.4
Obstacle selection and drag remain pixel-accurate at any zoom level and on both desktop and mobile.

### 3.5
The floor plan fits the full mansion in the initial view without manual panning.

---

## 4  Preserved behaviour

### 4.1  Existing 29 tests pass without modification.
### 4.2  `npm run build` exits 0.
### 4.3  English iOS-inspired UI, full swept-footprint collision checks, grid-resolution disclaimer.
### 4.4  Route status is "Route found" or "Route blocked" — never claims accessibility certification.
