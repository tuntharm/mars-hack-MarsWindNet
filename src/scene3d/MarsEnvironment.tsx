/* oxlint-disable react/immutability -- Three.js objects are renderer-owned mutable resources. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { PresentationMode } from '../contracts/marswindnet'
import { fbm, noise, terrainElevationAt } from './environmentMath'

const TERRAIN_WIDTH = 3200
const REGOLITH_URL = '/assets/mars/regolith-albedo.png'

function createTerrain(segments: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(TERRAIN_WIDTH, TERRAIN_WIDTH, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const colours = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index) + 200, z = position.getZ(index) - 200
    const elevation = terrainElevationAt(x, z)
    position.setY(index, elevation)
    const variation = fbm(x * .008 + 2.7, z * .008 - 1.3)
    const strata = Math.sin(elevation * .28 + noise(x * .012, z * .012) * 2) * .018
    const brightness = .73 + variation * .23 + strata
    colours.set([brightness, brightness * .97, brightness * .93], index * 3)
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3))
  geometry.computeVertexNormals()
  return geometry
}

function createRegolithDetail(): THREE.DataTexture {
  const size = 256, data = new Uint8Array(size * size * 4)
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    // Periodic noise: this decorative bump texture has no edge discontinuity.
    const a = Math.sin(i / size * Math.PI * 18 + Math.cos(j / size * Math.PI * 14))
    const b = Math.sin(j / size * Math.PI * 32 + Math.cos(i / size * Math.PI * 26))
    const value = Math.round(128 + a * 28 + b * 18)
    const k = (j * size + i) * 4
    data[k] = value; data[k + 1] = value; data[k + 2] = value; data[k + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(TERRAIN_WIDTH / 3.5, TERRAIN_WIDTH / 3.5)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

const SKY_VERTEX = `
varying vec3 worldPosition;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  worldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`
const SKY_FRAGMENT = `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 nadir;
uniform vec3 sunDirection;
varying vec3 worldPosition;
void main() {
  vec3 direction = normalize(worldPosition - cameraPosition);
  float altitude = max(direction.y, 0.0);
  vec3 atmosphere = mix(horizon, zenith, pow(altitude, 0.48));
  atmosphere = mix(atmosphere, nadir, 1.0 - smoothstep(-0.48, -0.03, direction.y));
  float sunGlow = pow(max(dot(direction, sunDirection), 0.0), 9.0);
  atmosphere += vec3(0.09, 0.053, 0.026) * sunGlow;
  gl_FragColor = vec4(atmosphere, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function MarsEnvironment({ presentation, mobile }: { presentation: PresentationMode; mobile: boolean }) {
  const { scene, gl, invalidate, camera } = useThree()
  const sky = useRef<THREE.Mesh>(null)
  const terrain = useMemo(() => createTerrain(mobile ? 128 : 192), [mobile])
  const detail = useMemo(() => createRegolithDetail(), [])
  const [regolith, setRegolith] = useState<THREE.Texture | null>(null)
  const target = useMemo(() => { const value = new THREE.Object3D(); value.position.set(200, 0, -200); return value }, [])
  const realistic = presentation === 'mars'
  const skyUniforms = useMemo(() => ({
    zenith: { value: new THREE.Color(realistic ? '#74392b' : '#353b3e') },
    horizon: { value: new THREE.Color(realistic ? '#d39067' : '#969790') },
    nadir: { value: new THREE.Color(realistic ? '#6d3829' : '#5e625f') },
    sunDirection: { value: new THREE.Vector3(-.77, .35, .53).normalize() },
  }), [realistic])

  useEffect(() => {
    let cancelled = false
    const texture = new THREE.TextureLoader().load(REGOLITH_URL, (loaded) => {
      if (cancelled) { loaded.dispose(); return }
      loaded.colorSpace = THREE.SRGBColorSpace
      // Mirrored wrapping guarantees no exposed hard edge if the generated tile is not pixel-perfect.
      loaded.wrapS = loaded.wrapT = THREE.MirroredRepeatWrapping
      loaded.repeat.set(TERRAIN_WIDTH / 8, TERRAIN_WIDTH / 8)
      loaded.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy())
      loaded.needsUpdate = true
      setRegolith(loaded)
      invalidate()
    }, undefined, () => {
      // The vertex-coloured terrain remains usable if the asset fails to load.
      if (!cancelled) invalidate()
    })
    return () => { cancelled = true; texture.dispose() }
  }, [gl, invalidate])

  useEffect(() => {
    if (!regolith) return
    regolith.anisotropy = Math.min(mobile ? 4 : 8, gl.capabilities.getMaxAnisotropy())
    regolith.needsUpdate = true
    invalidate()
  }, [regolith, mobile, gl, invalidate])

  useEffect(() => {
    const previous = scene.fog
    scene.fog = new THREE.Fog(realistic ? '#ba7956' : '#8b908e', 700, 1750)
    invalidate()
    return () => { scene.fog = previous }
  }, [scene, realistic, invalidate])
  useEffect(() => () => terrain.dispose(), [terrain])
  useEffect(() => () => detail.dispose(), [detail])
  useFrame(() => { sky.current?.position.copy(camera.position) })

  return <group>
    <mesh ref={sky} frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[2400, 32, 20]} />
      <shaderMaterial vertexShader={SKY_VERTEX} fragmentShader={SKY_FRAGMENT} uniforms={skyUniforms} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
    <mesh geometry={terrain} position={[200, 0, -200]} receiveShadow>
      <meshStandardMaterial key={`${presentation}-${regolith ? 'textured' : 'fallback'}`} color={realistic ? regolith ? '#ffffff' : '#a5573c' : '#8d938f'} vertexColors map={realistic ? regolith : null} bumpMap={realistic ? detail : null} bumpScale={.035} roughness={1} metalness={0} />
    </mesh>
    <hemisphereLight args={[realistic ? '#e9cfb3' : '#e0e5e7', realistic ? '#6c3b2a' : '#505757', realistic ? .92 : 1.12]} />
    <primitive object={target} />
    <directionalLight position={[-800, 450, 280]} target={target} intensity={realistic ? 2.65 : 2.05} color={realistic ? '#ffe8ca' : '#edf0ee'} castShadow shadow-mapSize={[mobile ? 1024 : 2048, mobile ? 1024 : 2048]} shadow-camera-left={-360} shadow-camera-right={360} shadow-camera-top={360} shadow-camera-bottom={-360} shadow-camera-near={100} shadow-camera-far={2000} shadow-normalBias={.16} shadow-bias={-.00008} shadow-autoUpdate={false} shadow-needsUpdate={true} />
  </group>
}
