import type { CityLayout, SurfaceOverlayResult } from '../contracts/marswindnet.ts'

/** Validates a registered, undeformed surface result before GPU upload. */
export function validateSurfaceOverlay(
  data: unknown,
  city: CityLayout,
  scenarioId: string,
  windBasis: 'reference' | 'prediction',
): string | null {
  if (!data || typeof data !== 'object') return 'Surface result must be an object.'
  const result = data as SurfaceOverlayResult
  if (result.layout_id !== city.layout_id) return 'Surface layout does not match the city.'
  if (result.scenario_id !== scenarioId) return 'Surface scenario does not match the active scenario.'
  if (result.wind_basis !== windBasis) return 'Surface wind basis does not match the displayed wind.'
  if (!['illustrative', 'solver', 'ml'].includes(result.source)) return 'Surface source is invalid.'
  if (![result.quantity, result.unit, result.provenance].every((value) => typeof value === 'string' && value.trim().length > 0)) return 'Surface quantity, unit and provenance are required.'
  if (!Array.isArray(result.range) || result.range.length !== 2 || !result.range.every((value) => typeof value === 'number' && Number.isFinite(value)) || result.range[0] >= result.range[1]) return 'Surface colour range must contain two increasing finite values.'
  if (!Array.isArray(result.surfaces)) return 'Surface meshes must be an array.'
  const ids = new Set<string>()
  for (const surface of result.surfaces) {
    if (!surface || typeof surface !== 'object') return 'Surface mesh must be an object.'
    const obstacle = city.obstacles.find((item) => item.id === surface.object_id && item.role === 'cfd')
    if (!obstacle || ids.has(surface.object_id)) return 'Surface object IDs must be known and unique.'
    ids.add(surface.object_id)
    const positions = surface.positions_m
    if (!Array.isArray(positions) || positions.length < 9 || positions.length % 3 !== 0 || !positions.every((value) => typeof value === 'number' && Number.isFinite(value))) return 'Surface positions must contain finite xyz triples.'
    const vertices = positions.length / 3
    if (!Array.isArray(surface.triangles) || surface.triangles.length < 3 || surface.triangles.length % 3 !== 0 || !surface.triangles.every((index) => Number.isInteger(index) && index >= 0 && index < vertices)) return 'Surface triangle indices are invalid.'
    if (!Array.isArray(surface.values) || surface.values.length !== vertices || !surface.values.every((value) => value === null || typeof value === 'number' && Number.isFinite(value))) return 'Surface scalar values must match the vertices; missing values must be null.'
    const height = obstacle.height_m
    if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return 'Surface object height is unspecified.'
    // These are undeformed meshes registered to the canonical footprints, in metres.
    const tolerance = 0.001
    for (let i = 0; i < positions.length; i += 3) {
      const dx = positions[i]! - obstacle.cx_m, dy = positions[i + 1]! - obstacle.cy_m, z = positions[i + 2]!
      const outside = obstacle.kind === 'box'
        ? Math.abs(dx) > obstacle.width_m / 2 + tolerance || Math.abs(dy) > obstacle.depth_m / 2 + tolerance
        : Math.hypot(dx, dy) > obstacle.radius_m + tolerance
      if (outside || z < -tolerance || z > height + tolerance) return 'Surface positions exceed the canonical object bounds.'
    }
  }
  return null
}
