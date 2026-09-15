import { describe, expect, it } from 'vitest'
import { DEFAULT_GRID } from '../contracts/marswindnet.ts'
import { loadTestCity } from '../field/grid.test.ts'
import { responseToField } from './client.ts'
import { buildFluidMask } from '../field/mask.ts'

describe('prediction mask', () => {
  it('cannot reopen canonical solid cells supplied as fluid by an endpoint', () => {
    const city = loadTestCity()
    const request = { layout_id: city.layout_id, scenario_id: 'test', grid: { ...DEFAULT_GRID }, sensors: [], wind: { inlet_u_mps: 8, inlet_v_mps: 0 } }
    const response = { ...request, u_mps: Array(16384).fill(1), v_mps: Array(16384).fill(0), is_fluid: Array(16384).fill(true) }
    const converted = responseToField(request, response, city)
    expect('field' in converted).toBe(true)
    if ('field' in converted) {
      const solid = buildFluidMask(city).findIndex((value) => !value)
      expect(converted.field.is_fluid[solid]).toBe(false)
      expect(converted.field.u[solid]).toBeNull()
    }
  })
})
