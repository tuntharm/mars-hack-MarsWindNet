#!/usr/bin/env node
/**
 * Derive labelled SVG + obstacle/sensor CSVs + an illustrative paired field
 * from public/data/city/marswindnet-layout-v2.json only.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeIllustrativeComparison, makeIllustrativeObstacleField, makeScenarioObservations, makeUniformFixture } from '../src/field/fixtures.ts'
import { SCENARIOS } from '../src/state/scenarios.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cityPath = join(root, 'public/data/city/marswindnet-layout-v2.json')
const exportDir = join(root, 'public/data/exports')
const scenarioDir = join(root, 'public/data/scenarios')

const city = JSON.parse(readFileSync(cityPath, 'utf8'))

function esc(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
}

function svgShape(item, className) {
  if (item.kind === 'box') {
    return `<rect class="${className}" x="${item.cx_m - item.width_m / 2}" y="${400 - item.cy_m - item.depth_m / 2}" width="${item.width_m}" height="${item.depth_m}" />`
  }
  const r = item.radius_m
  return `<circle class="${className}" cx="${item.cx_m}" cy="${400 - item.cy_m}" r="${r}" />`
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-24 -28 448 456" width="900" height="920">
  <style>
    text { font-family: ui-sans-serif, system-ui, sans-serif; fill: #1b120c; }
    .title { font-size: 16px; font-weight: 700; }
    .note { font-size: 9px; fill: #5a4030; }
    .axis { font-size: 9px; }
    .label { font-size: 8px; }
    .pad { fill: #e2c39a; stroke: #8a5a32; stroke-width: 0.8; }
    .solar { fill: #2c4454; stroke: #6ec4b4; stroke-width: 0.6; }
    .cfd { fill: #f4efe4; stroke: #1b2c38; stroke-width: 0.8; }
    .sensor { fill: #ff7a18; stroke: #0d1b2a; stroke-width: 0.8; }
  </style>
  <rect x="0" y="0" width="400" height="400" fill="#c56a38"/>
  ${city.pads.map((pad) => svgShape(pad, 'pad')).join('\n  ')}
  ${city.solar_beds.map((bed) => svgShape(bed, 'solar')).join('\n  ')}
  ${city.obstacles.map((obstacle) => svgShape(obstacle, 'cfd')).join('\n  ')}
  ${city.sensors
    .map(
      (sensor) =>
        `<circle class="sensor" cx="${sensor.x_m}" cy="${400 - sensor.y_m}" r="4"/>` +
        `<text class="label" x="${sensor.x_m === 400 ? 394 : sensor.x_m + 6}" y="${sensor.y_m === 400 ? 14 : 400 - sensor.y_m - 6}" text-anchor="${sensor.x_m === 400 ? 'end' : 'start'}">${esc(sensor.id)} ${esc(sensor.name)}</text>`,
    )
    .join('\n  ')}
  ${city.obstacles
    .map(
      (obstacle) =>
        `<text class="label" x="${obstacle.cx_m}" y="${400 - obstacle.cy_m + 3}" text-anchor="middle">${esc(obstacle.id)}</text>`,
    )
    .join('\n  ')}
  <line x1="0" y1="400" x2="400" y2="400" stroke="#1b120c"/>
  <line x1="0" y1="0" x2="0" y2="400" stroke="#1b120c"/>
  ${[0, 100, 200, 300, 400]
    .map((tick) => `<text class="axis" x="${tick}" y="414" text-anchor="middle">${tick} m E</text>`)
    .join('\n  ')}
  ${[0, 100, 200, 300, 400]
    .map((tick) => `<text class="axis" x="-6" y="${400 - tick + 3}" text-anchor="end">${tick} m N</text>`)
    .join('\n  ')}
  <text class="title" x="0" y="-12">${esc(city.layout_id)} · north up</text>
  <text class="note" x="0" y="436">${esc(city.note)}</text>
</svg>
`

const obstacleHeader = 'id,name,kind,role,cx_m,cy_m,radius_m,width_m,depth_m,height_m'
const obstacleRows = city.obstacles.map((o) =>
  [
    o.id,
    o.name,
    o.kind,
    o.role,
    o.cx_m,
    o.cy_m,
    o.radius_m ?? '',
    o.width_m ?? '',
    o.depth_m ?? '',
    o.height_m ?? '',
  ].join(','),
)
const sensorCsv = ['sensor_id,name,x_m,y_m', ...city.sensors.map((s) => `${s.id},${s.name},${s.x_m},${s.y_m}`)].join('\n')

mkdirSync(exportDir, { recursive: true })
mkdirSync(scenarioDir, { recursive: true })
writeFileSync(join(exportDir, 'marswindnet-layout-v2.svg'), svg)
writeFileSync(join(exportDir, 'obstacles.csv'), [obstacleHeader, ...obstacleRows].join('\n') + '\n')
writeFileSync(join(exportDir, 'sensors.csv'), sensorCsv + '\n')

for (const scenario of SCENARIOS) {
  // Never generate or overwrite independently provided observations/results.
  if (!scenario.fixture) continue
  writeFileSync(join(scenarioDir, `${scenario.id}.observations.json`), JSON.stringify(makeScenarioObservations(city, scenario), null, 2) + '\n')
  if (scenario.id !== 'eastward-inflow' && scenario.fixture !== 'obstacle-flow') continue
  const reference = scenario.fixture === 'obstacle-flow'
    ? makeIllustrativeObstacleField(city, scenario.id, scenario.inlet_u_mps, scenario.inlet_v_mps)
    : makeUniformFixture(city, scenario.id, scenario.inlet_u_mps, scenario.inlet_v_mps)
  const comparison = makeIllustrativeComparison(reference)
  // Preserve legacy zero/missing import examples alongside the varied default.
  if (scenario.id === 'eastward-inflow') {
    comparison.u[0] = null
    comparison.v[0] = null
    comparison.u[1] = 0
    comparison.v[1] = 0
  }
  const paired = ['point_id,x_m,y_m,is_fluid,u_cfd_mps,v_cfd_mps,u_ml_mps,v_ml_mps']
  for (let index = 0; index < reference.u.length; index++) {
    const x = (index % city.grid.nx + 0.5) * city.grid.dx_m
    const y = (Math.floor(index / city.grid.nx) + 0.5) * city.grid.dy_m
    paired.push([index, x, y, Number(reference.is_fluid[index]), reference.u[index] ?? '', reference.v[index] ?? '', comparison.u[index] ?? '', comparison.v[index] ?? ''].join(','))
  }
  writeFileSync(join(scenarioDir, `${scenario.id}.paired.csv`), paired.join('\n') + '\n')
  writeFileSync(join(scenarioDir, `${scenario.id}.metadata.json`), JSON.stringify({
    layout_id: city.layout_id,
    scenario_id: scenario.id,
    grid: reference.grid,
    reference_provenance: reference.provenance,
    comparison_provenance: comparison.provenance,
    model: 'analytic visual fixture; not CFD or trained ML',
    observations_file: `${scenario.id}.observations.json`,
    prediction_input_ids: city.sensors.filter((sensor) => sensor.use_for_prediction).map((sensor) => sensor.id),
    checkpoint_ids: city.sensors.filter((sensor) => !sensor.use_for_prediction).map((sensor) => sensor.id),
  }, null, 2) + '\n')
}
console.log('Wrote canonical SVG/CSVs, exact point observations, and labelled illustrative pairs.')
