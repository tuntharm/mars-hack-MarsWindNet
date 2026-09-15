import type { useMarsWindNet } from '../state/useMarsWindNet'
import { cardinalFromBearing } from '../field/metrics'

const DIRECTIONS=['N','NE','E','SE','S','SW','W','NW']

export function WindInputPanel({app}:{app:ReturnType<typeof useMarsWindNet>}) {
  const {info,error,checking,retry}=app.modelStatus
  const bearing=Number(app.windBearing)
  const calm=app.wind && Math.hypot(app.wind.inlet_u_mps,app.wind.inlet_v_mps)===0
  const summary=app.wind ? calm ? '0 m/s · calm' : `${app.windSpeed} m/s · ${cardinalFromBearing((bearing+180)%360)} → ${cardinalFromBearing(bearing%360)}` : 'Enter incoming conditions'
  const connected=info?.status==='ready'
  return <section className="wind-input" aria-label="Incoming wind and model connection">
    <div className="wind-input__heading">
      <div><p className="eyebrow">From incoming wind to city field</p><h2>Set incoming wind</h2></div>
      <label className="wind-input__scenario">Scenario<select value={app.scenarioId} onChange={e=>app.setScenarioId(e.target.value)}>{app.scenarios.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
    </div>
    {app.isCustom ? <>
      <div className="wind-input__body">
        <div className="wind-input__parameters">
          <label>Speed <span>m/s</span><input type="number" min="0" step="any" value={app.windSpeed} onChange={e=>app.editWind(e.target.value,app.windBearing)} /></label>
          <label>Flow towards <span>degrees</span><input type="number" min="0" max="360" step="any" value={app.windBearing} onChange={e=>app.editWind(app.windSpeed,e.target.value)} /></label>
          <p className="wind-input__summary">{summary}</p>
        </div>
        <div className="wind-input__compass" role="group" aria-label="Choose flow direction">
          <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="32"/><path className="wind-input__axis" d="M60 29V91M29 60H91"/>{app.wind && !calm && <path className="wind-input__arrow" transform={`rotate(${bearing} 60 60)`} d="M60 35L68 63L60 58L52 63Z"/>}<circle cx="60" cy="60" r="2"/></svg>
          {DIRECTIONS.map((d,i)=><button key={d} style={{left:`${50+43*Math.sin(i*Math.PI/4)}%`,top:`${50-43*Math.cos(i*Math.PI/4)}%`}} className={bearing%360===i*45?'is-active':''} aria-label={`Flow towards ${d}`} aria-pressed={bearing%360===i*45} onClick={()=>app.editWind(app.windSpeed,String(i*45))}>{d}</button>)}
        </div>
        <div className="wind-input__stations"><p className="eyebrow">Four boundary inputs</p><div className="wind-input__readings">{app.city?.sensors.filter(s=>s.use_for_prediction).map(s=><div key={s.id}><strong>{s.id}</strong><span>{s.x_m}, {s.y_m} m</span><span>{app.wind ? `${Number(app.windSpeed).toFixed(1)} m/s`:'—'}</span></div>)}</div><p>Simulated uniform input · same vector at every outer station. S3 is withheld.</p></div>
        <div className="wind-input__generate">
          <span className={`model-status${connected?' is-ready':''}`} role="status">{checking?'Checking model…':error?'Model unavailable':connected?'Model ready':'Model not connected'}</span>
          <p>{connected?`${info.model!.id} · ${info.model!.version}`:error || info?.message || 'Waiting for a compatible full-field model.'}</p>
          <button className="btn-primary" onClick={()=>void app.runPrediction()} disabled={!app.canRun || app.predicting} aria-describedby="custom-wind-status">{app.predicting?'Generating…':'Generate prediction'} <span aria-hidden="true">↗</span></button>
          <button className="wind-input__retry" disabled={checking} onClick={retry}>Refresh connection</button>
        </div>
      </div>
      <div className="wind-input__foot">
        <p id="custom-wind-status" aria-live="polite">{app.predictError || (app.predicting?'Requesting the city wind field…':app.prediction ? `Model ${app.prediction.model?.version} · ${app.prediction.inference_ms?.toFixed(0)} ms inference · ${summary}`: app.predictionDisabledReason || 'Ready to generate the expected field.')}</p>
        <label className="wind-input__upload">Load CFD reference<input type="file" accept=".json,application/json" disabled={!app.wind} onChange={e=>{const file=e.target.files?.[0];if(file)void app.loadCustomReference(file);e.target.value=''}} /></label>
      </div>
      {!app.reference && <p className="wind-input__reference-note">Reference and error comparison become available when you load a numerical CFD field for these conditions.</p>}
    </> : <p className="wind-input__preset-note">Explore this saved scenario, or select Custom wind to send your own incoming conditions to the hosted model.</p>}
  </section>
}
