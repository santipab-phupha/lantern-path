import type { Scene, SceneObject } from "./scene";
import { furniture, type FurnitureKind } from "./furniture.ts";

function piece(id: string, kind: FurnitureKind, x: number, y: number, w: number, h: number, label: string = furniture[kind].label): SceneObject {
  return { id, kind, label, x, y, w, h };
}

// Each wing opens onto the long gallery. The reading room at the east end
// requires a turn off the gallery, so moving its furniture affects the route.
export const countryHouse: Scene = {
  room: { w: 3200, h: 1600 },
  floorInsets: [{ y: 658, h: 284 }],
  zones: [
    { name: "Guest suite",   x: 400,  y: 475 },
    { name: "Dining room",   x: 1200, y: 475 },
    { name: "Drawing room",  x: 2000, y: 475 },
    { name: "Reading room",  x: 2800, y: 475 },
    { name: "Grand gallery", x: 1510, y: 745 },
    { name: "Studio",        x: 400,  y: 1175 },
    { name: "Morning room",  x: 1200, y: 1175 },
    { name: "Library",       x: 2000, y: 1175 },
    { name: "Primary suite", x: 2800, y: 1175 },
  ],
  obstacles: [
    ...[800, 1600, 2400].flatMap(x => [
      piece(`north-${x}`, "wall", x, 0, 18, 640),
      piece(`south-${x}`, "wall", x, 960, 18, 640),
    ]),
    ...[0, 800, 1600, 2400].flatMap(x => [
      piece(`north-left-${x}`, "wall", x, 640, 290, 18),
      piece(`north-right-${x}`, "wall", x+510, 640, 290, 18),
      piece(`south-left-${x}`, "wall", x, 942, 290, 18),
      piece(`south-right-${x}`, "wall", x+510, 942, 290, 18),
    ]),
    piece("guest-bed", "bed", 200, 55, 220, 250, "Guest bed"),
    piece("guest-wardrobe", "wardrobe", 545, 65, 195, 82),
    piece("guest-plant", "plant", 63, 510, 90, 90),
    piece("dining-table", "table", 985, 100, 400, 205, "Dining table"),
    piece("dining-cabinet", "wardrobe", 1420, 60, 142, 70, "Sideboard"),
    piece("drawing-sofa", "sofa", 1790, 75, 330, 135),
    piece("drawing-chair", "armchair", 2195, 240, 118, 124),
    piece("drawing-table", "table", 1850, 268, 195, 105, "Coffee table"),
    piece("reading-desk", "desk", 2480, 70, 215, 110),
    piece("reading-shelf", "bookcase", 2800, 38, 325, 75),
    piece("reading-plant", "plant", 3020, 490, 100, 100),
    piece("studio-desk", "desk", 140, 1320, 255, 125),
    piece("studio-shelf", "bookcase", 510, 1490, 235, 65),
    piece("morning-sofa", "sofa", 1000, 1360, 320, 132),
    piece("morning-chair", "armchair", 1405, 1270, 115, 120),
    piece("morning-plant", "plant", 864, 1475, 90, 90),
    piece("library-shelf", "bookcase", 1680, 1470, 295, 70),
    piece("library-desk", "desk", 2100, 1320, 235, 120),
    piece("primary-bed", "bed", 2630, 1260, 245, 280, "Primary bed"),
    piece("primary-wardrobe", "wardrobe", 2940, 1460, 205, 80),
  ],
  entrance: { x: 104, y: 820, a: 0 },
  destination: { x: 2824, y: 292 },
  chair: { width: 70, length: 116, margin: 4 },
  anyHeading: true,
};

// The midnight reception has a banquet table across the reading-room door.
export const midnightManor: Scene = {
  ...countryHouse,
  obstacles: countryHouse.obstacles.map(object => object.id === "dining-table"
    ? { ...object, x: 2600, y: 664 } : object),
};
