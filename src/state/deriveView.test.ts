import { describe, expect, it } from 'vitest'
import { makeUniformFixture } from '../field/fixtures.ts'
import { loadTestCity } from '../field/grid.test.ts'
import { activeField, deriveColour, effectiveViewMode } from './deriveView.ts'

describe('error-mode colour vs arrows', () => {
  it('maps Structure Error to predicted wind without changing the stored CFD intent', () => {
    expect(effectiveViewMode('structure', 'error')).toBe('prediction')
    expect(effectiveViewMode('cfd', 'error')).toBe('error')
    expect(effectiveViewMode('mars', 'reference')).toBe('reference')
  })
  it('colours vector error but keeps prediction as the active velocity field', () => {
    const city = loadTestCity()
    const reference = makeUniformFixture(city, 'eastward-inflow', 8, 0)
    const prediction = makeUniformFixture(city, 'eastward-inflow', 6, 2)
    prediction.source = 'saved'
    const colour = deriveColour('error', reference, prediction)
    const field = activeField('error', reference, prediction)
    expect(colour.kind).toBe('vector-error')
    expect(field).toBe(prediction)
    const fluid = reference.is_fluid.findIndex(Boolean)
    expect(colour.values[fluid]).toBeCloseTo(Math.hypot(6 - 8, 2 - 0))
  })
})
