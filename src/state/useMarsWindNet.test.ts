import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { useMarsWindNet } from './useMarsWindNet.ts'

describe('scenario result ownership', () => {
  let resolveSaved: (response: Response) => void
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }) })
    const city = readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8')
    let savedRequests = 0
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('marswindnet-layout-v2.json')) return Promise.resolve(new Response(city))
      if (url.includes('illustrative-obstacle-flow.paired.csv')) {
        if (++savedRequests > 1) return new Promise<Response>((resolve) => { resolveSaved = resolve })
        return Promise.resolve(new Response('point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps\n0,1.5625,1.5625,1,8,2,7,1'))
      }
      return Promise.resolve(new Response('missing', { status: 404 }))
    }))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('discards a late saved result when the scenario changes', async () => {
    const { result } = renderHook(() => useMarsWindNet())
    await waitFor(() => expect(result.current.savedAvailable).toBe(true))
    let pending: Promise<void>
    act(() => { pending = result.current.loadSaved() })
    act(() => { result.current.setScenarioId('northward-inflow') })
    await waitFor(() => expect(result.current.reference?.scenario_id).toBe('northward-inflow'))
    const csv = 'point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps\n0,1.5625,1.5625,1,8,2,7,1'
    await act(async () => { resolveSaved(new Response(csv)); await pending! })
    expect(result.current.reference?.scenario_id).toBe('northward-inflow')
    expect(result.current.prediction).toBeNull()
    expect(result.current.mode).toBe('reference')
  })

  it('does not advertise an HTML fallback as a saved CSV', async () => {
    const city = readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('.json')
      ? new Response(city)
      : new Response('<!doctype html><html>SPA fallback</html>', { status: 200 })))
    const { result } = renderHook(() => useMarsWindNet())
    await waitFor(() => expect(result.current.reference).not.toBeNull())
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    expect(result.current.savedAvailable).toBe(false)
  })

  it('switches presentations without replacing data or losing the CFD error selection', async () => {
    const { result } = renderHook(() => useMarsWindNet())
    await waitFor(() => expect(result.current.savedAvailable).toBe(true))
    expect(result.current.presentation).toBe('mars')
    let pending: Promise<void>
    act(() => { pending = result.current.loadSaved() })
    const csv = readFileSync('public/data/scenarios/illustrative-obstacle-flow.paired.csv', 'utf8')
    await act(async () => { resolveSaved(new Response(csv)); await pending! })
    const reference = result.current.reference
    const prediction = result.current.prediction
    const requestCount = vi.mocked(fetch).mock.calls.length
    act(() => { result.current.setPresentation('cfd') })
    expect(result.current.mode).toBe('error')
    expect(result.current.displayMode).toBe('error')
    act(() => { result.current.setPresentation('structure') })
    expect(result.current.displayMode).toBe('prediction')
    expect(result.current.mode).toBe('error')
    expect(result.current.field).toBe(prediction)
    expect(result.current.colour.kind).toBe('speed')
    expect(result.current.surfaceOverlay?.wind_basis).toBe('prediction')
    expect(result.current.surfaceOverlay?.unit).toBe('unitless')
    act(() => { result.current.setPresentation('cfd') })
    expect(result.current.displayMode).toBe('error')
    expect(result.current.colour.kind).toBe('vector-error')
    expect(result.current.reference).toBe(reference)
    expect(result.current.prediction).toBe(prediction)
    expect(vi.mocked(fetch).mock.calls.length).toBe(requestCount)
    act(() => { result.current.setPresentation('structure') })
    act(() => { result.current.selectMode('reference') })
    act(() => { result.current.setPresentation('cfd') })
    expect(result.current.mode).toBe('reference')
  })
  it('loads supplied CFD independently of observations and leaves prediction empty', async () => {
    const city = JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8'))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url=String(input)
      if(url.endsWith('marswindnet-layout-v2.json'))return new Response(JSON.stringify(city))
      if(url.endsWith('cfd-eastward-8.reference.json'))return new Response(JSON.stringify({ kind:'cfd-reference', layout_id:city.layout_id, scenario_id:'cfd-eastward-8', grid:city.grid, u_mps:Array(16384).fill(8), v_mps:Array(16384).fill(0), is_fluid:Array(16384).fill(true), provenance:'Test-only transport fixture' }), {headers:{'Content-Type':'application/json'}})
      return new Response('missing',{status:404})
    }))
    const {result}=renderHook(()=>useMarsWindNet())
    await waitFor(()=>expect(result.current.city).not.toBeNull())
    act(()=>result.current.setScenarioId('cfd-eastward-8'))
    await waitFor(()=>expect(result.current.reference?.source).toBe('cfd'))
    expect(result.current.prediction).toBeNull()
    expect(result.current.canRun).toBe(false)
    expect(result.current.referenceError).toBeNull()
  })
  it('keeps missing CFD data empty with a specific import instruction', async () => {
    const {result}=renderHook(()=>useMarsWindNet())
    await waitFor(()=>expect(result.current.city).not.toBeNull())
    act(()=>result.current.setScenarioId('cfd-eastward-8'))
    await waitFor(()=>expect(result.current.referenceError).toMatch(/Import a solver result/))
    expect(result.current.reference).toBeNull()
    expect(result.current.prediction).toBeNull()
  })
})
