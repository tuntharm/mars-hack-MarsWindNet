import type { ColourKind, Obstacle, VelocityField } from '../contracts/marswindnet'
import { colourForValue } from '../field/colour'
export type XY = [number, number]
export function toWorld(x: number, y: number, z = 0): [number, number, number] { return [x, z, -y] }

/** Supported domain is the convex hull of the supplied cell centres. No edge extrapolation. */
export function sampleVelocity(field: VelocityField, x: number, y: number): XY | null {
  const { nx, ny, dx_m, dy_m } = field.grid
  const gx = x / dx_m - .5, gy = y / dy_m - .5
  if (!Number.isFinite(gx + gy) || gx < 0 || gy < 0 || gx > nx - 1 || gy > ny - 1) return null
  const i = Math.min(nx - 2, Math.floor(gx)), j = Math.min(ny - 2, Math.floor(gy))
  const tx = gx - i, ty = gy - j
  const ids = [j * nx + i, j * nx + i + 1, (j + 1) * nx + i, (j + 1) * nx + i + 1]
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty]
  let u = 0, v = 0
  for (let k = 0; k < 4; k++) {
    const id = ids[k], a = field.u[id], b = field.v[id]
    if (field.is_fluid[id] !== true || a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) return null
    u += a * weights[k]; v += b * weights[k]
  }
  return [u, v]
}

/** Closed solid footprints, including tangency. Slab test also detects long segments. */
export function segmentHitsObstacle(obstacles: Obstacle[], from: XY, to: XY): boolean {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  for (const o of obstacles) {
    if (o.role !== 'cfd') continue
    if (o.kind === 'box') {
      const bounds = [[o.cx_m - o.width_m / 2, o.cx_m + o.width_m / 2], [o.cy_m - o.depth_m / 2, o.cy_m + o.depth_m / 2]]
      let lo = 0, hi = 1
      for (let axis = 0; axis < 2; axis++) {
        const d = axis === 0 ? dx : dy, p = from[axis]
        if (Math.abs(d) < 1e-12) { if (p < bounds[axis][0] || p > bounds[axis][1]) { hi = -1; break } }
        else { const a = (bounds[axis][0] - p) / d, b = (bounds[axis][1] - p) / d; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)) }
      }
      if (hi >= lo) return true
    } else {
      const length2 = dx * dx + dy * dy
      const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((o.cx_m - from[0]) * dx + (o.cy_m - from[1]) * dy) / length2))
      if ((from[0] + t * dx - o.cx_m) ** 2 + (from[1] + t * dy - o.cy_m) ** 2 <= o.radius_m ** 2) return true
    }
  }
  return false
}

/** RK2 with adaptive distance bound. Wall collision checks include both midpoint legs. */
export function advanceParticle(field: VelocityField, obstacles: Obstacle[], start: XY, dt: number): XY | null {
  let p: XY = start, remaining = dt
  const limit = Math.min(field.grid.dx_m, field.grid.dy_m) * .45
  if (segmentHitsObstacle(obstacles, p, p)) return null
  for (let step = 0; remaining > 1e-9 && step < 128; step++) {
    const a = sampleVelocity(field, ...p)
    if (!a) return null
    const speed = Math.hypot(...a)
    if (speed < 1e-10) return p
    let h = Math.min(remaining, limit / speed)
    let next: XY | null = null
    for (let retry = 0; retry < 12; retry++) {
      const mid: XY = [p[0] + a[0] * h * .5, p[1] + a[1] * h * .5]
      const b = sampleVelocity(field, ...mid)
      if (!b || segmentHitsObstacle(obstacles, p, mid)) return null
      const candidate: XY = [p[0] + b[0] * h, p[1] + b[1] * h]
      if (Math.hypot(candidate[0] - p[0], candidate[1] - p[1]) > limit * 1.001) { h *= .5; continue }
      if (!sampleVelocity(field, ...candidate) || segmentHitsObstacle(obstacles, p, candidate)) return null
      next = candidate; break
    }
    if (!next) return null
    p = next; remaining -= h
  }
  return remaining > 1e-9 ? null : p
}

/** DataTexture row zero is south; its v=0 edge is the south edge of the plane. */
export function textureBytes(field: VelocityField, values: Array<number | null>, min: number, max: number, kind: ColourKind): Uint8Array {
  const out = new Uint8Array(field.grid.nx * field.grid.ny * 4)
  for (let k = 0; k < field.grid.nx * field.grid.ny; k++) {
    if (field.is_fluid[k] !== true || !Number.isFinite(field.u[k]) || !Number.isFinite(field.v[k]) || field.u[k] === null || field.v[k] === null) continue
    const css = colourForValue(values[k] ?? null, min, max, kind)
    if (!css) continue
    const c = css.match(/\d+/g)!.map(Number)
    out.set([c[0], c[1], c[2], 255], k * 4)
  }
  return out
}
