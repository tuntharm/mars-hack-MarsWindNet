import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildOuterSurface } from './surfaceMesh'
import type { CityLayout } from '../contracts/marswindnet'
const city=JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json','utf8')) as CityLayout
describe('shared architectural surface geometry',()=>{
 it('keeps every outer shell within the canonical footprint and height',()=>{
  for(const o of city.obstacles){const m=buildOuterSurface(o);expect(m.positions_m.length).toBeGreaterThan(30);expect(m.normals.length).toBe(m.positions_m.length)
   const heights=[]
   for(let k=0;k<m.positions_m.length;k+=3){const x=m.positions_m[k]-o.cx_m,y=m.positions_m[k+1]-o.cy_m,z=m.positions_m[k+2];heights.push(z)
    expect(z).toBeGreaterThanOrEqual(-1e-8);expect(z).toBeLessThanOrEqual((o.height_m??0)+1e-8)
    if(o.kind==='box'){expect(Math.abs(x)).toBeLessThanOrEqual(o.width_m/2+1e-8);expect(Math.abs(y)).toBeLessThanOrEqual(o.depth_m/2+1e-8)}else expect(Math.hypot(x,y)).toBeLessThanOrEqual(o.radius_m+1e-8)
    expect(Math.hypot(...m.normals.slice(k,k+3))).toBeCloseTo(1,6)
   }
   expect(Math.min(...heights)).toBeCloseTo(0);expect(Math.max(...heights)).toBeCloseTo(o.height_m??0)
   expect(m.triangles.length%3).toBe(0);expect(m.triangles.every(i=>Number.isInteger(i)&&i>=0&&i<m.positions_m.length/3)).toBe(true)
  }
 })
 it('is deterministic so renderer and contours share the exact topology',()=>{for(const o of city.obstacles)expect(buildOuterSurface(o)).toEqual(buildOuterSurface(o))})
})
