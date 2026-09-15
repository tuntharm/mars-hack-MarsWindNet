import type { PredictRequest, PredictResponse, VelocityField } from '../contracts/marswindnet.ts'
import { LAYOUT_ID } from '../contracts/marswindnet.ts'
import { buildFluidMask } from '../field/mask.ts'
import type { CityLayout } from '../contracts/marswindnet.ts'
import { validatePredictResponse } from './validate.ts'

export const DEFAULT_PREDICT_URL = '/api/predict'

export function predictUrl(): string {
  return (import.meta.env.DEV && import.meta.env.VITE_PREDICTION_MODE === 'stub' && import.meta.env.VITE_PREDICT_URL?.trim()) || DEFAULT_PREDICT_URL
}

export async function requestPrediction(
  request: PredictRequest,
  signal: AbortSignal,
  url: string = predictUrl(),
): Promise<PredictResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.any([signal, AbortSignal.timeout(50_000)]),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Prediction HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}`)
  }
  return (await response.json()) as PredictResponse
}

export function responseToField(
  request: PredictRequest,
  response: PredictResponse,
  city: CityLayout,
): { field: VelocityField } | { error: string } {
  const rejected = validatePredictResponse(request, response)
  if (rejected) return { error: rejected }

  const geometryMask = buildFluidMask(city, request.grid.nx, request.grid.ny)
  const mask = geometryMask.map((fluid, index) => fluid && (response.is_fluid?.[index] ?? true))

  const provenance = response.provenance?.trim() || 'live prediction'
  const stubby = /stub/i.test(provenance) || /not trained/i.test(provenance)
  const u: Array<number | null> = response.u_mps.map((value, i) => (mask[i] ? value : null))
  const v: Array<number | null> = response.v_mps.map((value, i) => (mask[i] ? value : null))

  return {
    field: {
      layout_id: response.layout_id || LAYOUT_ID,
      scenario_id: response.scenario_id,
      source: stubby ? 'stub' : 'live',
      provenance: stubby ? provenance : provenance || 'live prediction',
      grid: { ...response.grid },
      u,
      v,
      is_fluid: mask,
      model: response.model,
      inference_ms: response.inference_ms,
      wind: response.wind,
    },
  }
}
