/* oxlint-disable react/immutability -- Typed animation buffers and Three objects are intentionally mutated outside React state. */
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { CitySceneProps } from '../contracts/marswindnet'
import { advanceParticle, sampleVelocity, segmentHitsObstacle, textureBytes } from './flowMath'
import type { XY } from './flowMath'

export function ColourSurface({ city, field, colour }: Pick<CitySceneProps, 'city' | 'field' | 'colour'>) {
  const surface = useMemo(() => {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(city.domain.width_m, 0); s.lineTo(city.domain.width_m, city.domain.height_m); s.lineTo(0, city.domain.height_m); s.closePath()
    for (const o of city.obstacles) {
      const h = new THREE.Path()
      if (o.kind === 'box') { const x = o.cx_m - o.width_m / 2, y = o.cy_m - o.depth_m / 2; h.moveTo(x, y); h.lineTo(x, y + o.depth_m); h.lineTo(x + o.width_m, y + o.depth_m); h.lineTo(x + o.width_m, y); h.closePath() }
      else h.absarc(o.cx_m, o.cy_m, o.radius_m, 0, Math.PI * 2, true)
      s.holes.push(h)
    }
    const geometry = new THREE.ShapeGeometry(s, 48), pos = geometry.attributes.position, uv = geometry.attributes.uv
    for (let k = 0; k < pos.count; k++) uv.setXY(k, pos.getX(k) / city.domain.width_m, pos.getY(k) / city.domain.height_m)
    return geometry
  }, [city])
  const texture = useMemo(() => {
    if (!field) return null
    const t = new THREE.DataTexture(textureBytes(field, colour.values, colour.min, colour.max, colour.kind), field.grid.nx, field.grid.ny, THREE.RGBAFormat)
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t
  }, [field, colour])
  useEffect(() => () => surface.dispose(), [surface]); useEffect(() => () => texture?.dispose(), [texture])
  if (!texture) return null
  return <mesh geometry={surface} rotation={[-Math.PI / 2, 0, 0]} position={[0, .045, 0]} renderOrder={1}><meshBasicMaterial map={texture} transparent opacity={1} alphaTest={.01} depthWrite={false} toneMapped={false} /></mesh>
}
const TRAIL = 18
export function MovingWind({ city, field, active, mobile, presentation = 'mars' }: Pick<CitySceneProps, 'city' | 'field' | 'presentation'> & { active: boolean; mobile: boolean }) {
  const { invalidate, gl, setDpr, size } = useThree()
  const flow = useMemo(() => {
    const count = mobile ? 350 : 900, positions = new Float32Array(count * (TRAIL - 1) * 6), alpha = new Float32Array(count * (TRAIL - 1) * 2)
    for (let p = 0; p < count; p++)for (let k = 0; k < TRAIL - 1; k++) { const i = (p * (TRAIL - 1) + k) * 2; alpha[i] = .06 + .68 * (1 - k / (TRAIL - 1)) ** 1.5; alpha[i + 1] = .06 + .68 * (1 - (k + 1) / (TRAIL - 1)) ** 1.5 }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)); geometry.setAttribute('opacity', new THREE.BufferAttribute(alpha, 1))
    const history = new Float32Array(count * TRAIL * 2), age = new Float32Array(count), heads = new Float32Array(count * 3)
    const headGeometry = new THREE.BufferGeometry(); headGeometry.setAttribute('position', new THREE.BufferAttribute(heads, 3).setUsage(THREE.DynamicDrawUsage))
    let seed = 7331
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
    const respawn = (p: number) => {
      let xy: XY = [-1000, -1000]
      if (field) for (let k = 0; k < 70; k++) { const candidate: XY = [field.grid.dx_m + random() * (city.domain.width_m - 2 * field.grid.dx_m), field.grid.dy_m + random() * (city.domain.height_m - 2 * field.grid.dy_m)]; if (sampleVelocity(field, ...candidate) && !segmentHitsObstacle(city.obstacles, candidate, candidate)) { xy = candidate; break } }
      for (let k = 0; k < TRAIL; k++) { history[(p * TRAIL + k) * 2] = xy[0]; history[(p * TRAIL + k) * 2 + 1] = xy[1] }
      age[p] = random() * 8; heads.set([xy[0], .65, -xy[1]], p * 3)
    }
    for (let p = 0; p < count; p++)respawn(p)
    return { count, positions, geometry, headGeometry, history, age, heads, respawn }
  }, [field, city, mobile])
  const perf = useRef({ elapsed: 0, frames: 0, slow: 0, limit: 900, record: 0 })
  const accumulator = useRef(0)
  useEffect(() => { perf.current.limit = flow.count; invalidate(); return () => { flow.geometry.dispose(); flow.headGeometry.dispose() } }, [flow, invalidate])
  useEffect(() => { if (active) invalidate() }, [active, invalidate])
  useFrame((_, delta) => {
    if (!active || !field) return
    const p = perf.current; p.elapsed += delta; p.frames++
    if (p.elapsed > 1) { const fps = p.frames / p.elapsed; gl.domElement.dataset.fps = fps.toFixed(1); gl.domElement.dataset.tracers = String(p.limit); p.slow = fps < 30 ? p.slow + 1 : 0; if (p.slow >= 3) { p.limit = Math.max(mobile ? 180 : 400, Math.floor(p.limit * .75)); setDpr(1); p.slow = 0 } p.elapsed = 0; p.frames = 0 }
    accumulator.current += Math.min(delta, .05)
    if (accumulator.current >= .027) {
      // Display advection runs at 2.5x for legibility. It never advances a physical forecast.
      const dt = Math.min(accumulator.current, .06) * 2.5; accumulator.current = 0
      for (let p = 0; p < flow.count; p++) {
        if (p >= perf.current.limit) { flow.positions.fill(0, p * (TRAIL - 1) * 6, (p + 1) * (TRAIL - 1) * 6); flow.heads.set([0, -1000, 0], p * 3); continue }
        const base = p * TRAIL * 2, start: XY = [flow.history[base], flow.history[base + 1]]
        const next = advanceParticle(field, city.obstacles, start, dt)
        if (next && Math.hypot(next[0] - start[0], next[1] - start[1]) > 1e-8) flow.age[p] += dt
        if (!next || flow.age[p] > 28) { flow.respawn(p) } else {
          for (let k = TRAIL - 1; k > 0; k--) { flow.history[base + k * 2] = flow.history[base + (k - 1) * 2]; flow.history[base + k * 2 + 1] = flow.history[base + (k - 1) * 2 + 1] }
          flow.history[base] = next[0]; flow.history[base + 1] = next[1]
        }
        for (let k = 0; k < TRAIL - 1; k++) {
          const q = (p * (TRAIL - 1) + k) * 6
          flow.positions[q] = flow.history[base + k * 2]; flow.positions[q + 1] = .65; flow.positions[q + 2] = -flow.history[base + k * 2 + 1]
          flow.positions[q + 3] = flow.history[base + (k + 1) * 2]; flow.positions[q + 4] = .65; flow.positions[q + 5] = -flow.history[base + (k + 1) * 2 + 1]
        }
        flow.heads.set([flow.history[base], .65, -flow.history[base + 1]], p * 3)
      }
      flow.geometry.attributes.position.needsUpdate = true; flow.headGeometry.attributes.position.needsUpdate = true
    }
    invalidate()
  })
  const arrows = useMemo(() => {
    const vertices: number[] = []
    if (field) for (let y = 18; y < city.domain.height_m - 10; y += 25)for (let x = 18; x < city.domain.width_m - 10; x += 25) {
      const vel = sampleVelocity(field, x, y); if (!vel) continue
      const speed = Math.hypot(...vel); if (speed < .001) continue
      const ux = vel[0] / speed, uy = vel[1] / speed, end: XY = [x + ux * 7, y + uy * 7]
      const a: XY = [end[0] - ux * 2 - uy * 1.3, end[1] - uy * 2 + ux * 1.3], b: XY = [end[0] - ux * 2 + uy * 1.3, end[1] - uy * 2 - ux * 1.3]
      if ([[x, y], a, b].some(point => segmentHitsObstacle(city.obstacles, point as XY, end))) continue
      for (const [from, to] of [[[x, y], end], [a, end], [b, end]]) vertices.push(from[0], .7, -from[1], to[0], .7, -to[1])
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); return g
  }, [field, city])
  useEffect(() => () => arrows.dispose(), [arrows])
  const tint = useMemo(() => presentation === 'mars' ? new THREE.Vector3(.92, .75, .52) : presentation === 'structure' ? new THREE.Vector3(.63, .66, .66) : new THREE.Vector3(.93, .98, 1), [presentation])
  const lineUniforms = useMemo(() => ({ tint: { value: tint }, strength: { value: presentation === 'mars' ? .25 : presentation === 'structure' ? .65 : 1 } }), [presentation, tint])
  const dotUniforms = useMemo(() => ({ tint: { value: tint }, strength: { value: presentation === 'mars' ? .15 : .7 }, pointSize: { value: presentation === 'mars' ? 5 : 1 }, viewportHeight: { value: size.height } }), [presentation, size.height, tint])
  useEffect(() => { const count = presentation === 'mars' ? Math.min(flow.count, mobile ? 130 : 280) : flow.count; flow.geometry.setDrawRange(0, count * (TRAIL - 1) * 2); flow.headGeometry.setDrawRange(0, count); invalidate() }, [presentation, flow, mobile, invalidate])
  return <group>
    <lineSegments geometry={flow.geometry} frustumCulled={false} visible={active} renderOrder={3}>
      <shaderMaterial uniforms={lineUniforms} transparent depthWrite={false} vertexShader={`attribute float opacity; varying float a; void main(){a=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`uniform vec3 tint; uniform float strength; varying float a; void main(){gl_FragColor=vec4(tint,a*strength);}`} />
    </lineSegments>
    <points geometry={flow.headGeometry} frustumCulled={false} visible={active} renderOrder={4}>
      <shaderMaterial uniforms={dotUniforms} transparent depthWrite={false} vertexShader={`uniform float pointSize; uniform float viewportHeight; void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(pointSize*viewportHeight/max(1.,-p.z),1.,32.);}`} fragmentShader={`uniform vec3 tint; uniform float strength; void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tint,strength*pow(1.-d,1.5));}`} />
    </points>
    <lineSegments geometry={arrows} visible={!active && presentation !== 'mars'} renderOrder={3}><lineBasicMaterial color={presentation==='structure'?'#acb0ae':'#e3f6ef'} transparent opacity={.8} depthWrite={false} toneMapped={false} /></lineSegments>
  </group>
}
