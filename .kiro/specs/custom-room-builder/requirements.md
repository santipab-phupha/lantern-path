# Requirements: Custom Room Builder

## Introduction

Extend Make Room so users can design and test their own floor plans, while keeping the existing book-fair example intact. Users set the room dimensions, place rectangular obstacles (walls, tables, or generic blocks), choose the entrance and destination, adjust wheelchair dimensions, and run the simulation to discover whether a complete route exists.

---

## 1  Layout Management

### 1.1 — Room dimensions
The user can set the room width and height (in cm). Both values must be at least 100 cm. The planner grid updates when dimensions change.

### 1.2 — Example layouts
At least three named example layouts are available to load at any time:
- **Book Fair** – the original layout (Table A, Table B, fixed corner wall).
- **Narrow Corner** – two corridors each wide enough for straight travel, but the turn radius blocks a complete route until one wall is moved.
- **Event Room** – multiple tables and walls; moving one obstacle changes the route from blocked to complete.

### 1.3 — Reset
A reset action restores all fields to the state of the most recently loaded example (or the default Book Fair if none was loaded).

---

## 2  Obstacle Editing

### 2.1 — Add obstacle
The user can add a new rectangular obstacle (type: wall, table, or block) by clicking an "Add" button. It appears at a default position inside the room, free of collisions with existing obstacles.

### 2.2 — Select obstacle
Clicking an obstacle on the floor plan selects it and opens an edit panel. The selected obstacle is visually highlighted.

### 2.3 — Move obstacle
A selected obstacle can be dragged on the floor plan or nudged with arrow controls. It must not overlap other obstacles.

### 2.4 — Resize obstacle
The edit panel shows width and height fields (numeric, in cm). Editing them live-updates the floor plan.

### 2.5 — Remove obstacle
A selected obstacle can be deleted. The entrance, destination, and wheelchair start pose must remain clear after deletion.

### 2.6 — Obstacle types
Each obstacle carries a display label (wall, table, block) that appears on the floor plan.

---

## 3  Entrance & Destination

### 3.1 — Entrance position
The user can set the wheelchair's start position (x, y in cm) and initial heading (one of the 8 discrete headings). The position must be inside the room and clear of all obstacles.

### 3.2 — Destination position
The user can set the destination (x, y in cm). The position must be inside the room and on a grid cell. The planner snaps it to the nearest 8 cm grid point.

### 3.3 — Arrival heading constraint
The planner accepts any heading at the destination (not just the two vertical headings hard-coded for the book-fair goal). The user can optionally restrict accepted headings.

---

## 4  Wheelchair Dimensions

### 4.1 — Configurable size
The user can edit the wheelchair body width, body length, and clearance margin (all in cm, minimum 1 cm each). Defaults match the existing model (70 × 116 cm, 4 cm margin).

### 4.2 — Live update
Changing any wheelchair dimension immediately reruns the planner and updates the floor plan.

---

## 5  Simulation

### 5.1 — Auto-replan
The route is recalculated automatically whenever the room, obstacles, entrance, destination, or wheelchair dimensions change. The previous path is cleared during recalculation.

### 5.2 — Animated playback
A "Run" button animates the wheelchair moving along the planned path. The existing animation logic is reused.

### 5.3 — Route status
The UI clearly labels the outcome as **Route found** (complete path to destination) or **Route blocked** (partial path). Both states are visually distinct.

### 5.4 — Swept-footprint check
The planner checks the full swept footprint during translations and rotations — not just endpoint poses — using the existing `sweepFits` function.

---

## 6  Floor Plan Interaction

### 6.1 — Drag on canvas
Obstacles can be dragged directly on the SVG floor plan.

### 6.2 — Click to select
Clicking an obstacle on the floor plan selects it and brings up its edit controls.

### 6.3 — Entrance/destination markers
Entrance and destination are visible on the floor plan at all times and update live as the user edits their positions.

---

## 7  Simulation Transparency

### 7.1 — Grid and heading disclaimer
The interface explains that the simulation uses an 8 cm grid and 8 discrete headings (45° steps), so a navigable path may be missed because of the model's resolution.

### 7.2 — Not a certification
The interface states that the result is a simulation and must not be treated as an accessibility certification.

---

## 8  Existing Functionality Preserved

### 8.1 — Book-fair example
The original Book Fair layout remains available and produces the same planning results as before.

### 8.2 — Existing tests pass
All nine tests in `test/planner.test.js` continue to pass after every change.

### 8.3 — Build passes
`npm run build` exits 0 after all changes.

---

## 9  Automated Tests

### 9.1 — Custom room geometry
Tests verify that changing room dimensions changes the grid boundaries used by the planner.

### 9.2 — Obstacle edits
Tests verify that adding an obstacle blocks a previously open path, and removing it reopens the path.

### 9.3 — Entrance and destination changes
Tests verify that moving the entrance or destination to a different position can change the solution outcome.

### 9.4 — Wheelchair size
Tests verify that increasing wheelchair dimensions causes a formerly passable narrow corridor to be rejected.

### 9.5 — Corner collision
Tests verify the Narrow Corner example: default configuration is blocked; widening the corner opens the route.

### 9.6 — Example layouts
Tests verify that each named example produces the documented expected outcome (blocked / complete).
