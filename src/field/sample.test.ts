import { describe, expect, it } from 'vitest'
import { makeUniformFixture } from './fixtures.ts'
import { loadTestCity } from './grid.test.ts'
import { sampleVelocityAt } from './sample.ts'

describe('display-field interpolation', () => {
  const field = makeUniformFixture(loadTestCity(), 'eastward-inflow', 8, 0)
  it('interpolates valid interior data without inventing corner measurements', () => {
    expect(sampleVelocityAt(field, 10, 10)).toEqual({ u: 8, v: 0 })
    expect(sampleVelocityAt(field, 0, 0)).toBeNull()
    expect(sampleVelocityAt(field, 400, 400)).toBeNull()
    expect(sampleVelocityAt(field, 156, 300)).toBeNull()
  })
})
