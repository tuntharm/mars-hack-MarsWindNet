import { useEffect, useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CitySceneProps, Obstacle, SurfaceOverlayResult } from '../contracts/marswindnet'
import { buildOuterSurface, SURFACE_RADIAL_SEGMENTS } from '../geometry/surfaceMesh'
import { toWorld } from './flowMath'
import { architectureMaterials } from './architectureMaterials'

function outerGeometry(o:Obstacle){
 const data=buildOuterSurface(o),g=new THREE.BufferGeometry(),p=new Float32Array(data.positions_m.length),n=new Float32Array(data.normals.length),uv=new Float32Array(data.positions_m.length/3*2)
 for(let k=0;k<data.positions_m.length;k+=3){
  const x=data.positions_m[k]-o.cx_m,y=data.positions_m[k+1]-o.cy_m,z=data.positions_m[k+2],nx=data.normals[k],ny=data.normals[k+1],nz=data.normals[k+2]
  p.set([x,z,-y],k);n.set([nx,nz,-ny],k)
  if(o.kind==='box'){
   if(Math.abs(nz)>.7)uv.set([x/o.width_m+.5,y/o.depth_m+.5],k/3*2)
   else uv.set([Math.abs(nx)>.7?y/o.depth_m+.5:x/o.width_m+.5,z/(o.height_m??1)],k/3*2)
  }else uv.set([(k/3)%(SURFACE_RADIAL_SEGMENTS+1)/SURFACE_RADIAL_SEGMENTS,z/(o.height_m??1)],k/3*2)
 }
 g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2))
 if(o.kind==='box'){
  const side:number[]=[],roof:number[]=[]
  for(let i=0;i<data.triangles.length;i+=3){const tri=data.triangles.slice(i,i+3);const bucket=tri.every(k=>data.normals[k*3+2]>.7)?roof:side;bucket.push(...tri)}
  g.setIndex([...side,...roof]);g.addGroup(0,side.length,0);g.addGroup(side.length,roof.length,1)
 }else g.setIndex(data.triangles)
 return g
}
function Structure({o,neutral}:{o:Obstacle;neutral:boolean}){
 const geometry=useMemo(()=>outerGeometry(o),[o]),materials=useMemo(()=>architectureMaterials(),[])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 const h=o.height_m??0
 const baseMaterial=neutral?materials.neutral:o.kind==='box'?[materials.facade,materials.roof]:o.kind==='cylinder'?materials.tank:materials.shell
 return <group position={toWorld(o.cx_m,o.cy_m)}>
  <mesh geometry={geometry} material={baseMaterial} castShadow receiveShadow />
  {o.kind!=='box'&&o.kind!=='cylinder'&&<>
   <mesh position={[0,.28,0]}><cylinderGeometry args={[o.radius_m,o.radius_m,.56,64]}/><meshStandardMaterial color={neutral?'#70726e':'#414b46'} metalness={.35} roughness={.75}/></mesh>
   {Array.from({length:12},(_,i)=>{const a=i*Math.PI/6,r=o.radius_m-.72;return <mesh key={i} position={[Math.sin(a)*r,h*.095,Math.cos(a)*r]} rotation={[0,a,0]} castShadow><boxGeometry args={[.5,h*.19,1]}/><meshStandardMaterial color={neutral?'#767972':'#b3b5a4'} metalness={.2} roughness={.6}/></mesh>})}
  </>}
  {o.kind==='cylinder'&&[.2,h*.48,h-.4].map(y=><mesh key={y} position={[0,y,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[o.radius_m-.08,.07,6,64]}/><meshStandardMaterial color="#566558" metalness={.7} roughness={.4}/></mesh>)}
  {o.kind==='cylinder'&&<mesh position={[0,h,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[o.radius_m*.18,o.radius_m*.36,48]}/><meshStandardMaterial color="#526054" metalness={.72} roughness={.36} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1}/></mesh>}
 </group>
}
function SurfaceColours({result}:{result:SurfaceOverlayResult}){
 const surfaces=useMemo(()=>result.surfaces.map(s=>{
  const g=new THREE.BufferGeometry(),p=new Float32Array(s.positions_m.length),colours=new Float32Array(s.positions_m.length),indices:number[]=[]
  const stops=['#244ba5','#1cabc8','#65ccb0','#eddf65','#ed8a31','#c82b24'].map(hex=>new THREE.Color(hex))
  for(let i=0;i<s.positions_m.length;i+=3){p.set([s.positions_m[i],s.positions_m[i+2],-s.positions_m[i+1]],i);const value=s.values[i/3],t=value===null?0:Math.max(0,Math.min(1,(value-result.range[0])/(result.range[1]-result.range[0]||1)));const u=t*(stops.length-1),lo=Math.min(stops.length-2,Math.floor(u));new THREE.Color().copy(stops[lo]).lerp(stops[lo+1],u-lo).toArray(colours,i)}
  for(let i=0;i<s.triangles.length;i+=3)if(s.triangles.slice(i,i+3).every(k=>s.values[k]!==null&&Number.isFinite(s.values[k])))indices.push(...s.triangles.slice(i,i+3))
  g.setAttribute('position',new THREE.BufferAttribute(p,3));g.setAttribute('color',new THREE.BufferAttribute(colours,3));g.setIndex(indices);g.computeVertexNormals()
  return {id:s.object_id,geometry:g,wire:new THREE.WireframeGeometry(g)}
 }),[result])
 useEffect(()=>()=>surfaces.forEach(s=>{s.geometry.dispose();s.wire.dispose()}),[surfaces])
 return <group>{surfaces.map(s=><group key={s.id}>
  <mesh geometry={s.geometry} renderOrder={2}><meshBasicMaterial vertexColors toneMapped={false} polygonOffset polygonOffsetFactor={0} polygonOffsetUnits={-1}/></mesh>
  <lineSegments geometry={s.wire} renderOrder={3}><shaderMaterial transparent depthWrite={false} vertexShader="void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z-=.000015*gl_Position.w;}" fragmentShader="void main(){gl_FragColor=vec4(.10,.16,.21,.24);}"/></lineSegments>
 </group>)}</group>
}

export function Settlement({city,selectedSensorId,onSensorSelect,presentation='mars',surfaceOverlay}:Pick<CitySceneProps,'city'|'selectedSensorId'|'onSensorSelect'|'presentation'|'surfaceOverlay'>){
 const neutral=presentation==='structure'
 return <group>
  {presentation==='cfd'&&<gridHelper args={[400,8,'#d8ad87','#d8ad87']} position={[200,.035,-200]} material-transparent material-opacity={.13}/>}
  {city.pads.map(p=><group key={p.id} position={toWorld(p.cx_m,p.cy_m,.08)} rotation={[-Math.PI/2,0,0]}>
   <mesh receiveShadow><circleGeometry args={[p.radius_m,96]}/><meshStandardMaterial color={neutral?'#706c64':'#665c4e'} roughness={.96}/></mesh>
   {[.77,.94].map(r=><mesh key={r} position={[0,0,.012]}><ringGeometry args={[p.radius_m*r-.22,p.radius_m*r+.22,96]}/><meshBasicMaterial color="#cfb98d" polygonOffset polygonOffsetFactor={-1}/></mesh>)}
   {[0,Math.PI/2].map(a=><mesh key={a} position={[0,0,.016]} rotation={[0,0,a]}><planeGeometry args={[p.radius_m*1.49,.32]}/><meshBasicMaterial color="#b0a17f"/></mesh>)}
   <mesh position={[0,0,.02]}><ringGeometry args={[p.radius_m*.2,p.radius_m*.22,64]}/><meshBasicMaterial color="#d6c59c"/></mesh>
   {Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return <mesh key={i} position={[Math.cos(a)*p.radius_m*.88,Math.sin(a)*p.radius_m*.88,.02]} rotation={[0,0,a]}><planeGeometry args={[p.radius_m*.08,.35]}/><meshBasicMaterial color="#dcc794"/></mesh>})}
  </group>)}
  {city.obstacles.map(o=><Structure key={o.id} o={o} neutral={neutral}/>)}
  {neutral&&surfaceOverlay&&<SurfaceColours result={surfaceOverlay}/>}
  {city.solar_beds.map(o=><group key={o.id} position={toWorld(o.cx_m,o.cy_m,.08)} rotation={[-Math.PI/2,0,0]}>
   <mesh><planeGeometry args={[o.width_m,o.depth_m]}/><meshStandardMaterial color={neutral?'#5d6667':'#172e40'} metalness={.7} roughness={.24}/></mesh>
   {Array.from({length:13},(_,i)=><mesh key={i} position={[(i-6)*o.width_m/13,0,.01]}><planeGeometry args={[.11,o.depth_m]}/><meshBasicMaterial color="#809497"/></mesh>)}
   {Array.from({length:9},(_,i)=><mesh key={i} position={[0,(i-4)*o.depth_m/9,.012]}><planeGeometry args={[o.width_m,.09]}/><meshBasicMaterial color="#4e6e81"/></mesh>)}
  </group>)}
  {city.sensors.map(s=>{const selected=s.id===selectedSensorId,check=s.id==='S3';return <group key={s.id} position={toWorld(s.x_m,s.y_m,.6)}>
   <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[2.9,3.3,32]}/><meshBasicMaterial color={check?'#9addef':'#f2c699'} transparent opacity={.65}/></mesh>
   <Html center position={[0,2,0]} zIndexRange={[30,10]}><button type="button" className={`scene3d-sensor ${check?'checkpoint':''} ${selected?'selected':''}`} data-edge={s.x_m===0?'west':s.x_m===400?'east':undefined} aria-label={`${s.id}: ${s.name}`} aria-pressed={selected} onClick={()=>onSensorSelect(s.id)}><span>{s.id}</span><span className="scene3d-sensor-name">{s.name}</span></button></Html>
  </group>})}
  {presentation!=='mars'&&<><Html center position={[200,.5,-412]} zIndexRange={[4,0]}><span className="scene3d-north">N ↑</span></Html><Html center position={[200,.5,12]} zIndexRange={[4,0]}><span className="scene3d-domain">400 m · EAST →</span></Html></>}
 </group>
}
