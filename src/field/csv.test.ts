import { describe, expect, it } from 'vitest'
import { parseNumericCell, parsePairedCsv } from './csv.ts'

describe('CSV missing vs zero', () => {
  it('parses empty cells as null and 0 as zero', () => {
    expect(parseNumericCell('')).toBeNull()
    expect(parseNumericCell('   ')).toBeNull()
    expect(parseNumericCell('0')).toBe(0)
  })

  it('places null and zero independently in paired fields', () => {
    const csv = [
      'point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps',
      '0,1.5625,1.5625,1,8,0,0,',
      '1,4.6875,1.5625,1,8,0,,1',
      '2,7.8125,1.5625,0,,,,',
    ].join('\n')
    const paired = parsePairedCsv(csv, 'marswindnet-layout-v2', 'eastward-inflow')
    expect(paired.prediction.u[0]).toBe(0)
    expect(paired.prediction.v[0]).toBeNull()
    expect(paired.prediction.u[1]).toBeNull()
    expect(paired.prediction.v[1]).toBe(1)
    expect(paired.reference.u[2]).toBeNull()
    expect(paired.prediction.is_fluid[2]).toBe(false)
    expect(paired.reference.source).toBe('saved')
    expect(paired.prediction.provenance).toMatch(/NOT LIVE/)
  })

  it('rejects shifted coordinates and duplicate point ids instead of silently remapping', () => {
    const header = 'point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps'
    expect(() => parsePairedCsv(`${header}\n0,0,0,1,8,0,7,1`)).toThrow(/coordinates/)
    expect(() => parsePairedCsv(`${header}\n0,1.5625,1.5625,1,8,0,7,1\n0,1.5625,1.5625,1,8,0,7,1`)).toThrow(/duplicate/)
  })
})
