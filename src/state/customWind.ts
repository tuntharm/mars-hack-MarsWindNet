import { DEFAULT_GRID, LAYOUT_ID } from '../contracts/marswindnet'
import type { CityLayout, ModelInfo, PredictRequest, ScenarioSensorObservations } from '../contracts/marswindnet'
import { parseCfdReference } from '../data/cfd'

export const CUSTOM_WIND = 'custom-wind'
export type InletWind = PredictRequest['wind']

export function uniformWind(speed: number, bearing: number): InletWind {
  if (!Number.isFinite(speed) || speed < 0 || !Number.isFinite(bearing) || bearing < 0 || bearing > 360) {
    throw new Error('Enter a non-negative speed and a direction from 0 to 360°.')
  }
  const rad = bearing * Math.PI / 180
  const clean = (n: number) => Math.abs(n) < 1e-12 ? 0 : n
  return { inlet_u_mps: clean(speed * Math.sin(rad)), inlet_v_mps: clean(speed * Math.cos(rad)) }
}

export function uniformObservations(city: CityLayout, wind: InletWind) {
  const make = (stations: { id: string; x_m: number; y_m: number }[]): ScenarioSensorObservations => ({
    layout_id: city.layout_id, scenario_id: CUSTOM_WIND, source:'simulated-uniform',
    provenance:'Simulated uniform input · not live sensor readings',
    readings: stations.map(s => ({ sensor_id:s.id, x_m:s.x_m, y_m:s.y_m, u_mps:wind.inlet_u_mps, v_mps:wind.inlet_v_mps })),
  })
  return { local:make(city.sensors.filter(s=>s.use_for_prediction)), regional:make(city.regional_sensors) }
}

export function validateModelInfo(data: unknown): ModelInfo {
  if (!data || typeof data !== 'object') throw new Error('Invalid model capability response.')
  const m = data as ModelInfo
  if (m.status === 'not-connected') return {status:m.status,message:typeof m.message === 'string' ? m.message : 'Model not connected'}
  const limits=m.limits
  if (m.status !== 'ready' || m.prediction_kind !== 'steady-field' || m.layout_id !== LAYOUT_ID ||
    !m.model || typeof m.model.id !== 'string' || !m.model.id.trim() || typeof m.model.version !== 'string' || !m.model.version.trim() ||
    !m.grid || Object.entries(DEFAULT_GRID).some(([k,v])=>m.grid![k as keyof typeof DEFAULT_GRID] !== v) ||
    !Array.isArray(m.sensor_ids) || [...m.sensor_ids].sort().join(',') !== 'S1,S2,S4,S5' ||
    !limits || !Number.isFinite(limits.speed_min_mps) || !Number.isFinite(limits.speed_max_mps) ||
    limits.speed_min_mps < 0 || limits.speed_max_mps < limits.speed_min_mps ||
    !(limits.directions_deg === null || Array.isArray(limits.directions_deg) && limits.directions_deg.length > 0 && limits.directions_deg.every(v=>typeof v === 'number' && Number.isFinite(v) && v>=0 && v<360))) {
    throw new Error('Model is incompatible with the 500 m, 128 × 128 four-corner field contract.')
  }
  return m
}

export function windSupportError(info: ModelInfo | null, speed: number, bearing: number): string | null {
  try { uniformWind(speed,bearing) } catch(e) { return (e as Error).message }
  if (info?.status !== 'ready') return 'Connect a compatible field model to generate a prediction.'
  const limits = info.limits!
  if (speed < limits.speed_min_mps || speed > limits.speed_max_mps) return `Supported speed: ${limits.speed_min_mps}–${limits.speed_max_mps} m/s.`
  if (speed > 0 && limits.directions_deg && !limits.directions_deg.some(v=>Math.abs(v-bearing%360)<1e-6)) return `Supported flow directions: ${limits.directions_deg.join('°, ')}°.`
  return null
}

export function sameWind(a: unknown, b: InletWind): boolean {
  if (!a || typeof a !== 'object') return false
  const w=a as InletWind
  return [w.inlet_u_mps,w.inlet_v_mps].every(v=>typeof v === 'number' && Number.isFinite(v)) &&
    Math.abs(w.inlet_u_mps-b.inlet_u_mps)<1e-6 && Math.abs(w.inlet_v_mps-b.inlet_v_mps)<1e-6
}

export function parseCustomReference(data: unknown, city: CityLayout, wind: InletWind) {
  if (!data || typeof data !== 'object' || !sameWind((data as {wind:unknown}).wind,wind)) {
    throw new Error('Reference wind does not match the current incoming wind. Supply matching wind metadata.')
  }
  const result=parseCfdReference(data,city,CUSTOM_WIND)
  return {...result,wind}
}
