import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { CityScene } from '../components/CityScene'
import type { CityLayout, CitySceneProps } from '../contracts/marswindnet'
vi.mock('./SceneCanvas', () => ({ default: (p: CitySceneProps & { active: boolean; onFailure: () => void }) => <div data-testid="renderer" data-active={String(p.active)} data-surface={p.surfaceOverlay ? 'provided' : 'neutral'}><button onClick={p.onFailure}>Simulate context loss</button></div> }))
const city = JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json', 'utf8')) as CityLayout
let reduce = false, visible: (entries: Array<{ isIntersecting: boolean }>) => void
const props: CitySceneProps = { city, field: { layout_id: city.layout_id, scenario_id: 'test', source: 'fixture', provenance: 'test', grid: { nx: 2, ny: 2, dx_m: 200, dy_m: 200 }, u: [1, 1, 1, 1], v: [0, 0, 0, 0], is_fluid: [true, true, true, true] }, colour: { values: [1, 1, 1, 1], min: 0, max: 1, kind: 'speed' }, selectedSensorId: 'S1', onSensorSelect: vi.fn(), paused: false }
beforeEach(() => {
  reduce = false
  vi.stubGlobal('WebGL2RenderingContext', class { })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as WebGLRenderingContext)
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion') && reduce, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.stubGlobal('IntersectionObserver', class { constructor(callback: typeof visible) { visible = callback } observe() { } disconnect() { } })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('scene accessibility and suspension', () => {
  it('preserves 2D access when WebGL is unavailable', async () => { vi.stubGlobal('WebGL2RenderingContext', undefined); render(<CityScene {...props} />); expect(await screen.findByText('The wind map is still available.')).toBeInTheDocument(); expect(screen.getByRole('link', { name: /Open the 2D/ })).toHaveAttribute('href', '#map') })
  it('replaces a lost context with the same useful fallback', async () => { render(<CityScene {...props} />); fireEvent.click(await screen.findByRole('button', { name: 'Simulate context loss' })); expect(screen.getByText('The wind map is still available.')).toBeInTheDocument() })
  it('suspends when offscreen and honours the parent pause after returning', async () => { const r = render(<CityScene {...props} />); expect(await screen.findByTestId('renderer')).toHaveAttribute('data-active', 'true'); act(() => visible([{ isIntersecting: false }])); expect(screen.getByTestId('renderer')).toHaveAttribute('data-active', 'false'); r.rerender(<CityScene {...props} paused />); act(() => visible([{ isIntersecting: true }])); expect(screen.getByTestId('renderer')).toHaveAttribute('data-active', 'false') })
  it('keeps reduced motion static even when the parent requests animation', async () => { reduce = true; render(<CityScene {...props} presentation="cfd" />); await waitFor(() => expect(screen.getByTestId('renderer')).toHaveAttribute('data-active', 'false')); expect(screen.getByText('Reduced motion · direction arrows')).toBeInTheDocument() })
  it('hides scientific legends in Mars and describes its reduced motion honestly', async () => {
    reduce = true; render(<CityScene {...props} />)
    await screen.findByTestId('renderer')
    expect(screen.queryByText('Wind speed')).not.toBeInTheDocument()
    expect(screen.getByText('Reduced motion · atmosphere paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fit city' })).toBeInTheDocument()
  })
  it('keeps invalid or missing surface results neutral before GPU upload', async () => {
    const surfaceOverlay: NonNullable<CitySceneProps['surfaceOverlay']> = { layout_id: 'wrong-layout', scenario_id: 'test', wind_basis: 'reference', source: 'illustrative', quantity: 'surface index', unit: 'unitless', provenance: 'fixture', range: [0, 1], surfaces: [] }
    const r = render(<CityScene {...props} presentation="structure" surfaceOverlay={surfaceOverlay} />)
    expect(await screen.findByTestId('renderer')).toHaveAttribute('data-surface', 'neutral')
    expect(screen.getByText(/Surface result unavailable/)).toBeInTheDocument()
    expect(screen.getByText(/not stress, displacement or structural analysis/)).toBeInTheDocument()
    r.rerender(<CityScene {...props} presentation="structure" />)
    expect(screen.getByTestId('renderer')).toHaveAttribute('data-surface', 'neutral')
  })
})
