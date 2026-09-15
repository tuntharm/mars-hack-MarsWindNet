import { describe, expect, it } from 'vitest'
import { advanceParticle, sampleVelocity, segmentHitsObstacle, toWorld, textureBytes } from './flowMath'
import type { Obstacle, VelocityField } from '../contracts/marswindnet'
const field: VelocityField = { layout_id: 'test', scenario_id: 'test', source: 'fixture', provenance: 'test', grid: { nx: 4, ny: 4, dx_m: 10, dy_m: 10 }, u: Array(16).fill(8), v: Array(16).fill(2), is_fluid: Array(16).fill(true) }
const circle: Obstacle = { id: 'D', name: 'D', kind: 'dome', role: 'cfd', cx_m: 20, cy_m: 20, radius_m: 3, height_m: 3 }
const box: Obstacle = { id: 'B', name: 'B', kind: 'box', role: 'cfd', cx_m: 20, cy_m: 20, width_m: 6, depth_m: 8, height_m: 4 }
describe('3D flow coordinates and integration', () => {
  it('maps east and north to the correct world axes', () => { expect(toWorld(8, 2, 1)).toEqual([8, 1, -2]) })
  it('samples cell centres and bilinear velocity without clamping edges', () => {
    expect(sampleVelocity(field, 12, 18)).toEqual([8, 2]); expect(sampleVelocity(field, 0, 0)).toBeNull()
    const f = { ...field, u: Array.from({ length: 16 }, (_, k) => (k % 4) * 10 + 5), v: Array.from({ length: 16 }, (_, k) => Math.floor(k / 4) * 10 + 5) }
    expect(sampleVelocity(f, 12, 18)![0]).toBeCloseTo(12); expect(sampleVelocity(f, 12, 18)![1]).toBeCloseTo(18)
  })
  it('rejects invalid stencils and finite-value failures', () => {
    const mask = field.is_fluid.slice(); mask[5] = false; expect(sampleVelocity({ ...field, is_fluid: mask }, 12, 12)).toBeNull()
    const u = field.u.slice(); u[5] = null; expect(sampleVelocity({ ...field, u }, 12, 12)).toBeNull()
    u[5] = NaN; expect(sampleVelocity({ ...field, u }, 12, 12)).toBeNull()
  })
  it('detects crossing, touching and starting inside either footprint', () => {
    for (const obstacle of [circle, box]) {
      expect(segmentHitsObstacle([obstacle], [5, 20], [35, 20])).toBe(true)
      expect(segmentHitsObstacle([obstacle], [20, 20], [35, 20])).toBe(true)
      expect(segmentHitsObstacle([obstacle], [5, 5], [35, 5])).toBe(false)
    }
    expect(segmentHitsObstacle([circle], [5, 23], [35, 23])).toBe(true)
    expect(segmentHitsObstacle([box], [5, 24], [35, 24])).toBe(true)
  })
  it('integrates constant flow with RK2 and handles zero velocity', () => {
    expect(advanceParticle(field, [], [10, 10], 1)).toEqual([18, 12])
    expect(advanceParticle({ ...field, u: Array(16).fill(0), v: Array(16).fill(0) }, [], [10, 10], 1)).toEqual([10, 10])
  })
  it('cannot tunnel through obstacles during a long integration step', () => {
    const fast = { ...field, u: Array(16).fill(80), v: Array(16).fill(0) }
    expect(advanceParticle(fast, [circle], [10, 20], .4)).toBeNull()
    expect(advanceParticle(fast, [box], [10, 20], .4)).toBeNull()
  })
  it('keeps south-first texture rows and hard-masks invalid cells', () => {
    const bytes = textureBytes(field, Array.from({ length: 16 }, (_, k) => k), 0, 15, 'speed')
    expect([...bytes.slice(0, 4)]).toEqual([8, 22, 48, 255]); expect([...bytes.slice(-4)]).toEqual([232, 92, 28, 255])
    const mask = field.is_fluid.slice(); mask[0] = false
    expect(textureBytes({ ...field, is_fluid: mask }, Array(16).fill(1), 0, 1, 'speed')[3]).toBe(0)
  })
})
