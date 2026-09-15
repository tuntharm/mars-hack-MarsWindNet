import { MathUtils, Vector3 } from 'three'
import type { CityLayout } from '../contracts/marswindnet'

/** Fit physical extents, including station markers; this never rescales the city. */
export function fitNetworkCamera(city: CityLayout, width: number, height: number, radius = 0, top = false) {
  const cx = city.domain.width_m / 2, cy = city.domain.height_m / 2
  const rx = radius || cx, ry = radius || cy
  const target = new Vector3(cx, 0, -cy)
  const direction = new Vector3(...(top || radius ? [0, 1, .001] : [.42, .85, 1]) as [number, number, number]).normalize()
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize()
  const up = new Vector3().crossVectors(direction, right)
  const tv = Math.tan(MathUtils.degToRad(20)), th = tv * width / height
  let distance = 0
  // Extra space keeps labels clear of the top toolbar and bottom legend on phones.
  const margin = width < 700 ? radius ? 1.9 : 1.55 : 1.3
  for (const x of [cx - rx, cx + rx]) for (const y of [0, 35]) for (const z of [-cy - ry, -cy + ry]) {
    const offset = new Vector3(x, y, z).sub(target), depth = offset.dot(direction)
    distance = Math.max(distance, Math.abs(offset.dot(right)) * margin / th + depth, Math.abs(offset.dot(up)) * margin / tv + depth)
  }
  return { target, position: target.clone().addScaledVector(direction, distance) }
}
