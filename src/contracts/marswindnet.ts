/** Shared MarsWindNet field, city, and CityScene contracts. */

export const LAYOUT_ID = 'marswindnet-500-v3' as const

export const NX = 128
export const NY = 128
export const DOMAIN_M = 500
export const DX_M = DOMAIN_M / NX
export const DY_M = DOMAIN_M / NY
export const FIRST_CENTRE_M = DX_M / 2
export const CELL_COUNT = NX * NY

export const DEFAULT_GRID = {
  nx: NX,
  ny: NY,
  dx_m: DX_M,
  dy_m: DY_M,
} as const

export type LayoutId = typeof LAYOUT_ID

export type GridMeta = {
  nx: number
  ny: number
  dx_m: number
  dy_m: number
}

export type DomainMeta = {
  width_m: number
  height_m: number
  origin: 'SW'
  x: 'east'
  y: 'north'
  z: 'up'
}

export type CircleFootprint = {
  id: string
  name: string
  kind: 'circle' | 'dome' | 'cylinder'
  role: 'cfd' | 'visual'
  cx_m: number
  cy_m: number
  radius_m: number
  height_m?: number | null
}

export type BoxFootprint = {
  id: string
  name: string
  kind: 'box'
  role: 'cfd' | 'visual'
  cx_m: number
  cy_m: number
  width_m: number
  depth_m: number
  height_m?: number | null
}

export type Obstacle = CircleFootprint | BoxFootprint

export type SensorSpec = {
  id: string
  name: string
  x_m: number
  y_m: number
  model_role: 'prediction_input' | 'independent_checkpoint'
  use_for_prediction: boolean
}

export type RegionalSensorSpec = {
  id: string
  name: string
  x_m: number
  y_m: number
  radius_m: number
  bearing_deg: number
  model_role: 'regional_observation'
  use_for_prediction: false
}

export type CityLayout = {
  layout_id: LayoutId | string
  note: string
  domain: DomainMeta
  grid: GridMeta & {
    first_centre_m: [number, number]
    index: string
    i: string
    j: string
  }
  pads: CircleFootprint[]
  obstacles: Obstacle[]
  solar_beds: BoxFootprint[]
  sensors: SensorSpec[]
  regional_sensors: RegionalSensorSpec[]
}

export type FieldSource = 'fixture' | 'saved' | 'live' | 'stub' | 'cfd'

export type VelocityField = {
  layout_id: string
  scenario_id: string
  source: FieldSource
  provenance: string
  grid: GridMeta
  u: Array<number | null>
  v: Array<number | null>
  is_fluid: boolean[]
  model?: { id: string; version: string }
  inference_ms?: number
  wind?: { inlet_u_mps: number; inlet_v_mps: number }
}

export type ColourKind = 'speed' | 'vector-error'

export type PresentationMode = 'mars' | 'cfd' | 'structure'

/** Surface scalars are independent of the wind grid. All mesh positions use ENU metres. */
export type SurfaceOverlayResult = {
  layout_id: string
  scenario_id: string
  wind_basis: 'reference' | 'prediction'
  source: 'illustrative' | 'solver' | 'ml'
  quantity: string
  unit: string
  provenance: string
  range: [number, number]
  surfaces: {
    object_id: string
    positions_m: number[]
    triangles: number[]
    values: (number | null)[]
  }[]
}

export type CitySceneProps = {
  /** Presentation changes materials only; the underlying data selection is separate. */
  presentation?: PresentationMode
  surfaceOverlay?: SurfaceOverlayResult | null
  city: CityLayout
  /** Active velocity field. In error mode this is the prediction velocity. */
  field: VelocityField | null
  colour: {
    values: Array<number | null>
    min: number
    max: number
    kind: ColourKind
  }
  selectedSensorId: string | null
  onSensorSelect: (id: string) => void
  regionalObservations?: ScenarioSensorObservations | null
  paused: boolean
}

export type ViewMode = 'reference' | 'prediction' | 'error'

export type SensorReading = {
  sensor_id: string
  x_m: number
  y_m: number
  u_mps: number
  v_mps: number
}

/** Explicit point observations; absent entries mean missing, never zero. */
export type ScenarioSensorObservations = {
  layout_id: string
  scenario_id: string
  source: 'analytic-fixture' | 'provided' | 'simulated-uniform'
  provenance: string
  readings: SensorReading[]
}

export type PredictRequest = {
  request_id?: string
  layout_id: string
  scenario_id: string
  grid: GridMeta
  wind: { inlet_u_mps: number; inlet_v_mps: number }
  sensors: SensorReading[]
}

export type PredictResponse = {
  request_id?: string
  model?: { id: string; version: string }
  inference_ms?: number
  wind?: { inlet_u_mps: number; inlet_v_mps: number }
  layout_id: string
  scenario_id: string
  grid: GridMeta
  /** Null is allowed only where an explicit is_fluid entry is false. */
  u_mps: Array<number | null>
  v_mps: Array<number | null>
  is_fluid?: boolean[]
  provenance?: string
}

/** Hosted dense-field capability contract. No centre-only models qualify. */
export type ModelInfo = {
  status: 'ready' | 'not-connected'
  message?: string
  model?: { id: string; version: string }
  layout_id?: string
  grid?: GridMeta
  sensor_ids?: string[]
  prediction_kind?: 'steady-field'
  limits?: {
    speed_min_mps: number
    speed_max_mps: number
    /** Null means every direction; otherwise explicit supported towards bearings. */
    directions_deg: number[] | null
  }
}

export type ScenarioSpec = {
  id: string
  label: string
  inlet_u_mps: number
  inlet_v_mps: number
  fixture?: 'uniform' | 'obstacle-flow'
}
