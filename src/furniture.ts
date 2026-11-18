export const furniture = {
  bed:      { label: "Bed",        w: 180, h: 210 },
  sofa:     { label: "Sofa",       w: 225, h: 100 },
  table:    { label: "Table",      w: 240, h: 130 },
  desk:     { label: "Desk",       w: 160, h: 80 },
  wardrobe: { label: "Wardrobe",   w: 160, h: 70 },
  bookcase: { label: "Bookcase",   w: 180, h: 45 },
  armchair: { label: "Armchair",   w: 95,  h: 100 },
  plant:    { label: "Plant",      w: 80,  h: 80 },
  wall:     { label: "Wall",       w: 220, h: 20 },
  block:    { label: "Block",      w: 100, h: 80 },
} as const;

export type FurnitureKind = keyof typeof furniture;
export const furnitureKinds = Object.keys(furniture) as FurnitureKind[];
