import { afterEach, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import type { CityLayout } from '../contracts/marswindnet'
import { useRegionalObservations } from './useRegionalObservations'
const city: CityLayout=JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json','utf8'))
const source=JSON.parse(readFileSync('public/data/scenarios/eastward-inflow.regional-observations.json','utf8'))
const response=(data:unknown)=>new Response(JSON.stringify(data),{headers:{'content-type':'application/json'}})
afterEach(()=>vi.unstubAllGlobals())
it('discards a regional response arriving after the scenario changes',async()=>{
 let resolveOld!:(value:Response)=>void
 vi.stubGlobal('fetch',vi.fn((url:string)=>url.includes('eastward')?new Promise<Response>(r=>{resolveOld=r}):Promise.resolve(response({...source,scenario_id:'northward-inflow',readings:source.readings.map((r:object)=>({...r,u_mps:0,v_mps:8}))}))))
 const {result,rerender}=renderHook(({id})=>useRegionalObservations(city,id),{initialProps:{id:'eastward-inflow'}})
 rerender({id:'northward-inflow'})
 await waitFor(()=>expect(result.current?.scenario_id).toBe('northward-inflow'))
 await act(async()=>{resolveOld(response(source));await Promise.resolve()})
 expect(result.current?.scenario_id).toBe('northward-inflow')
 expect(result.current?.readings[0].u_mps).toBe(0)
})
it('makes readings unavailable immediately after changing to an absent solver dataset',async()=>{
 vi.stubGlobal('fetch',vi.fn((url:string)=>Promise.resolve(url.includes('eastward')?response(source):new Response('<html>SPA fallback</html>',{headers:{'content-type':'text/html'}}))))
 const {result,rerender}=renderHook(({id})=>useRegionalObservations(city,id),{initialProps:{id:'eastward-inflow'}})
 await waitFor(()=>expect(result.current?.readings).toHaveLength(24))
 rerender({id:'solver-data'})
 expect(result.current).toBeNull()
 await act(async()=>{await Promise.resolve()})
 expect(result.current).toBeNull()
})
