import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CityLayout, PresentationMode, ScenarioSensorObservations, VelocityField, ViewMode } from '../contracts/marswindnet.ts'
import { loadCityLayout } from '../data/loadCity.ts'
import { parseCfdReference } from '../data/cfd.ts'
import { parsePairedCsv } from '../field/csv.ts'
import { makeIllustrativeObstacleField, makeScenarioObservations, makeUniformFixture } from '../field/fixtures.ts'
import { buildFluidMask } from '../field/mask.ts'
import { predictUrl, requestPrediction, responseToField } from '../prediction/client.ts'
import { createPredictLifecycle, isAbortError } from '../prediction/lifecycle.ts'
import { buildPredictRequest, parseProvidedObservations } from './buildRequest.ts'
import { activeField, canShowMode, deriveColour, effectiveViewMode } from './deriveView.ts'
import { savedCsvPath, SCENARIOS, scenarioById } from './scenarios.ts'
import { CUSTOM_WIND, parseCustomReference, uniformObservations, uniformWind, windSupportError } from './customWind'
import { useModelInfo } from './useModelInfo'
import { buildIllustrativeSurfaceOverlay } from '../structure/illustrative.ts'

function fixtureForScenario(city: CityLayout, scenarioId: string): VelocityField | null {
  const scenario = scenarioById(scenarioId)
  if (!scenario.fixture) return null
  if (scenario.fixture === 'obstacle-flow') {
    return makeIllustrativeObstacleField(city, scenarioId, scenario.inlet_u_mps, scenario.inlet_v_mps)
  }
  return makeUniformFixture(city, scenarioId, scenario.inlet_u_mps, scenario.inlet_v_mps)
}

export function useMarsWindNet(initialScenarioId = SCENARIOS[0]!.id) {
  const [city, setCity] = useState<CityLayout | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [scenarioId, setScenarioId] = useState(initialScenarioId)
  const [windSpeed, setWindSpeed] = useState('8')
  const [windBearing, setWindBearing] = useState('90')
  const modelStatus = useModelInfo()
  const isCustom = scenarioId === CUSTOM_WIND
  const wind = useMemo(() => {
    try { return windSpeed.trim() && windBearing.trim() ? uniformWind(Number(windSpeed), Number(windBearing)) : null } catch { return null }
  }, [windSpeed, windBearing])
  const [mode, setMode] = useState<ViewMode>('reference')
  const [presentation, setPresentation] = useState<PresentationMode>('mars')
  const [reference, setReference] = useState<VelocityField | null>(null)
  const [prediction, setPrediction] = useState<VelocityField | null>(null)
  const [observations, setObservations] = useState<ScenarioSensorObservations | null>(null)
  const [observationError, setObservationError] = useState<string | null>(null)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>('S1')
  const [paused, setPaused] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [predictError, setPredictError] = useState<string | null>(null)
  const [savedAvailable, setSavedAvailable] = useState(false)
  const lifecycle = useRef(createPredictLifecycle())
  const caseRevision = useRef(0)
  const referenceLoad = useRef(0)
  const clearCase = useCallback(() => {
    caseRevision.current++
    lifecycle.current.abortInFlight()
    setPrediction(null); setReference(null); setPredictError(null); setReferenceError(null); setPredicting(false); setMode('reference')
  }, [])
  const editWind = useCallback((speed: string, bearing: string) => {
    clearCase(); setWindSpeed(speed); setWindBearing(bearing)
  }, [clearCase])
  const chooseScenario = useCallback((id: string) => {
    clearCase(); setScenarioId(id)
  }, [clearCase])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      if (media.matches) setPaused(true)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let cancelled = false
    loadCityLayout()
      .then((loaded) => {
        if (!cancelled) {
          setCity(loaded)
          setLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load city')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const manager = lifecycle.current
    const controller = new AbortController()
    manager.abortInFlight()
    // Replace the externally selected dataset and its I/O lifecycle atomically.
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    setPrediction(null)
    setObservationError(null)
    setReferenceError(null)
    setPredictError(null)
    setPredicting(false)
    setMode('reference')
    setSavedAvailable(false)
    if (!city) {
      setReference(null)
      setObservations(null)
      return
    }
    if (scenarioId === CUSTOM_WIND) {
      setReference(null)
      setObservations(wind ? uniformObservations(city,wind).local : null)
      return () => { controller.abort(); manager.abortInFlight() }
    }
    setReference(fixtureForScenario(city, scenarioId))
    const scenario = scenarioById(scenarioId)
    setObservations(makeScenarioObservations(city, scenario))
    let cancelled = false
    if (!scenario.fixture) {
      fetch(`/data/scenarios/${scenarioId}.reference.json`, { signal: controller.signal })
        .then(async response => {
          if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('CFD reference unavailable. Import a solver result from CFD/results first.')
          return parseCfdReference(await response.json(), city, scenarioId)
        })
        .then(field => { if (!cancelled) setReference(field) })
        .catch((error: unknown) => { if (!cancelled) setReferenceError(error instanceof Error ? error.message : 'CFD reference unavailable.') })
      fetch(`/data/scenarios/${scenarioId}.observations.json`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Point observations unavailable (${response.status}).`)
          return parseProvidedObservations(city, scenario, await response.json())
        })
        .then((provided) => { if (!cancelled) setObservations(provided) })
        .catch((error: unknown) => {
          if (!cancelled) setObservationError(error instanceof Error ? error.message : 'Could not load point observations.')
        })
    }
    fetch(savedCsvPath(scenarioId), { signal: controller.signal })
      .then(async (response) => {
        const header = response.ok ? (await response.text()).trimStart().split(/\r?\n/, 1)[0] : ''
        if (!cancelled) setSavedAvailable(header === 'point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps')
      })
      .catch(() => {
        if (!cancelled) setSavedAvailable(false)
      })
    return () => {
      cancelled = true
      controller.abort()
      manager.abortInFlight()
    }
  }, [city, scenarioId, wind])

  const activeObservations = useMemo(() => isCustom ? city && wind ? uniformObservations(city,wind).local : null : observations,[isCustom,city,wind,observations])

  const requestState = useMemo(() => {
    if (observationError) return { request: null, reason: observationError }
    if (!city || !activeObservations) {
      return { request: null, reason: 'Waiting for scenario observations.' }
    }
    try {
      if (isCustom) {
        if (!wind) return {request:null,reason:'Enter a valid speed and direction.'}
        const reason=windSupportError(modelStatus.info,Number(windSpeed),Number(windBearing))
        if (reason) return {request:null,reason}
      }
      const scenario=isCustom && wind ? {id:CUSTOM_WIND,label:'Custom wind',...wind} : scenarioById(scenarioId)
      return { request: buildPredictRequest(city, scenario, activeObservations), reason: null }
    } catch (error: unknown) {
      return { request: null, reason: error instanceof Error ? error.message : 'Invalid sensor observations.' }
    }
  }, [city, activeObservations, observationError, scenarioId, isCustom, wind, windSpeed, windBearing, modelStatus.info])

  const runPrediction = useCallback(async () => {
    if (!city || !requestState.request) return
    const request = { ...requestState.request, ...(isCustom || predictUrl() === '/api/predict' ? {request_id:crypto.randomUUID()} : {}) }
    const signal = lifecycle.current.start()
    setPredicting(true)
    setPredictError(null)
    try {
      const response = await requestPrediction(request, signal, isCustom ? '/api/predict' : undefined)
      if (signal.aborted) return
      const converted = responseToField(request, response, city)
      if ('error' in converted) {
        setPredictError(converted.error)
        return
      }
      if (isCustom && (response.model?.id !== modelStatus.info?.model?.id || response.model?.version !== modelStatus.info?.model?.version)) {
        setPredictError('Model version changed. Refresh model status and generate again.'); return
      }
      setPrediction(converted.field)
      if (isCustom) setPresentation('cfd')
      setMode('prediction')
    } catch (error: unknown) {
      if (signal.aborted || isAbortError(error)) return
      setPredictError(error instanceof Error ? error.message : 'Prediction failed')
    } finally {
      if (!signal.aborted) setPredicting(false)
    }
  }, [city, requestState, isCustom, modelStatus.info])

  const loadSaved = useCallback(async () => {
    if (!city || !savedAvailable) return
    const signal = lifecycle.current.start()
    setPredicting(false)
    try {
      const response = await fetch(savedCsvPath(scenarioId), { signal })
      if (signal.aborted) return
      if (!response.ok) {
        setPredictError(`Saved result not found (${response.status})`)
        return
      }
      const text = await response.text()
      if (signal.aborted) return
      const paired = parsePairedCsv(text, city.layout_id, scenarioId)
      const geometryMask = buildFluidMask(city)
      for (const field of [paired.reference, paired.prediction]) {
        field.is_fluid = field.is_fluid.map((valid, index) => valid && geometryMask[index])
        field.u = field.u.map((value, index) => field.is_fluid[index] ? value : null)
        field.v = field.v.map((value, index) => field.is_fluid[index] ? value : null)
      }
      setReference(paired.reference)
      setPrediction(paired.prediction)
      setPredictError(null)
      setMode('error')
    } catch (error: unknown) {
      if (signal.aborted || isAbortError(error)) return
      setPredictError(error instanceof Error ? error.message : 'Failed to load saved result')
    }
  }, [city, savedAvailable, scenarioId])

  const loadCustomReference = useCallback(async (file: File) => {
    if (!city || !wind || !isCustom) return
    const revision=caseRevision.current
    const load=++referenceLoad.current
    setReferenceError(null)
    try {
      if (file.size > 4_000_000) throw new Error('Reference JSON must be smaller than 4 MB.')
      const data=JSON.parse(await file.text())
      if (revision !== caseRevision.current || load !== referenceLoad.current) return
      setReference(parseCustomReference(data,city,wind))
    } catch(e) { if(revision===caseRevision.current && load===referenceLoad.current) setReferenceError(e instanceof Error ? e.message : 'Invalid reference JSON.') }
  }, [city,wind,isCustom])

  const regionalObservations=useMemo(()=>city && isCustom && wind ? uniformObservations(city,wind).regional : null,[city,isCustom,wind])

  const selectMode = useCallback(
    (next: ViewMode) => {
      if (presentation === 'structure' && next === 'error') return
      if (!canShowMode(next, reference, prediction)) return
      setMode(next)
    },
    [reference, prediction, presentation],
  )

  const displayMode = effectiveViewMode(presentation, mode)
  const colour = useMemo(
    () => deriveColour(displayMode, reference, prediction),
    [displayMode, reference, prediction],
  )
  const field = useMemo(
    () => activeField(displayMode, reference, prediction),
    [displayMode, reference, prediction],
  )
  const surfaceOverlay = useMemo(
    () => presentation === 'structure' && city
      ? buildIllustrativeSurfaceOverlay(city, field, displayMode === 'reference' ? 'reference' : 'prediction')
      : null,
    [presentation, city, field, displayMode],
  )

  const source = field?.source ?? null
  const provenance = displayMode === 'error' && reference && prediction
    ? `Reference: ${reference.provenance} · Comparison: ${prediction.provenance}`
    : field?.provenance ?? null

  return {
    city,
    loadError,
    referenceError,
    scenarios: SCENARIOS,
    scenarioId,
    setScenarioId: chooseScenario,
    isCustom, windSpeed, windBearing, wind, editWind, modelStatus, regionalObservations, loadCustomReference,
    mode,
    presentation,
    setPresentation,
    displayMode,
    surfaceOverlay,
    selectMode,
    reference,
    prediction,
    observations: activeObservations,
    predictionDisabledReason: requestState.reason,
    canRun: requestState.request !== null,
    field,
    colour,
    selectedSensorId,
    setSelectedSensorId,
    paused,
    setPaused,
    predicting,
    predictError,
    savedAvailable,
    runPrediction,
    loadSaved,
    source,
    provenance,
    canShowReference: reference !== null,
    canShowPrediction: prediction !== null,
    canShowError: reference !== null && prediction !== null,
  }
}
