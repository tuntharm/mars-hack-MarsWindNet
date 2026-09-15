import {
  DX_M,
  DY_M,
  FIRST_CENTRE_M,
  NX,
  NY,
  type GridMeta,
} from '../contracts/marswindnet.ts'

export function gridIndex(i: number, j: number, nx: number = NX): number {
  return j * nx + i
}

export function cellCentre(
  i: number,
  j: number,
  grid: Pick<GridMeta, 'dx_m' | 'dy_m'> = { dx_m: DX_M, dy_m: DY_M },
): { x: number; y: number } {
  return {
    x: (i + 0.5) * grid.dx_m,
    y: (j + 0.5) * grid.dy_m,
  }
}

export function nearestCell(
  x: number,
  y: number,
  nx: number = NX,
  ny: number = NY,
): { i: number; j: number } {
  const i = Math.max(0, Math.min(nx - 1, Math.round((x - FIRST_CENTRE_M) / DX_M)))
  const j = Math.max(0, Math.min(ny - 1, Math.round((y - FIRST_CENTRE_M) / DY_M)))
  return { i, j }
}

export function cellCount(nx: number = NX, ny: number = NY): number {
  return nx * ny
}
