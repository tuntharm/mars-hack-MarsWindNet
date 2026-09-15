import type { ScenarioSpec } from '../contracts/marswindnet.ts'

export const SCENARIOS: ScenarioSpec[] = [
  // Genuine results are imported explicitly; this case never generates a fixture.
  {
    id: 'illustrative-obstacle-flow',
    label: 'Settlement flow · illustrative',
    inlet_u_mps: 8,
    inlet_v_mps: 2,
    fixture: 'obstacle-flow',
  },
  {
    id: 'eastward-inflow',
    fixture: 'uniform',
    label: 'Eastward inflow',
    inlet_u_mps: 8,
    inlet_v_mps: 0,
  },
  {
    id: 'northward-inflow',
    fixture: 'uniform',
    label: 'Northward inflow',
    inlet_u_mps: 0,
    inlet_v_mps: 8,
  },
  {
    id: 'eastward-inflow-fail',
    fixture: 'uniform',
    label: 'Eastward inflow (forced fail)',
    inlet_u_mps: 8,
    inlet_v_mps: 0,
  },
  { id: 'cfd-eastward-8', label: 'CFD eastward 8 m/s · solver data', inlet_u_mps:8, inlet_v_mps:0 },
]

export function scenarioById(id: string): ScenarioSpec {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]!
}

export function savedCsvPath(scenarioId: string): string {
  return `/data/scenarios/${scenarioId}.paired.csv`
}
