import type { CityLayout, PredictResponse, VelocityField } from '../contracts/marswindnet.ts'
import { validatePredictResponse } from '../prediction/validate.ts'
import { buildFluidMask } from '../field/mask.ts'

/** Validates the transport contract, not the solver's scientific accuracy. */
export function parseCfdReference(data: unknown, city: CityLayout, scenarioId: string): VelocityField {
  if (!data || typeof data !== 'object') throw new Error('CFD result must be an object.')
  const result = data as PredictResponse & { kind?: string }
  if (result.kind !== 'cfd-reference') throw new Error('CFD result requires kind: cfd-reference.')
  if (typeof result.provenance !== 'string' || !result.provenance.trim()) throw new Error('CFD solver/case provenance is required.')
  if (!Array.isArray(result.is_fluid)) throw new Error('CFD result requires an explicit is_fluid mask.')
  const error = validatePredictResponse({ layout_id: city.layout_id, scenario_id: scenarioId, grid: city.grid, wind: { inlet_u_mps:0, inlet_v_mps:0 }, sensors:[] }, result)
  if (error) throw new Error(error)
  const mask = buildFluidMask(city).map((fluid, i) => fluid && result.is_fluid![i])
  return {
    layout_id: city.layout_id, scenario_id: scenarioId, source:'cfd', provenance:result.provenance,
    grid: { nx:city.grid.nx, ny:city.grid.ny, dx_m:city.grid.dx_m, dy_m:city.grid.dy_m },
    is_fluid:mask, u:result.u_mps.map((v,i)=>mask[i]?v:null), v:result.v_mps.map((v,i)=>mask[i]?v:null),
  }
}
