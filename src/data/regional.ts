import type { CityLayout, ScenarioSensorObservations } from '../contracts/marswindnet'

/** Regional observations are point data, never clamped into the local CFD grid. */
export function parseRegionalObservations(value: unknown, city: CityLayout, scenarioId: string): ScenarioSensorObservations {
  const data = value as ScenarioSensorObservations & {scope?: string}
  if (!data || data.scope !== 'regional' || data.layout_id !== city.layout_id || data.scenario_id !== scenarioId || !['provided','analytic-fixture'].includes(data.source) || typeof data.provenance !== 'string' || !data.provenance.trim() || !Array.isArray(data.readings)) throw new Error('Regional observation identity or provenance is invalid')
  const ids = new Set<string>()
  for (const reading of data.readings) {
    const sensor = city.regional_sensors.find(s => s.id === reading.sensor_id)
    if (!sensor || ids.has(sensor.id) || reading.x_m !== sensor.x_m || reading.y_m !== sensor.y_m || !Number.isFinite(reading.u_mps) || !Number.isFinite(reading.v_mps)) throw new Error('Regional reading must match an exact station and contain finite velocities')
    ids.add(sensor.id)
  }
  return data
}
