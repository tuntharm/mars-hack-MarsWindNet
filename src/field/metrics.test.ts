import { describe, expect, it } from 'vitest'
import { cardinalFromBearing, towardsBearingDeg, vectorErrorMps, vectorErrorValues } from './metrics.ts'

describe('towards bearing', () => {
  it('uses atan2(u, v) so 0 is north and 90 is east', () => {
    expect(towardsBearingDeg(0, 5)).toBeCloseTo(0)
    expect(towardsBearingDeg(5, 0)).toBeCloseTo(90)
    expect(towardsBearingDeg(0, -5)).toBeCloseTo(180)
    expect(towardsBearingDeg(-5, 0)).toBeCloseTo(270)
    expect(cardinalFromBearing(90)).toBe('east')
  })
})

describe('vector error', () => {
  it('is hypot of velocity residuals and stays null if either side is missing', () => {
    expect(vectorErrorMps(3, 4, 0, 0)).toBeCloseTo(5)
    expect(vectorErrorMps(1, 0, null, 0)).toBeNull()
    expect(vectorErrorValues([1, null], [0, 0], [1, 1], [0, 0])).toEqual([0, null])
  })
})
