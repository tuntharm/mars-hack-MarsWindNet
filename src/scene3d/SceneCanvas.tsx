/* oxlint-disable react/immutability -- R3F owns mutable Three.js camera and renderer objects. */
import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import type { CitySceneProps, CityLayout } from '../contracts/marswindnet'
import { Settlement } from './Settlement'
import { ColourSurface, MovingWind } from './WindField'
import { MarsEnvironment } from './MarsEnvironment'
export type CameraAction = {kind:'reset'|'fit'|'top'|'in'|'out';serial:number}
type Props=CitySceneProps & {active:boolean;mobile:boolean;interacting:boolean;cameraAction:CameraAction;onFailure:()=>void}
function CameraRig({action,enabled,city}:{action:CameraAction;enabled:boolean;city:CityLayout}){
 const {camera,size,invalidate}=useThree(),controls=useRef<OrbitControlsImpl>(null)
 const view=useRef<'hero'|'fit'|'top'>('hero'),lastAction=useRef(-1)
 useEffect(()=>{
  const c=camera as THREE.PerspectiveCamera,orbit=controls.current
  if(!orbit)return
  const changed=lastAction.current!==action.serial;lastAction.current=action.serial
  if(changed&&(action.kind==='in'||action.kind==='out')){
   const offset=c.position.clone().sub(orbit.target).multiplyScalar(action.kind==='in'?.8:1.25)
   offset.clampLength(90,4500);c.position.copy(orbit.target).add(offset);orbit.update();invalidate();return
  }
  if(changed)view.current=action.kind==='top'?'top':action.kind==='fit'?'fit':'hero'
  const hero=view.current==='hero',top=view.current==='top'
  let xmin=0,xmax=400,ymin=0,ymax=400
  if(hero){
   xmin=Infinity;xmax=-Infinity;ymin=Infinity;ymax=-Infinity
   for(const o of [...city.obstacles,...city.pads,...city.solar_beds]){const rx=o.kind==='box'?o.width_m/2:o.radius_m,ry=o.kind==='box'?o.depth_m/2:o.radius_m;xmin=Math.min(xmin,o.cx_m-rx);xmax=Math.max(xmax,o.cx_m+rx);ymin=Math.min(ymin,o.cy_m-ry);ymax=Math.max(ymax,o.cy_m+ry)}
  }
  const target=new THREE.Vector3((xmin+xmax)/2,hero?8:10,-(ymin+ymax)/2)
  const portrait=size.width/size.height<.8
  const direction=new THREE.Vector3(...(top?[0,1,.001]:hero?portrait?[-.95,1.1,.38]:[-.3,.34,1]:[.42,.85,1]) as [number,number,number]).normalize()
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right)
  const tv=Math.tan(THREE.MathUtils.degToRad(c.fov/2)),th=tv*size.width/size.height
  let distance=hero?270:0
  for(const x of [xmin,xmax])for(const y of [0,30])for(const z of [-ymax,-ymin]){
   const p=new THREE.Vector3(x,y,z).sub(target),depth=p.dot(direction),margin=hero?1.12:1.25
   distance=Math.max(distance,Math.abs(p.dot(right))*margin/th+depth,Math.abs(p.dot(up))*margin/tv+depth)
  }
  c.position.copy(target).addScaledVector(direction,distance);c.near=10;c.far=6000;c.updateProjectionMatrix();orbit.target.copy(target);orbit.update();invalidate()
 },[camera,size.width,size.height,action,city,invalidate])
 return <OrbitControls ref={controls} enabled={enabled} enableZoom={false} enablePan={false} enableDamping={false} minPolarAngle={.001} maxPolarAngle={Math.PI*.48} rotateSpeed={.5} onChange={()=>invalidate()}/>
}
function ContextWatch({onFailure}:{onFailure:()=>void}){
 const {gl}=useThree()
 useEffect(()=>{const canvas=gl.domElement;const lost=(event:Event)=>{event.preventDefault();onFailure()};canvas.addEventListener('webglcontextlost',lost);return()=>canvas.removeEventListener('webglcontextlost',lost)},[gl,onFailure])
 return null
}
export default function SceneCanvas(props:Props){
 const presentation=props.presentation??'mars'
 return <Canvas shadows frameloop="demand" dpr={props.mobile?[1,1.4]:[1,1.7]} camera={{position:[80,150,220],fov:40,near:10,far:6000}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.shadowMap.type=THREE.PCFShadowMap;gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1;gl.domElement.setAttribute('aria-label','Interactive Martian city and horizontal wind field')}}>
  <ContextWatch onFailure={props.onFailure}/>
  <MarsEnvironment presentation={presentation} mobile={props.mobile}/>
  <Settlement city={props.city} selectedSensorId={props.selectedSensorId} onSensorSelect={props.onSensorSelect} presentation={presentation} surfaceOverlay={props.surfaceOverlay}/>
  {presentation==='cfd'&&<ColourSurface city={props.city} field={props.field} colour={props.colour}/>}
  <MovingWind city={props.city} field={props.field} active={props.active} mobile={props.mobile} presentation={presentation}/>
  <CameraRig city={props.city} action={props.cameraAction} enabled={!props.mobile||props.interacting}/>
 </Canvas>
}
