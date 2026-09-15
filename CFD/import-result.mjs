#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { assertCityLayout } from '../src/data/loadCity.ts'
import { parseCfdReference } from '../src/data/cfd.ts'
import { parseProvidedObservations } from '../src/state/buildRequest.ts'
import { SCENARIOS } from '../src/state/scenarios.ts'

export function importResult(root, resultPath, observationsPath) {
  if (!resultPath) throw new Error('Usage: npm run cfd:import -- CFD/results/result.json [CFD/results/observations.json]')
  const data = JSON.parse(readFileSync(resolve(resultPath), 'utf8'))
  const city = assertCityLayout(JSON.parse(readFileSync(resolve(root, 'public/data/city/marswindnet-layout-v2.json'), 'utf8')))
  const scenario = SCENARIOS.find(s => s.id === data.scenario_id && !s.fixture)
  if (!scenario) throw new Error('Register a non-fixture scenario in src/state/scenarios.ts first. Ready case: cfd-eastward-8.')
  const field = parseCfdReference(data, city, scenario.id)
  const observations = observationsPath ? parseProvidedObservations(city, scenario, JSON.parse(readFileSync(resolve(observationsPath), 'utf8'))) : null
  // Validate every supplied file before writing anything. No fabricated observations or ML pair.
  const destination = resolve(root, 'public/data/scenarios', `${scenario.id}.reference.json`)
  writeFileSync(destination, JSON.stringify({ kind:'cfd-reference', layout_id:field.layout_id, scenario_id:field.scenario_id, grid:field.grid, provenance:field.provenance, u_mps:field.u, v_mps:field.v, is_fluid:field.is_fluid })+'\n')
  if (observations) writeFileSync(resolve(root, 'public/data/scenarios', `${scenario.id}.observations.json`), JSON.stringify(observations,null,2)+'\n')
  return { destination, observationsImported:Boolean(observations) }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
    const imported = importResult(root, ...process.argv.slice(2))
    console.log(`Imported 16384 samples into ${imported.destination}. Reload the app and select the matching CFD scenario.`)
    console.log(imported.observationsImported ? 'Exact point observations imported. S3 remains withheld.' : 'No observations imported. Prediction needs separately supplied corner readings; an existing observations file is retained.')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
