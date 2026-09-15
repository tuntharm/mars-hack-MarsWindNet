#!/usr/bin/env node
/** Derive maps, CSVs and explicitly illustrative presets from the canonical runtime city. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateIllustrativeVelocity, makeIllustrativeComparison, makeIllustrativeObstacleField, makeScenarioObservations, makeUniformFixture } from '../src/field/fixtures.ts'
import { SCENARIOS } from '../src/state/scenarios.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const city = JSON.parse(readFileSync(join(root, 'public/data/city/marswindnet-layout-v2.json'), 'utf8'))
const exportDir = join(root, 'public/data/exports')
const portableDir = join(root, 'CFD/geometry')
const scenarioDir = join(root, 'public/data/scenarios')
const D = city.domain.width_m
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const csv = rows => rows.map(row => row.map(value => {
  const text = String(value ?? '')
  return /[,"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}).join(',')).join('\n') + '\n'
const objects = [...city.pads, ...city.solar_beds, ...city.obstacles]
const shape = o => o.kind === 'box'
  ? `<rect data-object-id="${o.id}" class="${o.role === 'cfd' ? 'solid' : 'visual'}" x="${o.cx_m-o.width_m/2}" y="${D-o.cy_m-o.depth_m/2}" width="${o.width_m}" height="${o.depth_m}"/>`
  : `<circle data-object-id="${o.id}" class="${o.role === 'cfd' ? 'solid' : 'visual'}" cx="${o.cx_m}" cy="${D-o.cy_m}" r="${o.radius_m}"/>`
const ticks = Array.from({length:D/50+1}, (_,i) => i*50)
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1190" viewBox="-48 -46 ${D+88} ${D+148}" data-layout-id="${city.layout_id}">
<style>text{font-family:Arial,sans-serif;fill:#e9dccd;font-size:9px}.title{font-size:17px;font-weight:bold}.label{font-size:8px;fill:#201811;paint-order:stroke;stroke:#f5e6d2;stroke-width:1.5px;stroke-linejoin:round}.solid{fill:#eee6d6;stroke:#30241c;stroke-width:1}.visual{fill:#936a49;stroke:#efbb79;stroke-width:1;stroke-dasharray:3 2}.sensor{fill:#ff922f;stroke:#1b242d;stroke-width:1}.checkpoint{fill:#60cbe6}.grid{stroke:#deb78c;stroke-width:.4;opacity:.3}</style>
<rect x="-48" y="-46" width="${D+88}" height="${D+148}" fill="#171a1d"/>
<text class="title" x="0" y="-22">MarsWindNet · ${D} × ${D} m local city</text>
<text x="0" y="-7">${city.layout_id} · authored footprints · north up</text>
<rect width="${D}" height="${D}" fill="#9b4f32"/>
${ticks.map(v=>`<path class="grid" d="M${v} 0V${D} M0 ${v}H${D}"/><text x="${v}" y="${D+18}" text-anchor="middle">${v}</text><text x="-9" y="${D-v+3}" text-anchor="end">${v}</text>`).join('\n')}
${objects.map(shape).join('\n')}
${objects.map(o=>`<text class="label" x="${o.cx_m}" y="${D-o.cy_m+3}" text-anchor="middle">${esc(o.id)}</text>`).join('\n')}
${city.sensors.map(s=>`<circle data-sensor-id="${s.id}" class="sensor ${s.use_for_prediction?'':'checkpoint'}" cx="${s.x_m}" cy="${D-s.y_m}" r="4"/><text x="${s.id==='S3'?s.x_m-8:s.x_m===D?D-8:s.x_m+8}" y="${s.id==='S3'?D-s.y_m+3:s.y_m===D?15:D-s.y_m-9}" text-anchor="${s.id==='S3'||s.x_m===D?'end':'start'}">${s.id} ${esc(s.name)}</text>`).join('\n')}
<text x="${D}" y="${D+34}" text-anchor="end">x east / metres</text><text transform="translate(-34 ${D/2}) rotate(-90)" text-anchor="middle">y north / metres</text>
<path d="M${D-22} 60V28l-5 10m5-10 5 10" fill="none" stroke="#fff"/><text x="${D-22}" y="23" text-anchor="middle">N</text>
<path d="M0 ${D+43}v6h100v-6 M50 ${D+43}v6" fill="none" stroke="#e9dccd"/><text x="0" y="${D+63}">0</text><text x="100" y="${D+63}" text-anchor="end">100 m</text>
<rect class="solid" x="150" y="${D+42}" width="12" height="10"/><text x="168" y="${D+51}">14 CFD obstacles</text><rect class="visual" x="285" y="${D+42}" width="12" height="10"/><text x="303" y="${D+51}">Pads / solar: visual only</text>
<text x="0" y="${D+82}">Orange: four local inputs · Blue S3: independent checkpoint · See regional-map.svg for 24 outer stations.</text>
</svg>\n`

// Map coordinates are kilometres relative to network centre; sensor metadata retains physical metres.
const size = 720, scale = 0.027
const mx = x => size/2+(x-city.regional_network.centre_x_m)*scale
const my = y => size/2-(y-city.regional_network.centre_y_m)*scale
const regionalSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="980" viewBox="0 -45 720 785" data-layout-id="${city.layout_id}">
<style>text{font-family:Arial,sans-serif;fill:#f1e0cc;font-size:12px}.ring{fill:none;stroke:#bc865b;stroke-dasharray:5 4}.station{fill:#ff942f;stroke:#271d17;stroke-width:2}</style>
<rect x="0" y="-45" width="720" height="785" fill="#191b1f"/><text x="30" y="-13" font-size="22">Regional monitoring · ${city.layout_id}</text>
${[-10000,-5000,0,5000,10000].map(v=>`<path d="M${360+v*scale} 60V660 M60 ${360-v*scale}H660" stroke="#353639"/><text x="${360+v*scale}" y="686" text-anchor="middle">${v/1000}</text><text x="47" y="${360-v*scale+4}" text-anchor="end">${v/1000}</text>`).join('\n')}
${city.regional_network.radii_m.map(r=>`<circle class="ring" cx="360" cy="360" r="${r*scale}"/>`).join('\n')}
<rect x="${mx(0)}" y="${my(D)}" width="${D*scale}" height="${D*scale}" fill="#55cbe4"/><text x="360" y="30" text-anchor="middle">500 × 500 m city · 5 local stations</text>
${city.regional_sensors.map(s=>{
 const theta=s.bearing_deg*Math.PI/180, extra=s.radius_m===1000?55:0
 const lx=mx(s.x_m)+extra*Math.sin(theta), ly=my(s.y_m)-extra*Math.cos(theta)
 return `<circle data-sensor-id="${s.id}" data-x-m="${s.x_m}" data-y-m="${s.y_m}" class="station" cx="${mx(s.x_m)}" cy="${my(s.y_m)}" r="5"/>${extra?`<path d="M${mx(s.x_m)} ${my(s.y_m)}L${lx} ${ly}" stroke="#896f59"/>`:''}<text x="${lx+(s.x_m>=250?9:-9)}" y="${ly-9}" text-anchor="${s.x_m>=250?'start':'end'}">${s.id}</text>`
}).join('\n')}
<path d="M675 96V55l-6 12m6-12 6 12" fill="none" stroke="#fff"/><text x="675" y="46" text-anchor="middle">N</text>
<text x="360" y="710" text-anchor="middle">R1: 1 km · R5: 5 km · R10: 10 km · axes relative to city centre (250,250 m)</text><text x="360" y="731" text-anchor="middle">24 virtual regional observations · separate from local CFD / prediction inputs</text>
</svg>\n`
const obstacleHeader = ['id','name','kind','role','cx_m','cy_m','radius_m','width_m','depth_m','height_m']
const obstacleCsv = csv([obstacleHeader,...city.obstacles.map(o=>obstacleHeader.map(k=>o[k]))])
const sensorsCsv = csv([['sensor_id','name','x_m','y_m'],...city.sensors.map(s=>[s.id,s.name,s.x_m,s.y_m])])
const regionalCsv = csv([['sensor_id','name','x_m','y_m','radius_m','bearing_deg','model_role','use_for_prediction'],...city.regional_sensors.map(s=>[s.id,s.name,s.x_m,s.y_m,s.radius_m,s.bearing_deg,s.model_role,s.use_for_prediction])])
const portableObstacles = csv([['object_id','shape','x_m','y_m','radius_m','width_m','depth_m','height_m','x_min_m','x_max_m','y_min_m','y_max_m'],...city.obstacles.map(o=>{
 const hx=o.kind==='box'?o.width_m/2:o.radius_m, hy=o.kind==='box'?o.depth_m/2:o.radius_m
 return [o.id,o.kind==='box'?'rectangle':'circle',o.cx_m,o.cy_m,o.radius_m,o.width_m,o.depth_m,o.height_m,o.cx_m-hx,o.cx_m+hx,o.cy_m-hy,o.cy_m+hy]
})])
for (const directory of [exportDir, scenarioDir]) mkdirSync(directory,{recursive:true})
for (const directory of [exportDir, portableDir]) {
 writeFileSync(join(directory,'sensors.csv'),sensorsCsv)
 writeFileSync(join(directory,'regional-sensors.csv'),regionalCsv)
 writeFileSync(join(directory,'regional-map.svg'),regionalSvg)
}
writeFileSync(join(exportDir,'marswindnet-layout-v2.svg'),svg)
writeFileSync(join(portableDir,'city-map.svg'),svg)
writeFileSync(join(exportDir,'obstacles.csv'),obstacleCsv)
writeFileSync(join(portableDir,'obstacles.csv'),portableObstacles)

for (const scenario of SCENARIOS) {
  // Never generate or overwrite independently provided observations/results.
  if (!scenario.fixture) continue
  writeFileSync(join(scenarioDir, `${scenario.id}.observations.json`), JSON.stringify(makeScenarioObservations(city, scenario), null, 2) + '\n')
  const regionalObservations = {
    layout_id: city.layout_id, scenario_id: scenario.id, scope: 'regional', source: 'analytic-fixture',
    provenance: 'Virtual regional point observations at exact coordinates; analytic demonstration only, not CFD, measured weather or a warning forecast.',
    readings: city.regional_sensors.map(sensor => {
      const wind = scenario.fixture === 'obstacle-flow'
        ? evaluateIllustrativeVelocity(city, sensor.x_m, sensor.y_m, scenario.inlet_u_mps, scenario.inlet_v_mps)
        : { u: scenario.inlet_u_mps, v: scenario.inlet_v_mps }
      return { sensor_id: sensor.id, x_m: sensor.x_m, y_m: sensor.y_m, u_mps: wind.u, v_mps: wind.v }
    }),
  }
  writeFileSync(join(scenarioDir, `${scenario.id}.regional-observations.json`), JSON.stringify(regionalObservations, null, 2) + '\n')
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
