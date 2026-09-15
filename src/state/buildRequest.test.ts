import { describe, expect, it } from 'vitest'
import { loadTestCity } from '../field/grid.test.ts'
import { makeScenarioObservations, evaluateIllustrativeVelocity } from '../field/fixtures.ts'
import { buildPredictRequest, parseProvidedObservations } from './buildRequest.ts'
import { scenarioById } from './scenarios.ts'

describe('independent checkpoint protocol', () => {
  const city = loadTestCity()
  const scenario = scenarioById('illustrative-obstacle-flow')
  it('uses exact corner observations and excludes S3 from inference', () => {
    const observations = makeScenarioObservations(city, scenario)
    const request = buildPredictRequest(city, scenario, observations)
    expect(request.sensors.map((sensor) => sensor.sensor_id)).toEqual(['S1', 'S2', 'S4', 'S5'])
    expect(request.sensors[0]).toMatchObject({ x_m: 0, y_m: 400 })
    const corner = evaluateIllustrativeVelocity(city, 0, 400, 8, 2)
    expect(request.sensors[0]?.u_mps).toBe(corner.u)
    expect(request.sensors[0]?.v_mps).toBe(corner.v)
    expect(observations.readings.map((sensor) => sensor.sensor_id)).toContain('S3')
  })

  it('does not invent a missing observation or accept the wrong scenario', () => {
    const observations = makeScenarioObservations(city, scenario)
    observations.readings = observations.readings.filter((sensor) => sensor.sensor_id !== 'S1')
    expect(() => buildPredictRequest(city, scenario, observations)).toThrow(/S1/)
    expect(() => buildPredictRequest(city, scenario, { ...observations, scenario_id: 'other' })).toThrow(/scenario/)
  })

  it('never invents inlet readings for a future real-data scenario', () => {
    const real = { id: 'real-case', label: 'Provided case', inlet_u_mps: 8, inlet_v_mps: 2 }
    const missing = makeScenarioObservations(city, real)
    expect(missing.readings).toEqual([])
    expect(() => buildPredictRequest(city, real, missing)).toThrow(/S1/)
    const valid = { ...makeScenarioObservations(city, scenario), source: 'provided', scenario_id: real.id }
    expect(parseProvidedObservations(city, real, valid).readings).toHaveLength(5)
    expect(() => parseProvidedObservations(city, real, { ...valid, readings: [{ ...valid.readings[0], u_mps: '8' }] })).toThrow(/finite/)
  })
})
