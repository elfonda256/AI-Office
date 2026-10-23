export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;

export interface Point {
  x: number;
  y: number;
}

export function gridToScreen(gx: number, gy: number, originX: number, originY: number): Point {
  return {
    x: (gx - gy) * (TILE_WIDTH / 2) + originX,
    y: (gx + gy) * (TILE_HEIGHT / 2) + originY,
  };
}

export function screenToGrid(sx: number, sy: number, originX: number, originY: number): Point {
  const dx = sx - originX;
  const dy = sy - originY;
  const gx = (dx / (TILE_WIDTH / 2) + dy / (TILE_HEIGHT / 2)) / 2;
  const gy = (dy / (TILE_HEIGHT / 2) - dx / (TILE_WIDTH / 2)) / 2;
  return {
    x: Math.round(gx),
    y: Math.round(gy),
  };
}

export function calculateDepth(gx: number, gy: number, layerOffset: number = 0): number {
  return Math.round((gx + gy) * 100 + layerOffset);
}
