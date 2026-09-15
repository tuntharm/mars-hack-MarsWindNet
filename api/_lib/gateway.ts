import { DEFAULT_GRID, DOMAIN_M, LAYOUT_ID, type ModelInfo, type PredictRequest, type PredictResponse } from '../../src/contracts/marswindnet.js'
import { validatePredictResponse } from '../../src/prediction/validate.js'

const REQUEST_LIMIT = 64 * 1024
const RESPONSE_LIMIT = 4_000_000
const INPUT_POSITIONS: Record<string, [number, number]> = {
  S1: [0, DOMAIN_M], S2: [0, 0], S4: [DOMAIN_M, DOMAIN_M], S5: [DOMAIN_M, 0],
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[\w.-]{1,128}$/.test(value)
const modelIdentity = (value: unknown): value is { id: string; version: string } => {
  if (!value || typeof value !== 'object') return false
  const model = value as { id?: unknown; version?: unknown }
  return identifier(model.id) && identifier(model.version)
}
const correctGrid = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  const grid = value as Record<string, unknown>
  return Object.entries(DEFAULT_GRID).every(([key, expected]) => grid[key] === expected)
}

export function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...extraHeaders } })
}
export function methodNotAllowed(allow: string): Response {
  return json({ error: 'Method not allowed.' }, 405, { Allow: allow })
}
class GatewayError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function limitedJson(body: Request | Response, limit: number, status: number, signal: AbortSignal): Promise<unknown> {
  if (Number(body.headers.get('content-length')) >= limit) {
    await body.body?.cancel()
    throw new GatewayError(status === 400 ? 413 : status, 'Payload exceeds the allowed size.')
  }
  if (!body.body) throw new GatewayError(status, 'Missing JSON payload.')
  const reader = body.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => {}) }
  if (signal.aborted) cancel()
  signal.addEventListener('abort', cancel, { once: true })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size >= limit) {
        await reader.cancel()
        throw new GatewayError(status === 400 ? 413 : status, 'Payload exceeds the allowed size.')
      }
      chunks.push(result.value)
    }
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock() }
  if (signal.aborted) throw new Error('Request aborted')
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder().decode(bytes)) }
  catch { throw new GatewayError(status, 'Invalid JSON payload.') }
}

export function validateRequest(value: unknown): PredictRequest {
  if (!value || typeof value !== 'object') throw new GatewayError(400, 'Invalid prediction request.')
  const request = value as PredictRequest
  if (!identifier(request.request_id) || !identifier(request.scenario_id) || request.layout_id !== LAYOUT_ID || !correctGrid(request.grid)) {
    throw new GatewayError(400, 'Request identity, layout or grid is invalid.')
  }
  if (!request.wind || !finite(request.wind.inlet_u_mps) || !finite(request.wind.inlet_v_mps)) {
    throw new GatewayError(400, 'Incoming wind must contain finite u and v values.')
  }
  if (!Array.isArray(request.sensors) || request.sensors.length !== 4 || new Set(request.sensors.map(s => s?.sensor_id)).size !== 4) {
    throw new GatewayError(400, 'Exactly four unique corner inputs are required: S1, S2, S4, S5.')
  }
  for (const sensor of request.sensors) {
    const position = sensor && INPUT_POSITIONS[sensor.sensor_id]
    if (!position || sensor.x_m !== position[0] || sensor.y_m !== position[1] || !finite(sensor.u_mps) || !finite(sensor.v_mps)) {
      throw new GatewayError(400, 'Sensor IDs, coordinates or wind values are invalid.')
    }
  }
  // Forward only contracted inputs, never arbitrary client fields or destinations.
  return {
    request_id: request.request_id, layout_id: LAYOUT_ID, scenario_id: request.scenario_id,
    grid: { ...DEFAULT_GRID }, wind: { inlet_u_mps: request.wind.inlet_u_mps, inlet_v_mps: request.wind.inlet_v_mps },
    sensors: request.sensors.map(({ sensor_id, x_m, y_m, u_mps, v_mps }) => ({ sensor_id, x_m, y_m, u_mps, v_mps })),
  }
}

export function validateInfo(value: unknown): ModelInfo {
  if (!value || typeof value !== 'object') throw new GatewayError(502, 'Model capability response is invalid.')
  const info = value as ModelInfo
  if (info.status === 'not-connected') return { status: 'not-connected', message: 'Model not connected.' }
  const limits = info.limits
  if (info.status !== 'ready' || !modelIdentity(info.model) || info.layout_id !== LAYOUT_ID || !correctGrid(info.grid) ||
    info.prediction_kind !== 'steady-field' || !Array.isArray(info.sensor_ids) || info.sensor_ids.length !== 4 ||
    new Set(info.sensor_ids).size !== 4 || info.sensor_ids.some(id => !Object.hasOwn(INPUT_POSITIONS, id)) || !limits ||
    !finite(limits.speed_min_mps) || !finite(limits.speed_max_mps) || limits.speed_min_mps < 0 || limits.speed_max_mps < limits.speed_min_mps ||
    !(limits.directions_deg === null || (Array.isArray(limits.directions_deg) && limits.directions_deg.length > 0 &&
      limits.directions_deg.every(d => finite(d) && d >= 0 && d < 360)))) {
    throw new GatewayError(502, 'Model capabilities do not match the required city field contract.')
  }
  return { status: 'ready', model: { id: info.model.id, version: info.model.version }, layout_id: LAYOUT_ID,
    grid: { ...DEFAULT_GRID }, sensor_ids: [...info.sensor_ids], prediction_kind: 'steady-field',
    limits: { speed_min_mps: limits.speed_min_mps, speed_max_mps: limits.speed_max_mps, directions_deg: limits.directions_deg } }
}

function validateField(request: PredictRequest, value: unknown): PredictResponse {
  const response = value as PredictResponse
  if (validatePredictResponse(request, response)) {
    throw new GatewayError(502, 'Model returned an incompatible or invalid field.')
  }
  return { request_id: response.request_id, layout_id: response.layout_id, scenario_id: response.scenario_id,
    grid: { ...DEFAULT_GRID }, model: response.model,
    inference_ms: response.inference_ms, wind: { ...request.wind }, provenance: response.provenance,
    u_mps: response.u_mps, v_mps: response.v_mps, is_fluid: response.is_fluid }
}

function backendUrl(path: '/predict' | '/model-info'): URL | null {
  const configured = process.env.MODEL_API_URL?.trim()
  if (!configured) return null
  let base: URL
  try { base = new URL(configured) } catch { throw new GatewayError(503, 'Model service configuration is invalid.') }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  const hosted = Boolean(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'development') || process.env.NODE_ENV === 'production'
  if ((base.protocol !== 'https:' && !(local && !hosted && base.protocol === 'http:')) ||
    (local && hosted) || base.username || base.password || base.search || base.hash) {
    throw new GatewayError(503, 'Model service configuration is invalid.')
  }
  // Base path is operator-configured; endpoint suffix is fixed by this handler.
  base.pathname = `${base.pathname.replace(/\/$/, '')}${path}`
  return base
}

export async function handleGateway(request: Request, path: '/predict' | '/model-info'): Promise<Response> {
  const method = path === '/predict' ? 'POST' : 'GET'
  if (request.method !== method) return methodNotAllowed(method)
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (request.signal.aborted) abort()
  request.signal.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, 45_000)
  try {
    const url = backendUrl(path)
    if (!url) return path === '/model-info'
      ? json({ status: 'not-connected', message: 'Model not connected.' })
      : json({ error: 'Model not connected.' }, 503)
    let payload: PredictRequest | undefined
    if (path === '/predict') {
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'Content-Type must be application/json.' }, 415)
      payload = validateRequest(await limitedJson(request, REQUEST_LIMIT, 400, controller.signal))
    }
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (payload) headers['Content-Type'] = 'application/json'
    const token = process.env.MODEL_API_TOKEN?.trim()
    if (token) headers.Authorization = `Bearer ${token}`
    const upstream = await fetch(url, {
      method, headers, body: payload ? JSON.stringify(payload) : undefined, signal: controller.signal, redirect: 'error',
    })
    if (!upstream.ok) {
      await upstream.body?.cancel()
      return json({ error: upstream.status === 422 ? 'These inputs are outside the model’s supported conditions.' : 'Model service unavailable. Please retry.' }, upstream.status === 422 ? 422 : 502)
    }
    const value = await limitedJson(upstream, RESPONSE_LIMIT, 502, controller.signal)
    const result = payload ? validateField(payload, value) : validateInfo(value)
    const serialized = JSON.stringify(result)
    if (Buffer.byteLength(serialized) >= RESPONSE_LIMIT) throw new GatewayError(502, 'Model field exceeds the allowed size.')
    return new Response(serialized, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (timedOut) return json({ error: 'Model request timed out after 45 seconds. Please retry.' }, 504)
    if (request.signal.aborted) return json({ error: 'Request cancelled.' }, 499)
    if (error instanceof GatewayError) return json({ error: error.message }, error.status)
    // Never return backend exception bodies, URLs or credentials to a client.
    return json({ error: 'Model service unavailable. Please retry.' }, 502)
  } finally {
    clearTimeout(timer)
    request.signal.removeEventListener('abort', abort)
  }
}
