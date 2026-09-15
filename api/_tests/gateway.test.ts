// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleGateway } from '../_lib/gateway.ts'
import { DEFAULT_GRID, LAYOUT_ID, type PredictRequest } from '../../src/contracts/marswindnet.ts'

function payload(): PredictRequest {
  return { request_id: 'request-1', scenario_id: 'custom-wind', layout_id: LAYOUT_ID, grid: { ...DEFAULT_GRID },
    wind: { inlet_u_mps: 8, inlet_v_mps: 0 }, sensors: [
      { sensor_id: 'S1', x_m: 0, y_m: 500, u_mps: 8, v_mps: 0 },
      { sensor_id: 'S2', x_m: 0, y_m: 0, u_mps: 8, v_mps: 0 },
      { sensor_id: 'S4', x_m: 500, y_m: 500, u_mps: 8, v_mps: 0 },
      { sensor_id: 'S5', x_m: 500, y_m: 0, u_mps: 8, v_mps: 0 },
    ] }
}
function field() {
  return { request_id: 'request-1', scenario_id: 'custom-wind', layout_id: LAYOUT_ID, grid: { ...DEFAULT_GRID },
    wind: { inlet_u_mps: 8, inlet_v_mps: 0 }, model: { id: 'test-model', version: 'v1' }, inference_ms: 12,
    provenance: 'Contract test, not trained-model evidence.',
    u_mps: Array(16384).fill(8), v_mps: Array(16384).fill(0), is_fluid: Array(16384).fill(true) }
}
function info() {
  return { status: 'ready', model: { id: 'test-model', version: 'v1' }, layout_id: LAYOUT_ID, grid: { ...DEFAULT_GRID },
    prediction_kind: 'steady-field', sensor_ids: ['S1', 'S2', 'S4', 'S5'],
    limits: { speed_min_mps: 0, speed_max_mps: 20, directions_deg: null } }
}
const post = (value: unknown = payload(), signal?: AbortSignal) => new Request('https://site.example/api/predict', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), signal,
})
const get = () => new Request('https://site.example/api/model-info')

beforeEach(() => {
  vi.stubEnv('MODEL_API_URL', 'https://model.example')
  vi.stubEnv('MODEL_API_TOKEN', 'test-secret')
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('hosted model gateway', () => {
  it('reports missing configuration without calling any backend', async () => {
    vi.stubEnv('MODEL_API_URL', '')
    expect(await (await handleGateway(get(), '/model-info')).json()).toEqual({ status: 'not-connected', message: 'Model not connected.' })
    expect((await handleGateway(post(), '/predict')).status).toBe(503)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('uses server credentials and a fixed path while stripping arbitrary inputs', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json(field()))
    const response = await handleGateway(post({ ...payload(), url: 'https://attacker.example' }), '/predict')
    expect(response.status).toBe(200)
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe('https://model.example/predict')
    expect(options?.redirect).toBe('error')
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer test-secret' })
    expect(JSON.parse(options?.body as string)).toEqual(payload())
    expect(await response.text()).not.toContain('test-secret')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('validates and normalises model capabilities', async () => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...info(), internal_url: 'private' }))
    const response = await handleGateway(get(), '/model-info')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(info())
  })
  it.each([
    { grid: { ...DEFAULT_GRID, nx: 1 } }, { sensor_ids: ['S1', 'S2', 'S3', 'S4'] },
    { prediction_kind: 'centre-only' }, { limits: { speed_min_mps: 0, speed_max_mps: 20, directions_deg: [-1] } },
  ])('rejects incompatible model capabilities %j', async (change) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...info(), ...change }))
    expect((await handleGateway(get(), '/model-info')).status).toBe(502)
  })
  it.each([
    { request_id: undefined }, { grid: { ...DEFAULT_GRID, dx_m: 1 } }, { layout_id: 'other-city' },
    { wind: { inlet_u_mps: null, inlet_v_mps: 0 } },
    { sensors: [...payload().sensors.slice(0, 3), { ...payload().sensors[3], sensor_id: 'S3' }] },
    { sensors: [...payload().sensors.slice(0, 3), { ...payload().sensors[3], x_m: 499 }] },
    { sensors: [payload().sensors[0], ...payload().sensors.slice(0, 3)] },
  ])('rejects invalid requests before fetching %j', async (change) => {
    expect((await handleGateway(post({ ...payload(), ...change }), '/predict')).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([
    { request_id: 'stale' }, { model: undefined }, { inference_ms: -1 }, { is_fluid: undefined },
    { wind: { inlet_u_mps: 9, inlet_v_mps: 0 } }, { u_mps: [8] }, { provenance: '' },
  ])('rejects malformed or stale field output %j', async (change) => {
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...field(), ...change }))
    expect((await handleGateway(post(), '/predict')).status).toBe(502)
  })
  it('rejects streamed oversized request and response bodies without a content length', async () => {
    const oversized = new Request('https://site.example/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(65536) })
    expect((await handleGateway(oversized, '/predict')).status).toBe(413)
    expect(fetch).not.toHaveBeenCalled()
    vi.mocked(fetch).mockResolvedValue(new Response(' '.repeat(4_000_000)))
    expect((await handleGateway(post(), '/predict')).status).toBe(502)
  })
  it.each(['http://remote.example', 'http://localhost:8001', 'https://user:password@model.example', 'https://model.example?token=secret'])('rejects unsafe hosted configuration %s', async (url) => {
    vi.stubEnv('MODEL_API_URL', url)
    const response = await handleGateway(get(), '/model-info')
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain(url)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('allows a local model only in development', async () => {
    vi.stubEnv('MODEL_API_URL', 'http://127.0.0.1:8001')
    vi.stubEnv('VERCEL_ENV', 'development')
    vi.mocked(fetch).mockResolvedValue(Response.json(info()))
    expect((await handleGateway(get(), '/model-info')).status).toBe(200)
  })
  it('returns explicit method and content-type failures', async () => {
    expect((await handleGateway(get(), '/predict')).status).toBe(405)
    const plain = new Request('https://site.example/api/predict', { method: 'POST', body: '{}' })
    expect((await handleGateway(plain, '/predict')).status).toBe(415)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('never returns backend error text or thrown credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('credential test-secret', { status: 500 }))
    expect(await (await handleGateway(post(), '/predict')).text()).not.toContain('test-secret')
    vi.mocked(fetch).mockRejectedValue(new Error('https://model.example?token=test-secret'))
    expect(await (await handleGateway(post(), '/predict')).text()).not.toContain('test-secret')
  })
  it('aborts the backend at 45 seconds and reports a timeout', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const response = handleGateway(get(), '/model-info')
    await vi.advanceTimersByTimeAsync(45_000)
    expect((await response).status).toBe(504)
  })
  it('also times out a stalled response body after headers arrive', async () => {
    vi.useFakeTimers()
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('{')) },
      cancel() { cancelled = true },
    })
    vi.mocked(fetch).mockResolvedValue(new Response(body))
    const response = handleGateway(get(), '/model-info')
    await vi.advanceTimersByTimeAsync(45_000)
    expect((await response).status).toBe(504)
    expect(cancelled).toBe(true)
  })
  it('propagates client cancellation to upstream', async () => {
    const controller = new AbortController()
    vi.mocked(fetch).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
    }))
    const response = handleGateway(new Request('https://site.example/api/model-info', { signal: controller.signal }), '/model-info')
    controller.abort()
    expect((await response).status).toBe(499)
  })
})
