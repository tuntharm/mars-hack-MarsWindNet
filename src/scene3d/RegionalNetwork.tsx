import { useMemo, useEffect } from 'react'
import { extend } from '@react-three/fiber'
import type { ThreeElement } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { CityLayout } from '../contracts/marswindnet'
import { terrainElevationAt } from './environmentMath'

extend({ ThreeLine: THREE.Line })
declare module '@react-three/fiber' { interface ThreeElements { threeLine: ThreeElement<typeof THREE.Line> } }

const RING_COLOURS: Record<number, string> = {1000:'#9ce5e5',5000:'#f4cc83',10000:'#ff9773'}
export function RegionalNetwork({city,radius,selectedId,onSelect,onCity}:{city:CityLayout;radius:number;selectedId:string|null;onSelect:(id:string)=>void;onCity:()=>void}){
 const cx=city.domain.width_m/2,cy=city.domain.height_m/2
 const rings=useMemo(()=>[1000,5000,10000].filter(r=>r<=radius).map(r=>{
  const points=[]
  for(let i=0;i<=256;i++){const a=i/256*Math.PI*2,x=cx+r*Math.sin(a),y=cy+r*Math.cos(a);points.push(x,terrainElevationAt(x,-y)+12,-y)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3))
  return {radius:r,geometry}
 }),[cx,cy,radius])
 useEffect(()=>()=>rings.forEach(r=>r.geometry.dispose()),[rings])
 return <group>
  {rings.map(r=><group key={r.radius}>
   <threeLine geometry={r.geometry}><lineBasicMaterial color={RING_COLOURS[r.radius]} transparent opacity={.7} depthTest={false} toneMapped={false}/></threeLine>
  </group>)}
  {city.regional_sensors.filter(s=>s.radius_m<=radius).map(s=><Html key={s.id} center position={[s.x_m,terrainElevationAt(s.x_m,-s.y_m)+15,-s.y_m]} zIndexRange={[30,10]}>
   <button className={`regional-station ${selectedId===s.id?'selected':''} ${s.radius_m===radius?'outer':''}`} style={{borderColor:RING_COLOURS[s.radius_m]}} aria-label={`${s.id}: ${s.name}`} aria-pressed={selectedId===s.id} onClick={()=>onSelect(s.id)}><span className="regional-station-dot" style={{background:RING_COLOURS[s.radius_m]}}/><span className="regional-station-label">{s.id}</span></button>
  </Html>)}
  <Html center position={[cx,60,-cy]} zIndexRange={[31,10]}><button className="regional-city-pin" onClick={onCity} aria-label="Return to 500 metre city">CITY <span>500 m</span></button></Html>
 </group>
}
