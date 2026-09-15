import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { CityLayout, SurfaceOverlayResult } from '../contracts/marswindnet.ts'
import { makeUniformFixture } from '../field/fixtures.ts'
import { buildIllustrativeSurfaceOverlay, illustrativeIndex, representativeExteriorWind } from './illustrative.ts'
import { validateSurfaceOverlay } from './validate.ts'

const city: CityLayout = JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8'))
const field = makeUniformFixture(city, 'eastward-inflow', 8, 0)

describe('illustrative building contours', () => {
  it('uses wind direction and a fixed visual scale, not a stress calculation', () => {
    expect(illustrativeIndex(8, 0, -1, 0, 0.5)).toBeCloseTo(0.38)
    expect(illustrativeIndex(8, 0, 1, 0, 0.5)).toBeCloseTo(0.12)
    expect(illustrativeIndex(-8, 0, 1, 0, 0.5)).toBeCloseTo(0.38)
    expect(illustrativeIndex(0, 0, -1, 0, 1)).toBe(0)
  })

  it('samples exterior fluid rather than the masked centre', () => {
    expect(representativeExteriorWind(city, city.obstacles[0]!, field)).toEqual({ u: 8, v: 0 })
    const missing = { ...field, is_fluid: field.is_fluid.map(() => false) }
    expect(representativeExteriorWind(city, city.obstacles[0]!, missing)).toBeNull()
  })

  it('builds deterministic unitless vertex values and preserves neutral missing surfaces', () => {
    const overlay = buildIllustrativeSurfaceOverlay(city, field, 'reference')!
    expect(overlay.source).toBe('illustrative')
    expect(overlay.unit).toBe('unitless')
    expect(overlay.range).toEqual([0, 1])
    expect(overlay.provenance).toMatch(/not stress/)
    expect(overlay.surfaces).toHaveLength(14)
    expect(overlay.surfaces).toEqual(buildIllustrativeSurfaceOverlay(city, field, 'reference')!.surfaces)
    expect(validateSurfaceOverlay(overlay, city, field.scenario_id, 'reference')).toBeNull()
    const missing = buildIllustrativeSurfaceOverlay(city, { ...field, is_fluid: field.is_fluid.map(() => false) }, 'reference')!
    expect(missing.surfaces.every((surface) => surface.values.every((value) => value === null))).toBe(true)
  })
})

function minimalResult(): SurfaceOverlayResult {
  return {
    layout_id: city.layout_id, scenario_id: 'case', wind_basis: 'reference',
    source: 'solver', quantity: 'von_mises_stress', unit: 'Pa', provenance: 'Test-only supplied mesh', range: [0, 20],
    surfaces: [{ object_id: 'D1', positions_m: [206, 350, 1, 207, 350, 1, 206, 351, 1], triangles: [0, 1, 2], values: [0, 10, null] }],
  }
}

describe('surface result adapter validation', () => {
  it('accepts explicit null scalars for neutral rendering', () => {
    expect(validateSurfaceOverlay(minimalResult(), city, 'case', 'reference')).toBeNull()
  })
  it('rejects identity, indexing and value-shape mistakes', () => {
    expect(validateSurfaceOverlay({ ...minimalResult(), layout_id: 'other' }, city, 'case', 'reference')).toMatch(/layout/)
    expect(validateSurfaceOverlay(minimalResult(), city, 'case', 'prediction')).toMatch(/basis/)
    const unknown = minimalResult(); unknown.surfaces[0]!.object_id = 'unknown'
    expect(validateSurfaceOverlay(unknown, city, 'case', 'reference')).toMatch(/object/)
    const index = minimalResult(); index.surfaces[0]!.triangles[0] = 100
    expect(validateSurfaceOverlay(index, city, 'case', 'reference')).toMatch(/triangle/)
    const value = minimalResult(); value.surfaces[0]!.values = [Number.NaN]
    expect(validateSurfaceOverlay(value, city, 'case', 'reference')).toMatch(/scalar/)
    const position = minimalResult(); position.surfaces[0]!.positions_m[0] = Number.POSITIVE_INFINITY
    expect(validateSurfaceOverlay(position, city, 'case', 'reference')).toMatch(/positions/)
    const shifted = minimalResult(); shifted.surfaces[0]!.positions_m[0] = 1000
    expect(validateSurfaceOverlay(shifted, city, 'case', 'reference')).toMatch(/bounds/)
    const duplicate = minimalResult(); duplicate.surfaces.push(duplicate.surfaces[0]!)
    expect(validateSurfaceOverlay(duplicate, city, 'case', 'reference')).toMatch(/unique/)
  })
})
