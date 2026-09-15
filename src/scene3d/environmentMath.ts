import * as THREE from 'three'
import { DOMAIN_M } from '../contracts/marswindnet'

function hash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return value - Math.floor(value)
}
function smooth(value: number): number { return value * value * (3 - 2 * value) }
export function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), tx = smooth(x - ix), ty = smooth(y - iy)
  const a = THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), tx)
  const b = THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), tx)
  return THREE.MathUtils.lerp(a, b, ty)
}
export function fbm(x: number, y: number): number {
  return noise(x, y) * .57 + noise(x * 2.07 + 13.7, y * 2.07 - 9.4) * .27 + noise(x * 4.31 - 7.5, y * 4.31 + 2.1) * .11 + noise(x * 8.9, y * 8.9) * .05
}
/** Decorative elevation only. A 100 m flat margin prevents mesh triangles sloping into the analysis domain. */
export function terrainElevationAt(worldX: number, worldZ: number): number {
  const dx = Math.max(0, -worldX, worldX - DOMAIN_M)
  const dz = Math.max(0, worldZ, -DOMAIN_M - worldZ)
  const outside = Math.hypot(dx, dz)
  if (outside <= 100) return -.12
  const ramp = smooth(THREE.MathUtils.clamp((outside - 100) / 330, 0, 1))
  const broad = fbm((worldX + 830) * .00165, (worldZ - 170) * .00165)
  const ridged = 1 - Math.abs(fbm(worldX * .0037 - 3, worldZ * .0037 + 8) * 2 - 1)
  const detail = fbm(worldX * .013, worldZ * .013) * 8
  return -.12 + ramp * (Math.pow(Math.max(0, broad - .22), 1.3) * 300 + ridged * 32 + detail)
}
