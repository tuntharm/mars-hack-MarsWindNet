import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { useMarsWindNet } from './useMarsWindNet'
import type { PredictRequest } from '../contracts/marswindnet'
const city=JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json','utf8'))
const info={status:'ready',model:{id:'TEST-ONLY-field',version:'1'},layout_id:city.layout_id,grid:city.grid,sensor_ids:['S1','S2','S4','S5'],prediction_kind:'steady-field',limits:{speed_min_mps:0,speed_max_mps:20,directions_deg:null}}
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}})
const resultFor=(request:PredictRequest)=>({...request,model:info.model,inference_ms:12,provenance:'TEST ONLY dense transport fixture',u_mps:Array(16384).fill(request.wind.inlet_u_mps),v_mps:Array(16384).fill(request.wind.inlet_v_mps),is_fluid:Array(16384).fill(true)})
let lastRequest:PredictRequest
let inference:(r:PredictRequest)=>Promise<Response>
beforeEach(()=>{
  Object.defineProperty(window,'matchMedia',{configurable:true,value:()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()})})
  inference=async r=>json(resultFor(r))
  vi.stubGlobal('fetch',vi.fn(async (url,options)=>{
    if(String(url).includes('marswindnet-layout-v2.json'))return json(city)
    if(url==='/api/model-info')return json(info)
    if(url==='/api/predict'){lastRequest=JSON.parse(options.body);return inference(lastRequest)}
    return json({error:'missing'},404)
  }))
})
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})

it('starts with no fabricated field, generates both views from four corners, preserves selection',async()=>{
  const {result}=renderHook(()=>useMarsWindNet())
  await waitFor(()=>expect(result.current.canRun).toBe(true))
  expect(result.current.reference).toBeNull();expect(result.current.prediction).toBeNull()
  expect(result.current.canShowReference).toBe(false)
  act(()=>result.current.setSelectedSensorId('S3'))
  await act(()=>result.current.runPrediction())
  expect(lastRequest.sensors.map(s=>s.sensor_id)).toEqual(['S1','S2','S4','S5'])
  expect(lastRequest.request_id).toBeTruthy()
  expect(result.current.presentation).toBe('cfd');expect(result.current.mode).toBe('prediction')
  expect(result.current.field).toBe(result.current.prediction)
  expect(result.current.selectedSensorId).toBe('S3');expect(result.current.canShowError).toBe(false)
  expect(result.current.prediction?.model).toEqual(info.model)
  expect(result.current.field?.is_fluid.some(v=>!v)).toBe(true)
})

it('discards late inference after an input edit and leaves no stale comparison',async()=>{
  let resolve!:(v:Response)=>void
  inference=()=>new Promise(r=>resolve=r)
  const {result}=renderHook(()=>useMarsWindNet())
  await waitFor(()=>expect(result.current.canRun).toBe(true))
  let pending!:Promise<void>
  act(()=>{pending=result.current.runPrediction()})
  act(()=>result.current.editWind('10','270'))
  await act(async()=>{resolve(json(resultFor(lastRequest)));await pending})
  expect(result.current.field).toBeNull();expect(result.current.predicting).toBe(false)
  expect(result.current.observations?.readings[0].u_mps).toBe(-10)
  expect(result.current.regionalObservations?.readings.every(r=>r.u_mps===-10)).toBe(true)
})

it('only accepts the most recent inference request',async()=>{
  const waiting:{r:PredictRequest;resolve:(v:Response)=>void}[]=[]
  inference=r=>new Promise(resolve=>waiting.push({r,resolve}))
  const {result}=renderHook(()=>useMarsWindNet())
  await waitFor(()=>expect(result.current.canRun).toBe(true))
  let first!:Promise<void>,second!:Promise<void>
  act(()=>{first=result.current.runPrediction();second=result.current.runPrediction()})
  await act(async()=>{waiting[1].resolve(json(resultFor(waiting[1].r)));await second})
  await act(async()=>{waiting[0].resolve(json({...resultFor(waiting[0].r),u_mps:Array(16384).fill(99)}));await first})
  expect(result.current.prediction?.u.find(x=>x!==null)).toBe(8)
})

it('rejects unsupported inputs, malformed output and changed model identities',async()=>{
  const {result}=renderHook(()=>useMarsWindNet())
  await waitFor(()=>expect(result.current.canRun).toBe(true))
  act(()=>result.current.editWind('21','90'));expect(result.current.canRun).toBe(false)
  act(()=>result.current.editWind('8','90'))
  await waitFor(()=>expect(result.current.canRun).toBe(true))
  inference=async r=>json({...resultFor(r),u_mps:[8]})
  await act(()=>result.current.runPrediction());expect(result.current.predictError).toMatch(/length/)
  inference=async r=>json({...resultFor(r),model:{id:'other',version:'1'}})
  await act(()=>result.current.runPrediction());expect(result.current.predictError).toMatch(/version changed/)
  expect(result.current.prediction).toBeNull()
})

it('matches references to wind, enables comparison, invalidates it on edit',async()=>{
  const {result}=renderHook(()=>useMarsWindNet())
  await waitFor(()=>expect(result.current.canRun).toBe(true))
  await act(()=>result.current.runPrediction())
  const reference={...resultFor(lastRequest),kind:'cfd-reference'}
  const file=(r:unknown)=>({size:500,text:async()=>JSON.stringify(r)}) as File
  await act(()=>result.current.loadCustomReference(file({...reference,wind:{inlet_u_mps:9,inlet_v_mps:0}})))
  expect(result.current.referenceError).toMatch(/wind/);expect(result.current.canShowError).toBe(false)
  await act(()=>result.current.loadCustomReference(file(reference)))
  expect(result.current.canShowError).toBe(true)
  act(()=>result.current.selectMode('error'));expect(result.current.colour.kind).toBe('vector-error')
  act(()=>result.current.editWind('8','0'));expect(result.current.reference).toBeNull();expect(result.current.prediction).toBeNull()
})

it('does not call inference when model is disconnected',async()=>{
  vi.stubGlobal('fetch',vi.fn(async url=>String(url).includes('marswindnet-layout-v2.json')?json(city):json({status:'not-connected'})))
  const {result}=renderHook(()=>useMarsWindNet())
  await waitFor(()=>expect(result.current.modelStatus.info?.status).toBe('not-connected'))
  expect(result.current.canRun).toBe(false)
  await act(()=>result.current.runPrediction())
  expect(vi.mocked(fetch).mock.calls.some(([u])=>u==='/api/predict')).toBe(false)
})

it('does not let a slow reference import overwrite a newer file',async()=>{
  const {result}=renderHook(()=>useMarsWindNet())
  await waitFor(()=>expect(result.current.canRun).toBe(true))
  await act(()=>result.current.runPrediction())
  let resolve!:(v:string)=>void
  const oldFile={size:50,text:()=>new Promise<string>(r=>resolve=r)} as File
  let pending!:Promise<void>
  act(()=>{pending=result.current.loadCustomReference(oldFile)})
  const reference={...resultFor(lastRequest),kind:'cfd-reference',provenance:'Newer reference'}
  await act(()=>result.current.loadCustomReference({size:50,text:async()=>JSON.stringify(reference)} as File))
  await act(async()=>{resolve(JSON.stringify({...reference,provenance:'Older reference'}));await pending})
  expect(result.current.reference?.provenance).toBe('Newer reference')
})
