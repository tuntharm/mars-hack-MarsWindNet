import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CELL_COUNT, FIRST_CENTRE_M, NX } from '../contracts/marswindnet.ts'
import { cellCentre, gridIndex } from './grid.ts'

describe('grid index order', () => {
  it('uses j*nx+i with i west→east and j south→north', () => {
    expect(gridIndex(0, 0)).toBe(0)
    expect(gridIndex(1, 0)).toBe(1)
    expect(gridIndex(0, 1)).toBe(NX)
    expect(gridIndex(127, 127)).toBe(CELL_COUNT - 1)
  })

  it('places the first cell centre at (1.953125, 1.953125)', () => {
    expect(cellCentre(0, 0)).toEqual({ x: FIRST_CENTRE_M, y: FIRST_CENTRE_M })
    expect(cellCentre(127, 127)).toEqual({ x: 498.046875, y: 498.046875 })
  })
})

export function loadTestCity() {
  return JSON.parse(
    readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8'),
  )
}
