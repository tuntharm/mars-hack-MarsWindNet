import type { CityLayout } from '../contracts/marswindnet.ts'
import { DEFAULT_GRID, LAYOUT_ID } from '../contracts/marswindnet.ts'

export function assertCityLayout(data: unknown): CityLayout {
  if (!data || typeof data !== 'object') {
    throw new Error('City layout is not an object')
  }
  const city = data as CityLayout
  if (city.layout_id !== LAYOUT_ID) {
    throw new Error(`Unexpected layout_id ${JSON.stringify(city.layout_id)}`)
  }
  if (city.domain.width_m !== 400 || city.domain.height_m !== 400) {
    throw new Error('City domain must be 400×400 m')
  }
  if (
    city.grid.nx !== DEFAULT_GRID.nx ||
    city.grid.ny !== DEFAULT_GRID.ny ||
    city.grid.dx_m !== DEFAULT_GRID.dx_m ||
    city.grid.dy_m !== DEFAULT_GRID.dy_m
  ) {
    throw new Error('City grid metadata must be 128×128 at 3.125 m')
  }
  if (!Array.isArray(city.obstacles) || !Array.isArray(city.sensors)) {
    throw new Error('City layout missing obstacles or sensors')
  }
  return city
}

export async function loadCityLayout(): Promise<CityLayout> {
  const response = await fetch('/data/city/marswindnet-layout-v2.json')
  if (!response.ok) {
    throw new Error(`Failed to load city layout (${response.status})`)
  }
  return assertCityLayout(await response.json())
}
