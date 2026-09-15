import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { CityLayout } from '../contracts/marswindnet'
import { parseRegionalObservations } from './regional'
import { assertCityLayout } from './loadCity'
import { buildPredictRequest } from '../state/buildRequest'
import { makeScenarioObservations } from '../field/fixtures'
const city: CityLayout=JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json','utf8'))
const scenario={id:'eastward-inflow',inlet_u_mps:8,inlet_v_mps:0,fixture:'uniform' as const,label:'Test'}
function observations(){return {scope:'regional',layout_id:city.layout_id,scenario_id:scenario.id,source:'analytic-fixture',provenance:'Test fixture',readings:city.regional_sensors.map(s=>({sensor_id:s.id,x_m:s.x_m,y_m:s.y_m,u_mps:8,v_mps:0}))}}
it('loads five local and 24 radial stations while sending only four local inputs',()=>{
 expect(assertCityLayout(city)).toBe(city)
 const regional=parseRegionalObservations(observations(),city,scenario.id)
 const local=makeScenarioObservations(city,scenario)
 const request=buildPredictRequest(city,scenario,{...local,readings:[...local.readings,...regional.readings]})
 expect(request.sensors.map(s=>s.sensor_id)).toEqual(['S1','S2','S4','S5'])
 expect(request.grid.dx_m).toBe(3.90625)
})
it('rejects stale, clamped, duplicate and nonfinite regional observations',()=>{
 expect(()=>parseRegionalObservations({...observations(),layout_id:'marswindnet-400-v2'},city,scenario.id)).toThrow(/identity/)
 expect(()=>parseRegionalObservations(observations(),city,'other')).toThrow(/identity/)
 for(const change of [{y_m:250},{u_mps:NaN}]){const data=observations();Object.assign(data.readings[0],change);expect(()=>parseRegionalObservations(data,city,scenario.id)).toThrow(/exact station/)}
 const duplicate=observations();duplicate.readings.push(duplicate.readings[0]);expect(()=>parseRegionalObservations(duplicate,city,scenario.id)).toThrow()
})
it('allows missing observations without inventing data and rejects malformed station geometry',()=>{
 expect(parseRegionalObservations({...observations(),readings:[]},city,scenario.id).readings).toEqual([])
 const wrong=structuredClone(city);wrong.regional_sensors[0].x_m=0;expect(()=>assertCityLayout(wrong)).toThrow(/radius/)
})
