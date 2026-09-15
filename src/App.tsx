import { useRegionalObservations } from './state/useRegionalObservations'
import { CityScene } from './components/CityScene.tsx'
import { Controls } from './components/Controls.tsx'
import { Map2D } from './components/Map2D.tsx'
import { MonitoringPanel } from './components/MonitoringPanel.tsx'
import { PresentationTabs } from './components/PresentationTabs.tsx'
import { useMarsWindNet } from './state/useMarsWindNet.ts'
import { VideoHero } from './components/VideoHero.tsx'

export default function App() {
  const app = useMarsWindNet()
  const regionalObservations = useRegionalObservations(app.city, app.scenarioId)

  return (
    <>
      <a className="skip-link" href="#map">
        Skip to 2D map
      </a>
      <VideoHero />
    <div className="app" data-presentation={app.presentation}>

      <section className="viewport-one" id="demo" aria-label="Primary visualisation" tabIndex={-1}>
        <header className="masthead">
          <div className="masthead__brand">
            <p className="masthead__name"><span className="brand-mark" aria-hidden="true">M</span> MarsWindNet</p>
            <h2>See the wind. <span>Protect the city.</span></h2>
            <p className="masthead__lede">
              Explore how incoming wind changes around a Martian settlement.
            </p>
          </div>
          <div className="masthead__aside"><span className="eyebrow">Settlement intelligence</span><p>500 × 500 m <span>·</span> 5 local · 24 regional stations</p><a href="#map">Explore the wind map <span aria-hidden="true">↓</span></a></div>
        </header>

        {app.loadError ? <p className="fatal">{app.loadError}</p> : null}
        {app.referenceError ? <p role="status" className="loading">{app.referenceError}</p> : null}

        {app.city ? (
          <>
            <PresentationTabs value={app.presentation} onChange={app.setPresentation} />
            <div id="settlement-presentation" role="tabpanel" aria-labelledby={`presentation-${app.presentation}`}>
            <CityScene
              regionalObservations={regionalObservations}
              city={app.city}
              field={app.field}
              colour={app.colour}
              selectedSensorId={app.selectedSensorId}
              onSensorSelect={app.setSelectedSensorId}
              paused={app.paused}
              presentation={app.presentation}
              surfaceOverlay={app.surfaceOverlay}
            />
            </div>
            <Controls
              scenarios={app.scenarios}
              scenarioId={app.scenarioId}
              onScenarioChange={app.setScenarioId}
              mode={app.displayMode}
              presentation={app.presentation}
              onModeChange={app.selectMode}
              canShowPrediction={app.canShowPrediction}
              canShowError={app.canShowError}
              predicting={app.predicting}
              predictError={app.predictError}
              savedAvailable={app.savedAvailable}
              canRun={app.canRun}
              predictionDisabledReason={app.predictionDisabledReason}
              onRun={() => void app.runPrediction()}
              onLoadSaved={() => void app.loadSaved()}
              paused={app.paused}
              onPausedChange={app.setPaused}
              source={app.source}
              provenance={app.provenance}
            />
          </>
        ) : (
          <p className="loading">Loading city layout…</p>
        )}
      </section>

      {app.city ? (
        <section className="detail-section" id="map" aria-label="Wind field and observations">
          <div className="detail-heading"><div><p className="eyebrow">A closer look</p><h2>Every measurement matters.</h2></div><p>Explore the field. Select a station to inspect its observation.</p></div>
          <div className="detail">
          <Map2D
            city={app.city}
            field={app.field}
            colour={app.colour}
            selectedSensorId={app.selectedSensorId}
            onSensorSelect={app.setSelectedSensorId}
          />
          <MonitoringPanel
            city={app.city}
            mode={app.displayMode}
            reference={app.reference}
            prediction={app.prediction}
            observations={app.observations}
            selectedSensorId={app.selectedSensorId}
            onSensorSelect={app.setSelectedSensorId}
          />
          </div>
        </section>
      ) : null}
      <footer className="page-footer"><span>MarsWindNet</span><p>Prototype settlement · Planar wind field · Research demonstration</p></footer>
    </div>
    </>
  )
}
