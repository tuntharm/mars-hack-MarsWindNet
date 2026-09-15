import { describe, expect, it } from 'vitest'
import { loadTestCity } from './grid.test.ts'
import { evaluateIllustrativeVelocity, makeIllustrativeObstacleField, makeIllustrativeComparison } from './fixtures.ts'
import { vectorErrorValues } from './metrics.ts'

describe('analytic visual fixture', () => {
  const city = loadTestCity()
  it('is deterministic, varied, finite and explicitly illustrative', () => {
    const a = makeIllustrativeObstacleField(city, 'illustrative-obstacle-flow', 8, 2)
    const b = makeIllustrativeObstacleField(city, 'illustrative-obstacle-flow', 8, 2)
    expect(a.u).toEqual(b.u)
    const fluidU = a.u.filter((u) => u !== null)
    expect(fluidU.every(Number.isFinite)).toBe(true)
    expect(Math.max(...fluidU) - Math.min(...fluidU)).toBeGreaterThan(2)
    expect(a.provenance).toMatch(/NOT CFD/)
    expect(a.u[a.is_fluid.findIndex((valid) => !valid)]).toBeNull()
  })

  it('depends on CFD geometry but not pads or solar beds', () => {
    const at = (layout: typeof city) => evaluateIllustrativeVelocity(layout, 70, 140, 8, 2)
    expect(at({ ...city, pads: [], solar_beds: [] })).toEqual(at(city))
    expect(at({ ...city, obstacles: [] })).toEqual({ u: 8, v: 2 })
    expect(at(city)).not.toEqual({ u: 8, v: 2 })
  })

  it('produces a separately labelled comparison with nonzero error and shared mask', () => {
    const reference = makeIllustrativeObstacleField(city, 'illustrative-obstacle-flow', 8, 2)
    const prediction = makeIllustrativeComparison(reference)
    expect(prediction.is_fluid).toEqual(reference.is_fluid)
    expect(prediction.provenance).toMatch(/NOT ML INFERENCE/)
    expect(vectorErrorValues(reference.u, reference.v, prediction.u, prediction.v).some((value) => value !== null && value > 0.5)).toBe(true)
  })
})
