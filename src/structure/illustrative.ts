import type { CityLayout, Obstacle, SurfaceOverlayResult, VelocityField } from '../contracts/marswindnet.ts'
import { sampleVelocityAt } from '../field/sample.ts'
import { pointInCfdObstacle } from '../field/mask.ts'
import { buildOuterSurface } from '../geometry/surfaceMesh.ts'

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** A fixed visual index; 20 m/s is a display scale, not a physical threshold. */
export function illustrativeIndex(u: number, v: number, nx: number, ny: number, heightFraction: number): number {
  const speed = Math.hypot(u, v)
  if (speed === 0) return 0
  const windward = Math.max(0, -(nx * u + ny * v) / speed)
  return clamp01(clamp01(speed / 20) * (0.25 + 0.65 * windward + 0.10 * clamp01(heightFraction)))
}

/** Mean vector from a fixed 16-point exterior ring. Missing points are not replaced. */
export function representativeExteriorWind(city: CityLayout, obstacle: Obstacle, field: VelocityField): { u: number; v: number } | null {
  const offset = 1.5 * Math.max(field.grid.dx_m, field.grid.dy_m)
  const points: [number, number][] = []
  if (obstacle.kind === 'box') {
    for (const t of [-0.75, -0.25, 0.25, 0.75]) {
      const hx = obstacle.width_m / 2, hy = obstacle.depth_m / 2
      points.push(
        [obstacle.cx_m - hx - offset, obstacle.cy_m + t * hy],
        [obstacle.cx_m + hx + offset, obstacle.cy_m + t * hy],
        [obstacle.cx_m + t * hx, obstacle.cy_m - hy - offset],
        [obstacle.cx_m + t * hx, obstacle.cy_m + hy + offset],
      )
    }
  } else {
    for (let k = 0; k < 16; k++) {
      const angle = 2 * Math.PI * k / 16
      points.push([obstacle.cx_m + (obstacle.radius_m + offset) * Math.cos(angle), obstacle.cy_m + (obstacle.radius_m + offset) * Math.sin(angle)])
    }
  }
  let u = 0, v = 0, count = 0
  for (const [x, y] of points) {
    if (pointInCfdObstacle(city, x, y)) continue
    const sample = sampleVelocityAt(field, x, y)
    if (!sample) continue
    u += sample.u; v += sample.v; count++
  }
  return count ? { u: u / count, v: v / count } : null
}

/** Produces data only. No physical stress, displacement, density or FEA assumptions. */
export function buildIllustrativeSurfaceOverlay(
  city: CityLayout,
  field: VelocityField | null,
  windBasis: 'reference' | 'prediction',
): SurfaceOverlayResult | null {
  if (!field || field.layout_id !== city.layout_id) return null
  return {
    layout_id: city.layout_id,
    scenario_id: field.scenario_id,
    wind_basis: windBasis,
    source: 'illustrative',
    quantity: 'illustrative_index',
    unit: 'unitless',
    provenance: 'Visual response to wind; not stress, displacement or structural analysis. The 20 m/s visual scale is not a safety threshold.',
    range: [0, 1],
    surfaces: city.obstacles.filter((obstacle) => obstacle.role === 'cfd' && (obstacle.height_m ?? 0) > 0).map((obstacle) => {
      const mesh = buildOuterSurface(obstacle)
      const wind = representativeExteriorWind(city, obstacle, field)
      const values = Array.from({ length: mesh.positions_m.length / 3 }, (_, index) => wind
        ? illustrativeIndex(wind.u, wind.v, mesh.normals[index * 3]!, mesh.normals[index * 3 + 1]!, mesh.positions_m[index * 3 + 2]! / obstacle.height_m!)
        : null)
      return { object_id: obstacle.id, positions_m: mesh.positions_m, triangles: mesh.triangles, values }
    }),
  }
}
