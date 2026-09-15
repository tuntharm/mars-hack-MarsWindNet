import type { CityLayout } from '../contracts/marswindnet.ts'
import { NX, NY } from '../contracts/marswindnet.ts'
import { cellCentre, gridIndex } from './grid.ts'

/** A 128×128 cell is solid iff its centre lies in a CFD obstacle. Pads and solar are not solid. */
export function pointInCfdObstacle(city: CityLayout, x: number, y: number): boolean {
  for (const obstacle of city.obstacles) {
    if (obstacle.role !== 'cfd') continue
    if (obstacle.kind === 'box') {
      const halfW = obstacle.width_m / 2
      const halfD = obstacle.depth_m / 2
      if (
        x >= obstacle.cx_m - halfW &&
        x <= obstacle.cx_m + halfW &&
        y >= obstacle.cy_m - halfD &&
        y <= obstacle.cy_m + halfD
      ) {
        return true
      }
    } else {
      const dx = x - obstacle.cx_m
      const dy = y - obstacle.cy_m
      if (dx * dx + dy * dy <= obstacle.radius_m * obstacle.radius_m) {
        return true
      }
    }
  }
  return false
}

export function buildFluidMask(city: CityLayout, nx: number = NX, ny: number = NY): boolean[] {
  const mask = new Array<boolean>(nx * ny)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const { x, y } = cellCentre(i, j, city.grid)
      mask[gridIndex(i, j, nx)] = !pointInCfdObstacle(city, x, y)
    }
  }
  return mask
}
