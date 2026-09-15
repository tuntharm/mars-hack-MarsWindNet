import { useEffect, useState } from 'react'
import type { CityLayout, ScenarioSensorObservations } from '../contracts/marswindnet'
import { parseRegionalObservations } from '../data/regional'

export function useRegionalObservations(city: CityLayout | null, scenarioId: string) {
  const [result, setResult] = useState<ScenarioSensorObservations | null>(null)
  useEffect(() => {
    if (!city) return
    const controller = new AbortController()
    fetch(`/data/scenarios/${scenarioId}.regional-observations.json`, {signal: controller.signal})
      .then(response => { if (!response.ok || !response.headers.get('content-type')?.includes('json')) throw new Error('No regional observations supplied'); return response.json() })
      .then(value => { const observations = parseRegionalObservations(value, city, scenarioId); if (!controller.signal.aborted) setResult(observations) })
      .catch(() => { if (!controller.signal.aborted) setResult(null) })
    return () => controller.abort()
  }, [city, scenarioId])
  // Identity gating prevents a stale station value flashing during a scenario change.
  return result?.layout_id === city?.layout_id && result?.scenario_id === scenarioId ? result : null
}
