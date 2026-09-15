import type { FieldSource, PresentationMode, ScenarioSpec, ViewMode } from '../contracts/marswindnet.ts'
import { SourcePill } from './SourcePill.tsx'

export function Controls({
  scenarios,
  scenarioId,
  onScenarioChange,
  mode,
  presentation,
  onModeChange,
  canShowPrediction,
  canShowError,
  predicting,
  predictError,
  savedAvailable,
  canRun,
  predictionDisabledReason,
  onRun,
  onLoadSaved,
  paused,
  onPausedChange,
  source,
  provenance,
  hideScenario = false,
  hideRun = false,
  canShowReference = true,
}: {
  scenarios: ScenarioSpec[]
  scenarioId: string
  onScenarioChange: (id: string) => void
  mode: ViewMode
  presentation: PresentationMode
  onModeChange: (mode: ViewMode) => void
  canShowPrediction: boolean
  canShowError: boolean
  predicting: boolean
  predictError: string | null
  savedAvailable: boolean
  canRun: boolean
  predictionDisabledReason: string | null
  onRun: () => void
  onLoadSaved: () => void
  paused: boolean
  onPausedChange: (paused: boolean) => void
  source: FieldSource | null
  provenance: string | null
  hideScenario?: boolean
  hideRun?: boolean
  canShowReference?: boolean
}) {
  return (
    <section className="controls" aria-label="Scenario and prediction controls">
      <div className="controls__toolbar">
      {!hideScenario && <label className="controls__field">
        <span>Scenario</span>
        <select value={scenarioId} onChange={(event) => onScenarioChange(event.target.value)}>
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </select>
      </label>}

      <fieldset className="controls__modes">
        <legend>Wind field</legend>
        <label className={`${mode === 'reference' ? 'is-active' : ''} ${!canShowReference ? 'is-disabled' : ''}`}>
          <input
            type="radio"
            name="view-mode"
            checked={mode === 'reference'}
            disabled={!canShowReference}
            onChange={() => onModeChange('reference')}
          />
          Reference
        </label>
        <label className={`${!canShowPrediction ? 'is-disabled' : ''} ${mode === 'prediction' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name="view-mode"
            checked={mode === 'prediction'}
            disabled={!canShowPrediction}
            onChange={() => onModeChange('prediction')}
          />
          Prediction
        </label>
        {presentation !== 'structure' ? <label className={`${!canShowError ? 'is-disabled' : ''} ${mode === 'error' ? 'is-active' : ''}`}>
          <input
            type="radio"
            name="view-mode"
            checked={mode === 'error'}
            disabled={!canShowError}
            onChange={() => onModeChange('error')}
          />
          Error
        </label> : null}
      </fieldset>

      <div className="controls__actions">
        <button type="button" className="btn-ghost" onClick={onLoadSaved} disabled={!savedAvailable}>
          {scenarioId === 'illustrative-obstacle-flow' ? 'Load illustrative comparison' : 'Load saved result'}
        </button>
        {!hideRun && <button type="button" className="btn-primary" onClick={onRun} disabled={!canRun || predicting} aria-describedby={predictionDisabledReason ? 'prediction-status' : undefined}>
          <span aria-hidden="true">{predicting ? '◌' : '↗'}</span> {predicting ? 'Predicting…' : 'Run prediction'}
        </button>}
        <label className="pause-toggle">
          <input
            type="checkbox"
            checked={paused}
            onChange={(event) => onPausedChange(event.target.checked)}
          />
          Pause motion
        </label>
      </div>
      </div>
      <div className="controls__foot">
      <SourcePill source={source} provenance={provenance} />
      {!hideRun && <p id="prediction-status" className={`controls__status${predictError ? ' is-error' : ''}`} aria-live="polite">
        {predicting
          ? 'Requesting a new field…'
          : predictError
            ? predictError
            : predictionDisabledReason
              ? predictionDisabledReason
            : savedAvailable
              ? 'Saved comparison available'
              : 'No saved comparison'}
      </p>}
      </div>
    </section>
  )
}
