import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import App from './App.tsx'
import { MonitoringPanel } from './components/MonitoringPanel.tsx'
import { makeUniformFixture } from './field/fixtures.ts'
import type { CityLayout, CitySceneProps } from './contracts/marswindnet.ts'

// The WebGL renderer is verified in-browser; these tests exercise shared UI/state.
vi.mock('./components/CityScene.tsx', () => ({
  CityScene: ({ city, onSensorSelect }: CitySceneProps) => <div aria-label="3D scene test seam">{city.sensors.map((sensor) => <button key={sensor.id} onClick={() => onSensorSelect(sensor.id)}>{sensor.id} scene marker</button>)}</div>,
}))

const cityJson = readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8')
const pairedCsv = readFileSync('public/data/scenarios/eastward-inflow.paired.csv', 'utf8')

function mockCanvas() {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fillText: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 6 }),
      drawImage: vi.fn(),
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: vi.fn(),
      imageSmoothingEnabled: true,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
    }
    return ctx
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext
}

describe('shell interactions', () => {
  beforeEach(() => {
    mockCanvas()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    })
    class FakeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeObserver)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('marswindnet-layout-v2.json')) {
          return new Response(cityJson, { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        if (url.includes('eastward-inflow.paired.csv')) {
          return new Response(pairedCsv, { status: 200, headers: { 'Content-Type': 'text/csv' } })
        }
        if (url.includes('paired.csv')) {
          return new Response('missing', { status: 404 })
        }
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body ?? '{}')) as { layout_id: string; scenario_id: string; grid: { nx: number; ny: number } }
          if (String(body.scenario_id).endsWith('-fail')) {
            return new Response('forced failure for retry testing', { status: 500 })
          }
          const n = body.grid.nx * body.grid.ny
          return new Response(
            JSON.stringify({
              layout_id: body.layout_id,
              scenario_id: body.scenario_id,
              grid: body.grid,
              u_mps: Array.from({ length: n }, () => 6),
              v_mps: Array.from({ length: n }, () => 1),
              provenance: 'stub-idw — not trained ML',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response('not found', { status: 404 })
      }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('syncs sensor selection into monitoring', async () => {
    render(<App />)
    const habitatButtons = await screen.findAllByRole('button', { name: /S4/ })
    fireEvent.click(habitatButtons[0]!)
    const city = JSON.parse(cityJson) as CityLayout
    expect(screen.getByText(`S4 · ${city.sensors.find((sensor) => sensor.id === 'S4')!.name}`)).toBeInTheDocument()
  })

  it('loads the saved pair as saved, not live, and enables error view', async () => {
    render(<App />)
    fireEvent.change(await screen.findByLabelText('Scenario'), { target: { value: 'eastward-inflow' } })
    const load = await screen.findByRole('button', { name: 'Load saved result' })
    await waitFor(() => expect(load).not.toBeDisabled())
    fireEvent.click(load)
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Error' })).toBeChecked())
    expect(screen.getByText(/SAVED ILLUSTRATIVE PAIR — NOT LIVE INFERENCE/)).toBeInTheDocument()
    expect(screen.queryByText(/^Live$/)).not.toBeInTheDocument()
  })

  it('runs a stub prediction and selects the prediction view', async () => {
    render(<App />)
    const run = await screen.findByRole('button', { name: 'Run prediction' })
    await screen.findByText(/ILLUSTRATIVE FLOW — ANALYTIC FIXTURE, NOT CFD/)
    await waitFor(() => expect(run).not.toBeDisabled())
    fireEvent.click(run)
    await waitFor(() => {
      expect(screen.getByText(/stub-idw — not trained ML/)).toBeInTheDocument()
    }, { timeout: 4000 })
    expect(screen.getByRole('radio', { name: 'Prediction' })).toBeChecked()
  })

  it('keeps the reference after a forced fail and still allows retry', async () => {
    render(<App />)
    const select = await screen.findByLabelText('Scenario')
    fireEvent.change(select, { target: { value: 'eastward-inflow-fail' } })
    await screen.findByText(/DEMO FIXTURE — NOT CFD \/ NOT ML/)
    const run = screen.getByRole('button', { name: 'Run prediction' })
    await waitFor(() => expect(run).not.toBeDisabled())
    fireEvent.click(run)
    await waitFor(() => expect(screen.getByText(/Prediction HTTP 500/)).toBeInTheDocument())
    expect(screen.getByRole('radio', { name: 'Reference' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Prediction' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Run prediction' })).not.toBeDisabled()
  })

  it('shows direct observations and does not clamp a boundary sensor to the reconstructed grid', () => {
    const city = JSON.parse(cityJson) as CityLayout
    city.sensors = [{ ...city.sensors[0]!, id: 'S1', x_m: 0, y_m: 500 }]
    const reference = makeUniformFixture(city, 'eastward-inflow', 8, 0)
    const prediction = makeUniformFixture(city, 'eastward-inflow', 6, 1)
    render(<MonitoringPanel city={city} mode="prediction" reference={reference} prediction={prediction}
      observations={{ layout_id: city.layout_id, scenario_id: 'eastward-inflow', source: 'provided', provenance: 'Test observations', readings: [{ sensor_id: 'S1', x_m: 0, y_m: 500, u_mps: 3, v_mps: 4 }] }}
      selectedSensorId="S1" onSensorSelect={vi.fn()} />)
    expect(screen.getByRole('img', { name: 'Observed wind speed: 5.00 m/s' })).toBeInTheDocument()
    expect(screen.getByText('Outside reconstruction grid')).toBeInTheDocument()
    expect(screen.getByText('Mean vector error').nextElementSibling).toHaveTextContent('2.24 m/s')
  })

  it('opens on Mars and preserves the CFD error choice through Structure', async () => {
    render(<App />)
    expect(await screen.findByRole('tab', { name: 'Mars' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'CFD' }))
    fireEvent.change(screen.getByLabelText('Scenario'), { target: { value: 'eastward-inflow' } })
    const load = screen.getByRole('button', { name: 'Load saved result' })
    await waitFor(() => expect(load).not.toBeDisabled())
    fireEvent.click(load)
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Error' })).toBeChecked())
    fireEvent.click(screen.getByRole('tab', { name: 'Structure' }))
    expect(screen.queryByRole('radio', { name: 'Error' })).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Prediction' })).toBeChecked()
    fireEvent.click(screen.getByRole('tab', { name: 'CFD' }))
    expect(screen.getByRole('radio', { name: 'Error' })).toBeChecked()
  })

  it('moves presentation focus and selection together with arrow and home keys', async () => {
    render(<App />)
    const mars = await screen.findByRole('tab', { name: 'Mars' })
    fireEvent.keyDown(mars, { key: 'ArrowRight' })
    const cfd = screen.getByRole('tab', { name: 'CFD' })
    expect(cfd).toHaveFocus()
    expect(cfd).toHaveAttribute('aria-selected', 'true')
    expect(mars).toHaveAttribute('aria-selected', 'false')
    fireEvent.keyDown(cfd, { key: 'End' })
    const structure = screen.getByRole('tab', { name: 'Structure' })
    expect(structure).toHaveFocus()
    expect(structure).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(structure, { key: 'Home' })
    expect(mars).toHaveFocus()
    expect(mars).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByRole('tab').filter(tab => tab.getAttribute('aria-selected') === 'true')).toHaveLength(1)
  })
})
