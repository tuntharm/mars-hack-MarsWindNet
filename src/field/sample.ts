import type { VelocityField } from '../contracts/marswindnet.ts'

/** Strict bilinear display-grid interpolation. Not a boundary observation. */
export function sampleVelocityAt(field: VelocityField | null, x: number, y: number): { u: number; v: number } | null {
  if (!field || !Number.isFinite(x) || !Number.isFinite(y)) return null
  const { nx, ny, dx_m, dy_m } = field.grid
  const gx = x / dx_m - 0.5
  const gy = y / dy_m - 0.5
  if (gx < 0 || gy < 0 || gx > nx - 1 || gy > ny - 1) return null
  const i0 = Math.floor(gx)
  const j0 = Math.floor(gy)
  const i1 = Math.min(i0 + 1, nx - 1)
  const j1 = Math.min(j0 + 1, ny - 1)
  const tx = gx - i0
  const ty = gy - j0
  const samples = [
    [j0 * nx + i0, (1 - tx) * (1 - ty)],
    [j0 * nx + i1, tx * (1 - ty)],
    [j1 * nx + i0, (1 - tx) * ty],
    [j1 * nx + i1, tx * ty],
  ]
  let u = 0
  let v = 0
  for (const [index, weight] of samples) {
    if (weight === 0) continue
    const su = field.u[index]
    const sv = field.v[index]
    if (!field.is_fluid[index] || typeof su !== 'number' || typeof sv !== 'number' || !Number.isFinite(su) || !Number.isFinite(sv)) return null
    u += weight * su
    v += weight * sv
  }
  return { u, v }
}
