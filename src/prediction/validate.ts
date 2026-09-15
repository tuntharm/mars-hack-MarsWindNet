import type { PredictRequest, PredictResponse } from '../contracts/marswindnet.ts'

export function validatePredictResponse(
  request: PredictRequest,
  response: PredictResponse,
): string | null {
  if (!response || typeof response !== 'object') return 'Rejected prediction: response must be an object.'
  if (request.request_id) {
    if (response.request_id !== request.request_id) return 'Rejected prediction: request_id does not match.'
    if (!response.model || typeof response.model.id !== 'string' || !response.model.id.trim() || typeof response.model.version !== 'string' || !response.model.version.trim()) return 'Rejected prediction: model identity is required.'
    if (typeof response.inference_ms !== 'number' || !Number.isFinite(response.inference_ms) || response.inference_ms < 0) return 'Rejected prediction: inference duration must be finite and non-negative.'
    if (!response.wind || ![response.wind.inlet_u_mps,response.wind.inlet_v_mps].every(v=>typeof v === 'number' && Number.isFinite(v)) || Math.abs(response.wind.inlet_u_mps-request.wind.inlet_u_mps)>1e-6 || Math.abs(response.wind.inlet_v_mps-request.wind.inlet_v_mps)>1e-6) return 'Rejected prediction: wind conditions do not match.'
    if (!Array.isArray(response.is_fluid)) return 'Rejected prediction: dense model requires an explicit mask.'
    if (!response.is_fluid.some(value => value === true)) return 'Rejected prediction: field has no valid fluid cells.'
    if (typeof response.provenance !== 'string' || !response.provenance.trim()) return 'Rejected prediction: model provenance is required.'
  }
  if (response.layout_id !== request.layout_id) {
    return `Rejected prediction: layout_id ${JSON.stringify(response.layout_id)} does not match ${JSON.stringify(request.layout_id)}.`
  }
  if (response.scenario_id !== request.scenario_id) {
    return `Rejected prediction: scenario_id ${JSON.stringify(response.scenario_id)} does not match ${JSON.stringify(request.scenario_id)}.`
  }
  if (!response.grid || typeof response.grid !== 'object' ||
    response.grid.nx !== request.grid.nx || response.grid.ny !== request.grid.ny ||
    response.grid.dx_m !== request.grid.dx_m || response.grid.dy_m !== request.grid.dy_m) {
    return 'Rejected prediction: grid dimensions or spacing do not match the request.'
  }
  const n = request.grid.nx * request.grid.ny
  if (!Array.isArray(response.u_mps) || response.u_mps.length !== n) {
    return `Rejected prediction: u_mps length ${response.u_mps?.length ?? 'missing'} !== ${n}.`
  }
  if (!Array.isArray(response.v_mps) || response.v_mps.length !== n) {
    return `Rejected prediction: v_mps length ${response.v_mps?.length ?? 'missing'} !== ${n}.`
  }
  if (response.is_fluid !== undefined &&
    (!Array.isArray(response.is_fluid) || response.is_fluid.length !== n || response.is_fluid.some((value) => typeof value !== 'boolean'))) {
    return `Rejected prediction: is_fluid must contain ${n} boolean values.`
  }
  const invalidVector = (value: number | null, index: number) =>
    !(typeof value === 'number' && Number.isFinite(value)) && !(value === null && response.is_fluid?.[index] === false)
  if (response.u_mps.some(invalidVector) || response.v_mps.some(invalidVector)) {
    return 'Rejected prediction: vectors must be finite numbers; null requires an explicitly masked cell.'
  }
  if (response.provenance !== undefined && typeof response.provenance !== 'string') return 'Rejected prediction: provenance must be text.'
  return null
}
