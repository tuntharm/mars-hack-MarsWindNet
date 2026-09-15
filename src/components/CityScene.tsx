import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CitySceneProps } from '../contracts/marswindnet'
import type { CameraAction } from '../scene3d/SceneCanvas'
import { legendGradient } from '../field/colour'
import { validateSurfaceOverlay } from '../structure/validate'
import '../scene3d/scene.css'
const SceneCanvas = lazy(() => import('../scene3d/SceneCanvas'))
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}
export function CityScene(props: CitySceneProps) {
  const presentation = props.presentation ?? 'mars'
  const surfaceOverlay = useMemo(() => {
    const result = props.surfaceOverlay
    if (!result || !props.field || !['reference', 'prediction'].includes(result.wind_basis)) return null
    return validateSurfaceOverlay(result, props.city, props.field.scenario_id, result.wind_basis) ? null : result
  }, [props.surfaceOverlay, props.city, props.field])
  const container = useRef<HTMLDivElement>(null)
  const [supported, setSupported] = useState<boolean | null>(null), [lost, setLost] = useState(false)
  const [mobile, setMobile] = useState(false), [reduced, setReduced] = useState(false), [visible, setVisible] = useState(true), [hidden, setHidden] = useState(false), [interacting, setInteracting] = useState(false)
  const [cameraAction, setCameraAction] = useState<CameraAction>({ kind: 'reset', serial: 0 })
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Probe WebGL and subscribe to external browser capabilities after mount.
    try { const probe = document.createElement('canvas'); const context = typeof WebGL2RenderingContext !== 'undefined' ? probe.getContext('webgl2') : null; setSupported(Boolean(context)); context?.getExtension('WEBGL_lose_context')?.loseContext() } catch { setSupported(false) }
    const motion = matchMedia('(prefers-reduced-motion: reduce)'), small = matchMedia('(max-width: 700px)')
    const change = () => { setReduced(motion.matches); setMobile(small.matches) }; change(); motion.addEventListener('change', change); small.addEventListener('change', change)
    const visibility = () => setHidden(document.hidden); document.addEventListener('visibilitychange', visibility); visibility()
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(entries => setVisible(entries[0]?.isIntersecting ?? true), { threshold: .03 }) : null
    if (container.current) observer?.observe(container.current)
    return () => { motion.removeEventListener('change', change); small.removeEventListener('change', change); document.removeEventListener('visibilitychange', visibility); observer?.disconnect() }
  }, [])
  const failure = useCallback(() => setLost(true), [])
  const active = !props.paused && !reduced && visible && !hidden && Boolean(props.field)
  const fallback = <div className="scene3d-fallback" role="status"><span className="scene3d-kicker">3D view unavailable</span><h2>The wind map is still available.</h2><p>This browser could not keep a WebGL scene running. Explore the same field and select sensors in the 2D view.</p><a href="#map">Open the 2D wind map ↓</a></div>
  const control = (kind: CameraAction['kind']) => setCameraAction(old => ({ kind, serial: old.serial + 1 }))
  return <div ref={container} className="city-scene scene3d" aria-label="3D city wind visualisation" data-presentation={presentation} data-motion={active ? 'running' : 'paused'} data-colour-kind={props.colour.kind} data-field-source={props.field?.source ?? 'none'}>
    <div className={`scene3d-canvas ${mobile && interacting ? 'is-interacting' : ''}`}>
      {supported && !lost ? <SceneBoundary fallback={fallback}><Suspense fallback={<div className="scene3d-loading">Building the settlement…</div>}><SceneCanvas {...props} presentation={presentation} surfaceOverlay={surfaceOverlay} mobile={mobile} active={active} interacting={interacting} cameraAction={cameraAction} onFailure={failure} /></Suspense></SceneBoundary> : supported === null ? <div className="scene3d-loading">Preparing the city…</div> : fallback}
    </div>
    <div className="scene3d-heading"><span className="scene3d-kicker">AEOLIS / SETTLEMENT 01</span><span className="scene3d-subtitle">2D field displayed in 3D</span></div>
    {supported && !lost && <div className="scene3d-camera" aria-label="Camera controls">
      <button onClick={() => control('reset')} aria-label="Reset camera">Reset</button><button onClick={() => control('fit')} aria-label="Fit city">Fit city</button><button onClick={() => control('top')} aria-label="Top view">Top view</button>
      <button onClick={() => control('in')} aria-label="Zoom in">+</button><button onClick={() => control('out')} aria-label="Zoom out">−</button>
    </div>}
    <div className="scene3d-bottom">
      {presentation === 'mars' && <div className="scene3d-atmosphere"><span>ON THE SURFACE</span><span>Decorative atmosphere · horizontal wind</span></div>}
      {presentation === 'cfd' && <div className="scene3d-legend"><div><span>{props.colour.kind === 'vector-error' ? 'Vector error' : 'Wind speed'}</span><span>m/s</span></div><div className="scene3d-gradient" style={{ background: legendGradient(props.colour.kind) }} /><div><span>{props.colour.min.toFixed(1)}</span><span>{props.colour.max.toFixed(1)}</span></div></div>}
      {presentation === 'structure' && <div className="scene3d-legend scene3d-surface-legend"><div><span>{surfaceOverlay?.source === 'illustrative' || !surfaceOverlay ? 'Illustrative surface contours' : surfaceOverlay.quantity}</span><span>{surfaceOverlay?.unit ?? 'unitless'}</span></div><div className="scene3d-gradient scene3d-surface-gradient" /><div><span>{(surfaceOverlay?.range[0] ?? 0).toFixed(1)}</span><span>{(surfaceOverlay?.range[1] ?? 1).toFixed(1)}</span></div><p>{!surfaceOverlay || surfaceOverlay.source === 'illustrative' ? 'Visual response to wind; not stress, displacement or structural analysis.' : surfaceOverlay.provenance}</p>{!surfaceOverlay && <p>Surface result unavailable. Buildings remain neutral.</p>}</div>}
      <div className="scene3d-hint">{mobile ? <button className="scene3d-touch" aria-pressed={interacting} onClick={() => setInteracting(v => !v)}>{interacting ? 'Done · resume scrolling' : 'Interact with city'}</button> : <span>Drag to orbit · scroll to explore</span>}<span>{reduced ? `Reduced motion · ${presentation === 'mars' ? 'atmosphere paused' : 'direction arrows'}` : active ? 'Animated paths · display time ×2.5' : `Flow paused${presentation === 'mars' ? '' : ' · direction arrows'}`}</span></div>
    </div>
  </div>
}
