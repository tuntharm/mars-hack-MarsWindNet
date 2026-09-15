import { describe, expect, it } from 'vitest'
import { makeUniformFixture } from './fixtures.ts'
import { loadTestCity } from './grid.test.ts'
import { gridIndex } from './grid.ts'
import { buildFluidMask, pointInCfdObstacle } from './mask.ts'

describe('mask vs footprints', () => {
  const city = loadTestCity()

  it('treats CFD dome and box interiors as solid', () => {
    expect(pointInCfdObstacle(city, 156, 300)).toBe(true)
    expect(pointInCfdObstacle(city, 144, 148)).toBe(true)
    expect(pointInCfdObstacle(city, 10, 10)).toBe(false)
  })

  it('does not treat visual pads or solar beds as solid', () => {
    expect(pointInCfdObstacle(city, 136, 244)).toBe(false)
    expect(pointInCfdObstacle(city, 264, 96)).toBe(false)
    expect(pointInCfdObstacle(city, 76, 78)).toBe(false)
  })

  it('includes the closed circular obstacle boundary', () => {
    expect(pointInCfdObstacle(city, 170, 300)).toBe(true)
  })

  it('masks by cell centre, not by a duplicated coordinate list', () => {
    const mask = buildFluidMask(city)
    expect(mask).toHaveLength(128 * 128)
    const d1 = gridIndex(Math.round((156 - 1.5625) / 3.125), Math.round((300 - 1.5625) / 3.125))
    const pad = gridIndex(Math.round((136 - 1.5625) / 3.125), Math.round((244 - 1.5625) / 3.125))
    expect(mask[d1]).toBe(false)
    expect(mask[pad]).toBe(true)
  })
})

describe('east vs north fixtures', () => {
  const city = loadTestCity()

  it('writes eastward flow only on fluid cells', () => {
    const field = makeUniformFixture(city, 'eastward-inflow', 8, 0)
    const fluid = field.is_fluid.findIndex(Boolean)
    const solid = field.is_fluid.findIndex((value) => !value)
    expect(field.u[fluid]).toBe(8)
    expect(field.v[fluid]).toBe(0)
    expect(field.u[solid]).toBeNull()
    expect(field.v[solid]).toBeNull()
    expect(field.provenance).toMatch(/NOT CFD/)
  })

  it('keeps northward u as 0 rather than null on fluid cells', () => {
    const field = makeUniformFixture(city, 'northward-inflow', 0, 8)
    const fluid = field.is_fluid.findIndex(Boolean)
    expect(field.u[fluid]).toBe(0)
    expect(field.v[fluid]).toBe(8)
    expect(field.u[fluid]).not.toBeNull()
  })
})
