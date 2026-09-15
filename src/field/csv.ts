import type { GridMeta, VelocityField } from '../contracts/marswindnet.ts'
import { DEFAULT_GRID, LAYOUT_ID } from '../contracts/marswindnet.ts'
import { cellCentre } from './grid.ts'
import { COMPARISON_BANNER, ILLUSTRATIVE_BANNER } from './fixtures.ts'

export function parseNumericCell(raw: string | undefined): number | null {
  if (raw === undefined) return null
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

export function parseFluidFlag(raw: string | undefined): boolean {
  if (raw === undefined) return false
  const trimmed = raw.trim().toLowerCase()
  return trimmed === '1' || trimmed === 'true' || trimmed === 'yes'
}

function splitCsvLine(line: string): string[] {
  return line.split(',').map((part) => part.trim())
}

export type PairedFields = {
  reference: VelocityField
  prediction: VelocityField
}

export function parsePairedCsv(
  text: string,
  layoutId: string = LAYOUT_ID,
  scenarioId: string = 'eastward-inflow',
  grid: GridMeta = DEFAULT_GRID,
): PairedFields {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    throw new Error('paired CSV has no data rows')
  }
  const header = splitCsvLine(lines[0] ?? '')
  const expected = [
    'point_id',
    'x_m',
    'y_m',
    'is_fluid',
    'u_cfd_mps',
    'v_cfd_mps',
    'u_ml_mps',
    'v_ml_mps',
  ]
  if (expected.some((name, i) => header[i] !== name)) {
    throw new Error(`paired CSV header must be ${expected.join(',')}`)
  }

  const n = grid.nx * grid.ny
  const is_fluid = new Array<boolean>(n).fill(false)
  const uCfd: Array<number | null> = new Array(n).fill(null)
  const vCfd: Array<number | null> = new Array(n).fill(null)
  const uMl: Array<number | null> = new Array(n).fill(null)
  const vMl: Array<number | null> = new Array(n).fill(null)
  const seen = new Set<number>()

  for (let row = 1; row < lines.length; row++) {
    const cols = splitCsvLine(lines[row] ?? '')
    const pointId = parseNumericCell(cols[0])
    const x = parseNumericCell(cols[1])
    const y = parseNumericCell(cols[2])
    if (pointId === null || !Number.isInteger(pointId) || pointId < 0 || pointId >= n) throw new Error(`paired CSV row ${row}: invalid point_id`)
    const index = pointId
    if (seen.has(index)) throw new Error(`paired CSV row ${row}: duplicate point_id ${index}`)
    seen.add(index)
    const centre = cellCentre(index % grid.nx, Math.floor(index / grid.nx), grid)
    if (x === null || y === null || Math.abs(x - centre.x) > 1e-6 || Math.abs(y - centre.y) > 1e-6) {
      throw new Error(`paired CSV row ${row}: coordinates do not match the declared grid`)
    }
    const fluid = parseFluidFlag(cols[3])
    is_fluid[index] = fluid
    if (fluid) {
      uCfd[index] = parseNumericCell(cols[4])
      vCfd[index] = parseNumericCell(cols[5])
      uMl[index] = parseNumericCell(cols[6])
      vMl[index] = parseNumericCell(cols[7])
    } else {
      uCfd[index] = null
      vCfd[index] = null
      uMl[index] = null
      vMl[index] = null
    }
  }

  const provenance = 'SAVED ILLUSTRATIVE PAIR — NOT LIVE INFERENCE'
  const shared = {
    layout_id: layoutId,
    scenario_id: scenarioId,
    source: 'saved' as const,
    grid: { ...grid },
    is_fluid,
  }
  return {
    reference: { ...shared, provenance: scenarioId === 'illustrative-obstacle-flow' ? ILLUSTRATIVE_BANNER : provenance, u: uCfd, v: vCfd },
    prediction: { ...shared, provenance: scenarioId === 'illustrative-obstacle-flow' ? COMPARISON_BANNER : provenance, u: uMl, v: vMl },
  }
}
