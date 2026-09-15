import { describe, expect, it } from 'vitest'
import type { PredictRequest, PredictResponse } from '../contracts/marswindnet.ts'
import { DEFAULT_GRID, LAYOUT_ID } from '../contracts/marswindnet.ts'
import { validatePredictResponse } from './validate.ts'

const request: PredictRequest = {
  layout_id: LAYOUT_ID,
  scenario_id: 'eastward-inflow',
  grid: { ...DEFAULT_GRID },
  wind: { inlet_u_mps: 8, inlet_v_mps: 0 },
  sensors: [{ sensor_id: 'S1', x_m: 72, y_m: 328, u_mps: 7.2, v_mps: 0.1 }],
}

function okResponse(): PredictResponse {
  const n = DEFAULT_GRID.nx * DEFAULT_GRID.ny
  return {
    layout_id: LAYOUT_ID,
    scenario_id: 'eastward-inflow',
    grid: { ...DEFAULT_GRID },
    u_mps: new Array(n).fill(1),
    v_mps: new Array(n).fill(0),
  }
}

describe('predict response rejection', () => {
  it('accepts a matching layout, grid, and length', () => {
    expect(validatePredictResponse(request, okResponse())).toBeNull()
  })

  it('rejects mismatched layout, nx/ny, or array length', () => {
    const wrongLayout = { ...okResponse(), layout_id: 'other' }
    expect(validatePredictResponse(request, wrongLayout)).toMatch(/layout_id/)

    const wrongGrid = { ...okResponse(), grid: { ...DEFAULT_GRID, nx: 64 } }
    expect(validatePredictResponse(request, wrongGrid)).toMatch(/grid/)

    const short = okResponse()
    short.u_mps = [1, 2, 3]
    expect(validatePredictResponse(request, short)).toMatch(/u_mps length/)
  })

  it('rejects wrong spacing, nonnumeric vectors, and nonboolean masks', () => {
    const spacing = okResponse()
    spacing.grid.dx_m = 9
    expect(validatePredictResponse(request, spacing)).toMatch(/grid/)
    const invalid = okResponse()
    invalid.u_mps[3] = Number.NaN
    expect(validatePredictResponse(request, invalid)).toMatch(/finite/)
    const mask = { ...okResponse(), is_fluid: new Array(16384).fill(1) } as unknown as PredictResponse
    expect(validatePredictResponse(request, mask)).toMatch(/boolean/)
  })

  it('returns a rejection rather than throwing on absent metadata', () => {
    expect(validatePredictResponse(request, null as unknown as PredictResponse)).toMatch(/object/)
    expect(validatePredictResponse(request, { layout_id: LAYOUT_ID, scenario_id: request.scenario_id } as PredictResponse)).toMatch(/grid/)
  })

  it('accepts null only in explicitly masked cells', () => {
    const masked = { ...okResponse(), is_fluid: Array(16384).fill(true) }
    masked.is_fluid[0] = false
    masked.u_mps[0] = null
    masked.v_mps[0] = null
    expect(validatePredictResponse(request, masked)).toBeNull()
    masked.is_fluid[0] = true
    expect(validatePredictResponse(request, masked)).toMatch(/finite/)
  })
})
