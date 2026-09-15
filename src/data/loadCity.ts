import type { CityLayout } from '../contracts/marswindnet.ts'
import { DEFAULT_GRID, DOMAIN_M, LAYOUT_ID } from '../contracts/marswindnet.ts'

export function assertCityLayout(data: unknown): CityLayout {
  if (!data || typeof data !== 'object') {
    throw new Error('City layout is not an object')
  }
  const city = data as CityLayout
  if (city.layout_id !== LAYOUT_ID) {
    throw new Error(`Unexpected layout_id ${JSON.stringify(city.layout_id)}`)
  }
  if (city.domain.width_m !== DOMAIN_M || city.domain.height_m !== DOMAIN_M) {
    throw new Error('City domain must be 500×500 m')
  }
  if (
    city.grid.nx !== DEFAULT_GRID.nx ||
    city.grid.ny !== DEFAULT_GRID.ny ||
    city.grid.dx_m !== DEFAULT_GRID.dx_m ||
    city.grid.dy_m !== DEFAULT_GRID.dy_m
  ) {
    throw new Error('City grid metadata must be 128×128 at 3.90625 m')
  }
  if (!Array.isArray(city.obstacles) || !Array.isArray(city.sensors)) {
    throw new Error('City layout missing obstacles or sensors')
  }
  if (!Array.isArray(city.regional_sensors) || city.regional_sensors.length !== 24 || city.sensors.length !== 5) throw new Error('City requires five local and 24 regional stations')
  const ids = new Set(city.sensors.map(s => s.id))
  for (const s of city.regional_sensors) {
    if (ids.has(s.id) || s.model_role !== 'regional_observation' || s.use_for_prediction !== false || ![1000,5000,10000].includes(s.radius_m) || ![s.x_m,s.y_m,s.bearing_deg].every(Number.isFinite)) throw new Error('Invalid regional sensor specification')
    const angle = s.bearing_deg * Math.PI / 180
    if (Math.abs(s.x_m - (DOMAIN_M/2 + s.radius_m*Math.sin(angle))) > 1e-5 || Math.abs(s.y_m - (DOMAIN_M/2 + s.radius_m*Math.cos(angle))) > 1e-5) throw new Error('Regional station does not match its radius and bearing')
    ids.add(s.id)
  }
  for (const r of [1000,5000,10000]) if (new Set(city.regional_sensors.filter(s => s.radius_m === r).map(s => s.bearing_deg)).size !== 8) throw new Error('Each sensor ring requires eight distinct bearings')
  return city
}

export async function loadCityLayout(): Promise<CityLayout> {
  const response = await fetch('/data/city/marswindnet-layout-v2.json')
  if (!response.ok) {
    throw new Error(`Failed to load city layout (${response.status})`)
  }
  return assertCityLayout(await response.json())
}
