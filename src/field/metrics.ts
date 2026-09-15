/** Speed, towards-bearing, and vector-error helpers. Missing stays null; never coerced to 0. */

export function speedMps(u: number | null, v: number | null): number | null {
  if (u === null || v === null) return null
  return Math.hypot(u, v)
}

/**
 * Flow towards bearing from north, clockwise, degrees.
 * atan2(u, v): 0 = north, 90 = east. Range [0, 360).
 */
export function towardsBearingDeg(u: number | null, v: number | null): number | null {
  if (u === null || v === null) return null
  if (u === 0 && v === 0) return null
  const deg = (Math.atan2(u, v) * 180) / Math.PI
  return (deg + 360) % 360
}

export function cardinalFromBearing(deg: number): string {
  const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']
  const idx = Math.round(deg / 45) % 8
  return dirs[idx] ?? 'north'
}

export function vectorErrorMps(
  uRef: number | null,
  vRef: number | null,
  uPred: number | null,
  vPred: number | null,
): number | null {
  if (uRef === null || vRef === null || uPred === null || vPred === null) return null
  return Math.hypot(uPred - uRef, vPred - vRef)
}

export function speedValues(
  u: Array<number | null>,
  v: Array<number | null>,
): Array<number | null> {
  const n = Math.min(u.length, v.length)
  const out: Array<number | null> = new Array(n)
  for (let k = 0; k < n; k++) out[k] = speedMps(u[k] ?? null, v[k] ?? null)
  return out
}

export function vectorErrorValues(
  uRef: Array<number | null>,
  vRef: Array<number | null>,
  uPred: Array<number | null>,
  vPred: Array<number | null>,
): Array<number | null> {
  const n = Math.min(uRef.length, vRef.length, uPred.length, vPred.length)
  const out: Array<number | null> = new Array(n)
  for (let k = 0; k < n; k++) {
    out[k] = vectorErrorMps(uRef[k] ?? null, vRef[k] ?? null, uPred[k] ?? null, vPred[k] ?? null)
  }
  return out
}

export function finiteMax(values: Array<number | null>): number {
  let max = 0
  for (const value of values) {
    if (value !== null && Number.isFinite(value) && value > max) max = value
  }
  return max
}

export function meanFinite(values: Array<number | null>): number | null {
  let sum = 0
  let count = 0
  for (const value of values) {
    if (value !== null && Number.isFinite(value)) {
      sum += value
      count += 1
    }
  }
  if (count === 0) return null
  return sum / count
}
