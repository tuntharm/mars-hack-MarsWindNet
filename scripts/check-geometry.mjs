import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import assert from 'node:assert/strict'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => JSON.parse(readFileSync(resolve(root,path),'utf8'))
const canonical = read('CFD/geometry/city.json'), city = read('public/data/city/marswindnet-layout-v2.json')
assert.equal(city.layout_id, canonical.layout_id)
assert.equal(city.domain.width_m,canonical.domain.width_m)
assert.equal(city.domain.height_m,canonical.domain.depth_m)
for(const key of ['nx','ny','dx_m','dy_m']) assert.equal(city.grid[key],canonical.display_grid[key])
const objects=[...city.obstacles,...city.pads,...city.solar_beds]
assert.equal(objects.length,canonical.objects.length)
for(const o of canonical.objects){
 const actual=objects.find(v=>v.id===o.object_id)
 assert.ok(actual,`Missing ${o.object_id}`)
 for(const [a,b] of [['cx_m','x_m'],['cy_m','y_m'],['radius_m','radius_m'],['width_m','width_m'],['depth_m','depth_m'],['height_m','height_m']])assert.equal(actual[a]??null,o[b]??null,`${o.object_id} ${a}`)
 assert.equal(actual.role==='cfd',o.cfd_obstacle)
 assert.equal(actual.kind==='box',o.shape==='rectangle')
}
assert.equal(city.sensors.length,canonical.sensors.length)
for(const s of canonical.sensors){const actual=city.sensors.find(v=>v.id===s.sensor_id);assert.ok(actual);for(const key of ['x_m','y_m','model_role','use_for_prediction'])assert.equal(actual[key],s[key])}
console.log(`Geometry agrees: ${canonical.layout_id}, ${objects.length} objects, ${city.sensors.length} sensors.`)
