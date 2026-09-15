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
import { fitNetworkCamera } from './cameraFit'
import { RegionalNetwork } from './RegionalNetwork'
export type CameraAction = {kind:'reset'|'fit'|'top'|'regional'|'in'|'out';serial:number}
type Props=CitySceneProps & {active:boolean;mobile:boolean;interacting:boolean;cameraAction:CameraAction;onFailure:()=>void;regionalRadius:number;selectedRegionalId:string|null;onRegionalSelect:(id:string)=>void;onCity:()=>void}
function CameraRig({action,enabled,city,radius}:{action:CameraAction;enabled:boolean;city:CityLayout;radius:number}){
 const {camera,size,invalidate}=useThree(),controls=useRef<OrbitControlsImpl>(null)
 const top=useRef(false),lastAction=useRef(-1)
 useEffect(()=>{
  const c=camera as THREE.PerspectiveCamera,orbit=controls.current
  if(!orbit)return
  const changed=lastAction.current!==action.serial;lastAction.current=action.serial
  if(changed&&(action.kind==='in'||action.kind==='out')){
   const offset=c.position.clone().sub(orbit.target).multiplyScalar(action.kind==='in'?.8:1.25)
   offset.clampLength(90,100000);c.position.copy(orbit.target).add(offset);orbit.update();invalidate();return
  }
  if(changed)top.current=action.kind==='top'
  const fit=fitNetworkCamera(city,size.width,size.height,radius,top.current)
  c.position.copy(fit.position);c.near=2;c.far=180000;c.updateProjectionMatrix();orbit.target.copy(fit.target);orbit.update();invalidate()
 },[camera,size.width,size.height,action,city,radius,invalidate])
 return <OrbitControls ref={controls} enabled={enabled} enableZoom={false} enablePan={false} enableDamping={false} minPolarAngle={.001} maxPolarAngle={Math.PI*.48} rotateSpeed={.5} onChange={()=>invalidate()}/>
}
function ContextWatch({onFailure}:{onFailure:()=>void}){
 const {gl}=useThree()
 useEffect(()=>{const canvas=gl.domElement;const lost=(event:Event)=>{event.preventDefault();onFailure()};canvas.addEventListener('webglcontextlost',lost);return()=>canvas.removeEventListener('webglcontextlost',lost)},[gl,onFailure])
 return null
}
export default function SceneCanvas(props:Props){
 const presentation=props.presentation??'mars'
 return <Canvas shadows="percentage" frameloop="demand" dpr={props.mobile?[1,1.4]:[1,1.7]} camera={{position:[80,150,220],fov:40,near:10,far:6000}} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({gl})=>{gl.shadowMap.type=THREE.PCFShadowMap;gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=1;gl.domElement.setAttribute('aria-label','Interactive Martian city and horizontal wind field')}}>
  <ContextWatch onFailure={props.onFailure}/>
  <MarsEnvironment presentation={presentation} mobile={props.mobile} regionalRadius={props.regionalRadius}/>
  <Settlement city={props.city} selectedSensorId={props.selectedSensorId} onSensorSelect={props.onSensorSelect} presentation={presentation} surfaceOverlay={props.surfaceOverlay} regional={props.regionalRadius>0}/>
  {presentation==='cfd'&&<ColourSurface city={props.city} field={props.field} colour={props.colour}/>}
  <MovingWind city={props.city} field={props.field} active={props.active&&props.regionalRadius===0} mobile={props.mobile} presentation={presentation}/>
  {props.regionalRadius>0&&<RegionalNetwork city={props.city} selectedId={props.selectedRegionalId} onSelect={props.onRegionalSelect} onCity={props.onCity} radius={props.regionalRadius}/>}
  <CameraRig radius={props.regionalRadius} city={props.city} action={props.cameraAction} enabled={!props.mobile||props.interacting}/>
 </Canvas>
}
