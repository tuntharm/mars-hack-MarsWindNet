import type { ColourKind } from '../contracts/marswindnet.ts'

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function rgb(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

type Stop = [number, number, number]

function sampleStops(stops: Stop[], t: number): string {
  const x = Math.min(1, Math.max(0, t))
  if (stops.length === 0) return rgb(0, 0, 0)
  if (stops.length === 1) {
    const only = stops[0]!
    return rgb(only[0], only[1], only[2])
  }
  const scaled = x * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(scaled))
  const f = scaled - i
  const a = stops[i]!
  const b = stops[i + 1]!
  return rgb(lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f))
}

/** Speed: deep navy → cyan → sand → rust orange. */
const SPEED_STOPS: Stop[] = [
  [8, 22, 48],
  [12, 92, 140],
  [40, 186, 168],
  [232, 206, 92],
  [232, 92, 28],
]

/** Vector error: ivory → amber → oxide red. Own labelled scale, not speed. */
const ERROR_STOPS: Stop[] = [
  [246, 236, 214],
  [232, 176, 72],
  [214, 92, 36],
  [132, 28, 24],
]

export function colourForValue(
  value: number | null,
  min: number,
  max: number,
  kind: ColourKind,
): string | null {
  if (value === null || !Number.isFinite(value)) return null
  const span = max - min
  const t = span <= 0 ? 0 : (value - min) / span
  return sampleStops(kind === 'vector-error' ? ERROR_STOPS : SPEED_STOPS, t)
}

export function legendGradient(kind: ColourKind): string {
  const stops = kind === 'vector-error' ? ERROR_STOPS : SPEED_STOPS
  const parts = stops.map((stop, i) => {
    const pct = stops.length === 1 ? 0 : (i / (stops.length - 1)) * 100
    return `${rgb(stop[0], stop[1], stop[2])} ${pct}%`
  })
  return `linear-gradient(90deg, ${parts.join(', ')})`
}
