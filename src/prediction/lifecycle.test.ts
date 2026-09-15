import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GRID, LAYOUT_ID } from '../contracts/marswindnet.ts'
import { requestPrediction } from './client.ts'
import { createPredictLifecycle, isAbortError } from './lifecycle.ts'

const request = {
  layout_id: LAYOUT_ID,
  scenario_id: 'eastward-inflow',
  grid: { ...DEFAULT_GRID },
  wind: { inlet_u_mps: 8, inlet_v_mps: 0 },
  sensors: [{ sensor_id: 'S1', x_m: 72, y_m: 328, u_mps: 8, v_mps: 0 }],
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('predict abort on scenario change', () => {
  it('aborts the in-flight request when a new scenario starts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new DOMException('Aborted', 'AbortError')
            reject(error)
          })
        })
      }),
    )

    const lifecycle = createPredictLifecycle()
    const firstSignal = lifecycle.start()
    const pending = requestPrediction(request, firstSignal, 'http://127.0.0.1:9/predict')
    lifecycle.abortInFlight()
    expect(firstSignal.aborted).toBe(true)
    await expect(pending).rejects.toSatisfy((error: unknown) => isAbortError(error))
  })
})
