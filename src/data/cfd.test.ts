import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { CityLayout } from '../contracts/marswindnet.ts'
import { parseCfdReference } from './cfd.ts'
const city: CityLayout = JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8'))
const result = () => ({ kind: 'cfd-reference', layout_id: city.layout_id, scenario_id: 'cfd-eastward-8', grid: city.grid, u_mps: Array(16384).fill(8), v_mps: Array(16384).fill(0), is_fluid: Array(16384).fill(true), provenance: 'Test transport data only; no CFD solve' })
describe('CFD reference import', () => {
  it('loads a reference without fabricating prediction and combines the canonical solids', () => {
    const field = parseCfdReference(result(), city, 'cfd-eastward-8')
    expect(field.source).toBe('cfd')
    expect(field.u[0]).toBe(8)
    expect(field.is_fluid.filter(x => !x).length).toBeGreaterThan(0)
    expect(field.u.filter(x => x === null).length).toBe(field.is_fluid.filter(x => !x).length)
    expect(field.provenance).toContain('no CFD solve')
  })
  it('rejects mismatched identities, missing provenance, malformed masks and invalid vectors', () => {
    expect(() => parseCfdReference(result(), city, 'wrong')).toThrow(/scenario/)
    for (const patch of [{ kind: 'fixture' }, { provenance: '' }, { is_fluid: [] }, { u_mps: [NaN] }, { grid: { nx:128, ny:128, dx_m:2, dy_m:2 } }]) {
      expect(() => parseCfdReference({ ...result(), ...patch }, city, 'cfd-eastward-8')).toThrow()
    }
  })
})
