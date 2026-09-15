import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parsePairedCsv } from './csv.ts'
import { evaluateIllustrativeVelocity } from './fixtures.ts'
import { loadTestCity } from './grid.test.ts'
import { LAYOUT_ID } from '../contracts/marswindnet.ts'

describe('shipped illustrative paired CSV', () => {
  it('keeps missing ML distinct from zero and stays labelled as not live', () => {
    const text = readFileSync('public/data/scenarios/eastward-inflow.paired.csv', 'utf8')
    const paired = parsePairedCsv(text)
    expect(paired.prediction.u).toHaveLength(16384)
    expect(paired.prediction.u[0]).toBeNull()
    expect(paired.prediction.v[0]).toBeNull()
    expect(paired.prediction.u[1]).toBe(0)
    expect(paired.prediction.v[1]).toBe(0)
    expect(paired.reference.u[1]).toBe(8)
    expect(paired.prediction.provenance).toMatch(/NOT LIVE/)
    expect(paired.prediction.source).toBe('saved')
  })

  it('ships the varied pair and exact-coordinate observations under the current layout', () => {
    const text = readFileSync('public/data/scenarios/illustrative-obstacle-flow.paired.csv', 'utf8')
    const paired = parsePairedCsv(text, LAYOUT_ID, 'illustrative-obstacle-flow')
    const expected = evaluateIllustrativeVelocity(loadTestCity(), 1.953125, 1.953125, 8, 2)
    expect(paired.reference.u[0]).toBeCloseTo(expected.u, 10)
    expect(paired.reference.v[0]).toBeCloseTo(expected.v, 10)
    expect(paired.prediction.provenance).toMatch(/NOT ML INFERENCE/)
    const observations = JSON.parse(readFileSync('public/data/scenarios/illustrative-obstacle-flow.observations.json', 'utf8'))
    expect(observations.layout_id).toBe(LAYOUT_ID)
    expect(observations.readings[0]).toMatchObject({ sensor_id: 'S1', x_m: 0, y_m: 500 })
    expect(observations.readings[0].u_mps).toBe(evaluateIllustrativeVelocity(loadTestCity(), 0, 500, 8, 2).u)
  })
})
