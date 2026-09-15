import type { CityLayout, PredictRequest, ScenarioSensorObservations, ScenarioSpec, SensorReading } from '../contracts/marswindnet.ts'

export function parseProvidedObservations(city: CityLayout, scenario: ScenarioSpec, data: unknown): ScenarioSensorObservations {
  if (!data || typeof data !== 'object') throw new Error('Point observations must be an object.')
  const candidate = data as ScenarioSensorObservations
  if (candidate.source !== 'provided' || !Array.isArray(candidate.readings)) throw new Error('Point observations require source provided and a readings array.')
  const seen = new Set<string>()
  for (const reading of candidate.readings) {
    if (!reading || typeof reading !== 'object' || typeof reading.sensor_id !== 'string' ||
      ![reading.x_m, reading.y_m, reading.u_mps, reading.v_mps].every((value) => typeof value === 'number' && Number.isFinite(value))) {
      throw new Error('Point observations must contain finite numeric readings.')
    }
    const sensor = city.sensors.find((item) => item.id === reading.sensor_id)
    if (!sensor || seen.has(sensor.id) || sensor.x_m !== reading.x_m || sensor.y_m !== reading.y_m) {
      throw new Error(`Invalid or duplicate observation location: ${reading.sensor_id}.`)
    }
    seen.add(sensor.id)
  }
  buildPredictRequest(city, scenario, candidate)
  return { ...candidate, provenance: typeof candidate.provenance === 'string' ? candidate.provenance : 'Provided point observations.' }
}

/** Inputs are explicit point observations, never clamped display-grid samples. */
export function buildPredictRequest(
  city: CityLayout,
  scenario: ScenarioSpec,
  observations: ScenarioSensorObservations,
): PredictRequest {
  if (observations.layout_id !== city.layout_id) throw new Error('Observation layout does not match the city.')
  if (observations.scenario_id !== scenario.id) throw new Error('Observation scenario does not match the selected scenario.')
  const sensors: SensorReading[] = city.sensors.filter((sensor) => sensor.use_for_prediction).map((sensor) => {
    const matches = observations.readings.filter((reading) => reading.sensor_id === sensor.id)
    const reading = matches[0]
    if (matches.length !== 1 || !reading || !Number.isFinite(reading.u_mps) || !Number.isFinite(reading.v_mps)) {
      throw new Error(`Missing or invalid observation for ${sensor.id}.`)
    }
    if (reading.x_m !== sensor.x_m || reading.y_m !== sensor.y_m) {
      throw new Error(`Observation coordinates do not match ${sensor.id}.`)
    }
    return { ...reading }
  })
  if (sensors.length === 0) throw new Error('No prediction inputs are configured.')
  return {
    layout_id: city.layout_id,
    scenario_id: scenario.id,
    grid: { nx: city.grid.nx, ny: city.grid.ny, dx_m: city.grid.dx_m, dy_m: city.grid.dy_m },
    wind: { inlet_u_mps: scenario.inlet_u_mps, inlet_v_mps: scenario.inlet_v_mps },
    sensors,
  }
}
