import { describe, expect, it } from 'vitest'
import { terrainElevationAt } from './environmentMath'

describe('decorative terrain boundary', () => {
  it('keeps the entire display domain and the meshing buffer flat', () => {
    for (let j = 0; j <= 128; j++) for (let i = 0; i <= 128; i++) {
      expect(terrainElevationAt(i * 3.90625, -j * 3.90625)).toBe(-.12)
    }
    for (let y = 0; y <= 500; y += 20) {
      expect(terrainElevationAt(-100, -y)).toBe(-.12)
      expect(terrainElevationAt(600, -y)).toBe(-.12)
      expect(terrainElevationAt(y, 100)).toBe(-.12)
      expect(terrainElevationAt(y, -600)).toBe(-.12)
    }
  })
  it('creates deterministic finite ridges only outside the flat region', () => {
    const values: number[] = []
    for (let x = -1400; x <= 1800; x += 100) for (let z = -1800; z <= 1400; z += 100) {
      const height = terrainElevationAt(x, z)
      expect(Number.isFinite(height)).toBe(true)
      expect(terrainElevationAt(x, z)).toBe(height)
      values.push(height)
    }
    expect(Math.max(...values)).toBeGreaterThan(50)
  })
})
