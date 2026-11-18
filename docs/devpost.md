# Lantern Path

**Category** — Frankenstein

**Elevator pitch** — Move a table on a floor plan and see whether a wheelchair can make the turn. Lantern Path finds and tests a furniture move when a route is blocked.

## Inspiration

Imagine setting up a book fair. You measure the two aisles leading to a booth and both are wider than the wheelchair. Can a visitor actually turn the corner? In our Book Fair layout, the padded chair is 78 cm wide and the aisles measure 120 cm and 88 cm. The chair fits down either aisle, yet the simulation stops at the bend. I built Lantern Path so someone arranging a room can catch that problem while the furniture is still on a screen.

## What it does

Midnight Manor opens on the evening of a reception. A dining table blocks the turn into the reading room. Follow the amber dashed line to see how far the chair can get. A dashed outline shows where the table could go, and the suggestion gives the distance and direction. Move the table 200 cm to the right and run the simulation again. This time the chair can turn into the room.

Visitors can also drag furniture themselves, add objects from the library, and change the wheelchair dimensions and clearance margin. When the search cannot find a working single move among the positions it tests, it says so.

## Why Frankenstein

I combined the direct manipulation of a room-layout editor with the motion planning used to steer a rigid body around obstacles. The floor plan supplies the collision geometry. The planner feeds a physical edit back to the designer: which piece to move, in which direction, and how far. The haunted manor gives that exchange a visual language. Amber light marks where the route stops, and a continuous illuminated path shows when the chair can reach its destination.

## How I built it and used Kiro

I used Kiro IDE to turn the Book Fair corner into a spec and regression tests. Two cases anchor the spec: the original corner blocks the chair, and shifting Table B 40 cm right opens a route. A third case catches a subtler error. The wheelchair fits at both ends of a 45-degree turn, but its corner sweeps across a small obstacle halfway through. Writing that case down gave me a concrete way to check the turning model as the project grew.

I also used Kiro specs for the editable room builder and the mansion's zoom and background planner. The resulting React and TypeScript app draws the plan in SVG and runs route searches in a browser worker. I used Codex to refine the interface and implement the Halloween presentation and verified furniture suggestions. The original Kiro specs and their tests are included in the repository.

## What I learned and what's next

The most revealing moment was watching a turn fail after both end positions passed their checks. It changed what I wanted the editor to show: the motion through the corner and one specific change a room organizer could try. The current model uses an 8 cm grid and eight headings. My next step would be to compare its predictions with measured layouts and feedback from wheelchair users and venue staff.

**Built with** — Kiro IDE, React, TypeScript, Vite, SVG, Web Workers, Node.js test runner.
