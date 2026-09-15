import type { CityLayout, ScenarioSensorObservations, ScenarioSpec, VelocityField } from '../contracts/marswindnet.ts'
import { DEFAULT_GRID, LAYOUT_ID } from '../contracts/marswindnet.ts'
import { buildFluidMask } from './mask.ts'
import { cellCentre } from './grid.ts'

export const FIXTURE_BANNER = 'DEMO FIXTURE — NOT CFD / NOT ML'
export const ILLUSTRATIVE_BANNER = 'ILLUSTRATIVE FLOW — ANALYTIC FIXTURE, NOT CFD'
export const COMPARISON_BANNER = 'ILLUSTRATIVE COMPARISON — NOT ML INFERENCE'

export function makeUniformFixture(
  city: CityLayout,
  scenarioId: string,
  u: number,
  v: number,
): VelocityField {
  const is_fluid = buildFluidMask(city)
  const uu: Array<number | null> = is_fluid.map((fluid) => (fluid ? u : null))
  const vv: Array<number | null> = is_fluid.map((fluid) => (fluid ? v : null))
  return {
    layout_id: city.layout_id ?? LAYOUT_ID,
    scenario_id: scenarioId,
    source: 'fixture',
    provenance: FIXTURE_BANNER,
    grid: { ...DEFAULT_GRID },
    u: uu,
    v: vv,
    is_fluid,
  }
}

/**
 * Derivatives of a softened-doublet streamfunction. A deterministic visual test,
 * not CFD: rectangular proxies and superposition do not satisfy the actual
 * multi-obstacle boundary conditions. Rendering never steers the flow.
 */
export function evaluateIllustrativeVelocity(
  city: CityLayout, x: number, y: number, inletU: number, inletV: number,
): { u: number; v: number } {
  let u = inletU
  let v = inletV
  for (const obstacle of city.obstacles) {
    if (obstacle.role !== 'cfd') continue
    const a = obstacle.kind === 'box'
      ? Math.hypot(obstacle.width_m, obstacle.depth_m) / 2
      : obstacle.radius_m
    const softening2 = (0.5 * a) ** 2
    const strength = a * a + softening2
    const X = x - obstacle.cx_m
    const Y = y - obstacle.cy_m
    const r2 = X * X + Y * Y + softening2
    const q = inletU * Y - inletV * X
    u -= strength * (inletU / r2 - 2 * Y * q / (r2 * r2))
    v -= strength * (inletV / r2 + 2 * X * q / (r2 * r2))
  }
  return { u, v }
}

export function makeIllustrativeObstacleField(
  city: CityLayout, scenarioId: string, inletU: number = 8, inletV: number = 2,
): VelocityField {
  const field = makeUniformFixture(city, scenarioId, inletU, inletV)
  for (let index = 0; index < field.u.length; index++) {
    if (!field.is_fluid[index]) continue
    const { x, y } = cellCentre(index % field.grid.nx, Math.floor(index / field.grid.nx), field.grid)
    const velocity = evaluateIllustrativeVelocity(city, x, y, inletU, inletV)
    field.u[index] = velocity.u
    field.v[index] = velocity.v
  }
  field.provenance = ILLUSTRATIVE_BANNER
  return field
}

/** Artificial comparison for exercising overlays; no model is trained or run. */
export function makeIllustrativeComparison(reference: VelocityField): VelocityField {
  const u = reference.u.map((value, index) => {
    if (value === null || !reference.is_fluid[index]) return null
    const { x, y } = cellCentre(index % reference.grid.nx, Math.floor(index / reference.grid.nx), reference.grid)
    return value + 0.8 * Math.sin(2 * Math.PI * x / (reference.grid.nx * reference.grid.dx_m)) * Math.cos(2 * Math.PI * y / (reference.grid.ny * reference.grid.dy_m))
  })
  const v = reference.v.map((value, index) => {
    if (value === null || !reference.is_fluid[index]) return null
    const { x, y } = cellCentre(index % reference.grid.nx, Math.floor(index / reference.grid.nx), reference.grid)
    return value + 0.6 * Math.cos(2 * Math.PI * x / (reference.grid.nx * reference.grid.dx_m)) * Math.sin(2 * Math.PI * y / (reference.grid.ny * reference.grid.dy_m))
  })
  return { ...reference, source: 'saved', provenance: COMPARISON_BANNER, u, v }
}

export function makeScenarioObservations(city: CityLayout, scenario: ScenarioSpec): ScenarioSensorObservations {
  if (!scenario.fixture) {
    return {
      layout_id: city.layout_id, scenario_id: scenario.id, source: 'provided',
      provenance: 'No point observations have been provided.', readings: [],
    }
  }
  return {
    layout_id: city.layout_id,
    scenario_id: scenario.id,
    source: 'analytic-fixture',
    provenance: 'Virtual point observations evaluated at their exact coordinates; not measured Mars data.',
    readings: city.sensors.map((sensor) => {
      const velocity = scenario.fixture === 'obstacle-flow'
        ? evaluateIllustrativeVelocity(city, sensor.x_m, sensor.y_m, scenario.inlet_u_mps, scenario.inlet_v_mps)
        : { u: scenario.inlet_u_mps, v: scenario.inlet_v_mps }
      return { sensor_id: sensor.id, x_m: sensor.x_m, y_m: sensor.y_m, u_mps: velocity.u, v_mps: velocity.v }
    }),
  }
}
