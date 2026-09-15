import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { CityLayout } from '../contracts/marswindnet'
import { uniformWind, uniformObservations, parseCustomReference, validateModelInfo, windSupportError } from './customWind'

const city = JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8')) as CityLayout
const info = { status: 'ready', model: { id:'field', version:'1' }, layout_id:city.layout_id, grid:city.grid, sensor_ids:['S1','S2','S4','S5'], prediction_kind:'steady-field', limits:{speed_min_mps:0,speed_max_mps:20,directions_deg:null} }

describe('custom incoming wind', () => {
  it.each([[0,0,8],[90,8,0],[180,0,-8],[270,-8,0],[360,0,8]])('converts towards %s degrees', (bearing,u,v) => {
    expect(uniformWind(8,bearing)).toEqual({inlet_u_mps:u,inlet_v_mps:v})
  })
  it('handles diagonals and calm, rejects invalid input', () => {
    expect(uniformWind(8,45).inlet_u_mps).toBeCloseTo(Math.sqrt(32))
    expect(uniformWind(0,270)).toEqual({inlet_u_mps:0,inlet_v_mps:0})
    expect(()=>uniformWind(-1,90)).toThrow()
    expect(()=>uniformWind(8,NaN)).toThrow()
  })
  it('generates four exact corners and 24 regional readings, never S3', () => {
    const observations = uniformObservations(city,uniformWind(8,90))
    expect(observations.local.readings.map(r=>r.sensor_id)).toEqual(['S1','S2','S4','S5'])
    expect(observations.regional.readings).toHaveLength(24)
    expect(observations.local.source).toBe('simulated-uniform')
    for(const r of [...observations.local.readings,...observations.regional.readings]) expect([r.u_mps,r.v_mps]).toEqual([8,0])
  })
  it('rejects centre-only capabilities and enforces supported conditions', () => {
    expect(validateModelInfo(info).status).toBe('ready')
    expect(()=>validateModelInfo({...info,prediction_kind:'centre'})).toThrow()
    expect(()=>validateModelInfo({...info,sensor_ids:['S3']})).toThrow()
    expect(windSupportError(validateModelInfo(info),8,90)).toBeNull()
    expect(windSupportError(validateModelInfo(info),21,90)).toMatch(/supported/i)
  })
  it('accepts only a numerical reference for the same wind and layout', () => {
    const wind=uniformWind(8,90)
    const ref={kind:'cfd-reference',scenario_id:'custom-wind',layout_id:city.layout_id,grid:city.grid,wind,provenance:'Test solver',is_fluid:Array(16384).fill(true),u_mps:Array(16384).fill(8),v_mps:Array(16384).fill(0)}
    expect(parseCustomReference(ref,city,wind).source).toBe('cfd')
    expect(()=>parseCustomReference({...ref,wind:uniformWind(9,90)},city,wind)).toThrow(/wind/i)
    expect(()=>parseCustomReference({...ref,wind:undefined},city,wind)).toThrow(/wind/i)
  })
})
