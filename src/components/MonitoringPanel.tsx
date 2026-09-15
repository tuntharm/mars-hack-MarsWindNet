import type { CityLayout, ScenarioSensorObservations, VelocityField, ViewMode } from '../contracts/marswindnet.ts'
import { meanFinite, speedMps, towardsBearingDeg, cardinalFromBearing, vectorErrorMps, vectorErrorValues } from '../field/metrics.ts'
import { sampleVelocityAt } from '../field/sample.ts'
import { SensorList } from './SensorList.tsx'

function formatNum(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(digits)
}

function SpeedGauge({ speed, label = 'Observed wind speed' }: { speed: number | null; label?: string }) {
  // The dial scale is a display range, not a safety threshold.
  const maximum = Math.max(20, speed === null ? 20 : Math.ceil(speed / 10) * 10)
  const amount = speed === null ? 0 : Math.min(1, speed / maximum)
  return (
    <div className="instrument instrument--speed">
      <svg viewBox="0 0 200 132" role="img" aria-label={`${label}: ${formatNum(speed)} m/s`}>
        <path className="instrument__track" d="M 25 103 A 75 75 0 1 1 175 103" pathLength="100" />
        <path className="instrument__value" d="M 25 103 A 75 75 0 1 1 175 103" pathLength="100" strokeDasharray={`${amount * 100} 100`} />
        <text x="25" y="124" className="instrument__tick">0</text>
        <text x="175" y="124" textAnchor="end" className="instrument__tick">{maximum} m/s</text>
        <text x="100" y="84" textAnchor="middle" className="instrument__number">{formatNum(speed)}</text>
        <text x="100" y="105" textAnchor="middle" className="instrument__unit">m/s</text>
      </svg>
      <p>{label}</p>
    </div>
  )
}

function WindCompass({ bearing }: { bearing: number | null }) {
  return (
    <div className="instrument instrument--compass">
      <svg viewBox="0 0 160 132" role="img" aria-label={bearing === null ? 'Wind direction unavailable' : `Flow towards ${bearing.toFixed(0)} degrees ${cardinalFromBearing(bearing)}`}>
        <circle className="compass__ring" cx="80" cy="61" r="43" />
        <path className="compass__axis" d="M 80 25 V 97 M 44 61 H 116" />
        <text x="80" y="12" textAnchor="middle" className="compass__cardinal">N</text>
        <text x="137" y="65" textAnchor="middle" className="compass__cardinal">E</text>
        <text x="80" y="121" textAnchor="middle" className="compass__cardinal">S</text>
        <text x="23" y="65" textAnchor="middle" className="compass__cardinal">W</text>
        {bearing !== null ? <g transform={`rotate(${bearing} 80 61)`}><path className="compass__arrow" d="M 80 28 L 88 63 L 80 57 L 72 63 Z" /><path className="compass__tail" d="M 80 88 L 75 61 L 80 65 L 85 61 Z" /></g> : null}
        <circle cx="80" cy="61" r="3" fill="currentColor" />
      </svg>
      <p>{bearing === null ? 'Direction unavailable' : `Towards ${bearing.toFixed(0).padStart(3, '0')}° · ${cardinalFromBearing(bearing)}`}</p>
    </div>
  )
}

export function MonitoringPanel({
  city, mode, reference, prediction, observations, selectedSensorId, onSensorSelect,
}: {
  city: CityLayout
  mode: ViewMode
  reference: VelocityField | null
  prediction: VelocityField | null
  observations: ScenarioSensorObservations | null
  selectedSensorId: string | null
  onSensorSelect: (id: string) => void
}) {
  const sensor = city.sensors.find((item) => item.id === selectedSensorId) ?? city.sensors[0]
  const observation = observations?.readings.find((reading) => reading.sensor_id === sensor?.id)
  const sample = prediction && sensor ? sampleVelocityAt(prediction, sensor.x_m, sensor.y_m) : null
  const outsideGrid = prediction && sensor ? sensor.x_m < prediction.grid.dx_m / 2 || sensor.y_m < prediction.grid.dy_m / 2 || sensor.x_m > (prediction.grid.nx - .5) * prediction.grid.dx_m || sensor.y_m > (prediction.grid.ny - .5) * prediction.grid.dy_m : false
  const simulated = observations?.source === 'simulated-uniform'
  const customCheckpoint = simulated && sensor?.model_role === 'independent_checkpoint'
  const referenceSample = customCheckpoint && reference && sensor ? sampleVelocityAt(reference,sensor.x_m,sensor.y_m) : null
  const gaugeVector = customCheckpoint ? sample : observation ? {u:observation.u_mps,v:observation.v_mps} : null
  const speed = gaugeVector ? speedMps(gaugeVector.u,gaugeVector.v) : null
  const bearing = gaugeVector && speed !== 0 ? towardsBearingDeg(gaugeVector.u,gaugeVector.v) : null
  const checkpointTruth = customCheckpoint ? referenceSample : observation ? {u:observation.u_mps,v:observation.v_mps} : null
  const checkpointError = checkpointTruth && sample ? vectorErrorMps(checkpointTruth.u,checkpointTruth.v,sample.u,sample.v) : null
  const paired = reference && prediction
    ? vectorErrorValues(reference.u, reference.v, prediction.u, prediction.v).map((value, index) => reference.is_fluid[index] && prediction.is_fluid[index] ? value : null)
    : []
  const meanError = meanFinite(paired)
  const inputCount = city.sensors.filter((item) => item.use_for_prediction).length
  const isCheckpoint = sensor?.model_role === 'independent_checkpoint'

  return (
    <section className="monitor-panel" aria-label="Monitoring">
      <header className="panel-head monitor-head"><div><p className="eyebrow">Sensor network</p><h2>{simulated ? 'Inputs and local estimates' : 'Ground observations'}</h2></div><span className="network-count">{observations?.readings.length ?? 0}/{simulated ? city.sensors.filter(s=>s.use_for_prediction).length : city.sensors.length} {simulated ? 'simulated inputs' : 'readings'}</span></header>
      <div className="selected-station"><div><h3>{sensor ? `${sensor.id} · ${sensor.name}` : 'No station selected'}</h3><p>{isCheckpoint ? 'Independent checkpoint · withheld from prediction inputs' : 'Prediction input · boundary observation'}</p></div><span className={`station-role${isCheckpoint ? ' station-role--checkpoint' : ''}`}>{isCheckpoint ? 'CHECK' : 'INPUT'}</span></div>
      <div className="instruments"><SpeedGauge speed={speed} label={customCheckpoint ? 'Model estimate' : simulated ? 'Simulated input speed' : 'Observed wind speed'} /><WindCompass bearing={bearing} /></div>
      <p className="observation-note">{simulated ? customCheckpoint ? 'Model estimate at S3 · no sensor measurement supplied' : 'Simulated uniform input · not live sensor readings' : observations?.source === 'analytic-fixture' ? 'Illustrative observations · not live sensors' : observations ? 'Provided sensor observations' : 'Sensor observations unavailable'}. {simulated ? 'Assumed inputs and model estimates are shown separately.' : 'Gauges show observations in every map view.'}</p>
      <dl className="metrics">
        {customCheckpoint && <div><dt>CFD reference at S3</dt><dd>{referenceSample ? `${formatNum(Math.hypot(referenceSample.u,referenceSample.v))} m/s` : 'No matching CFD reference'}<small>Sampled reference field · not a sensor reading</small></dd></div>}
        <div><dt>Reconstructed here</dt><dd>{!prediction ? 'Run or load a prediction' : sample ? `${formatNum(Math.hypot(sample.u, sample.v))} m/s` : outsideGrid ? 'Outside reconstruction grid' : 'No valid reconstruction here'}</dd></div>
        <div><dt>{customCheckpoint ? 'Model vs CFD at S3' : isCheckpoint ? 'Checkpoint vector error' : 'Sensor role'}</dt><dd>{isCheckpoint ? checkpointError === null ? 'No paired reading' : `${formatNum(checkpointError)} m/s` : 'Used as a model input'}</dd></div>
        <div><dt>Mean vector error</dt><dd>{meanError === null ? 'No paired field' : `${formatNum(meanError)} m/s`}<small>Paired fluid cells across the domain</small></dd></div>
        <div><dt>Network</dt><dd>{inputCount} inputs · {city.sensors.length - inputCount} checkpoint{city.sensors.length - inputCount === 1 ? '' : 's'}<small>Map: {mode === 'reference' ? 'reference' : mode === 'error' ? 'vector error' : 'prediction'}</small></dd></div>
      </dl>
      <div className="sensor-list-heading"><h3>Stations</h3><span>Select to inspect</span></div>
      <SensorList sensors={city.sensors} selectedSensorId={sensor?.id ?? null} onSensorSelect={onSensorSelect} />
    </section>
  )
}
