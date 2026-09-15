import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'
import assert from 'node:assert/strict'
import { evaluateIllustrativeVelocity, makeScenarioObservations } from '../src/field/fixtures.ts'
import { SCENARIOS } from '../src/state/scenarios.ts'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const text = path => readFileSync(resolve(root,path),'utf8')
const read = path => JSON.parse(text(path))
const canonical = read('CFD/geometry/city.json'), city = read('public/data/city/marswindnet-layout-v2.json')
assert.equal(city.layout_id, 'marswindnet-500-v3')
assert.equal(city.layout_id, canonical.layout_id)
assert.equal(city.domain.width_m,canonical.domain.width_m)
assert.equal(city.domain.height_m,canonical.domain.depth_m)
assert.equal(city.domain.width_m,500)
for(const key of ['nx','ny','dx_m','dy_m']) assert.equal(city.grid[key],canonical.display_grid[key])
assert.equal(city.grid.nx*city.grid.dx_m,500)
assert.equal(city.grid.ny*city.grid.dy_m,500)
assert.equal(canonical.display_grid.x_first_m,city.grid.dx_m/2)
assert.equal(canonical.display_grid.x_last_m,500-city.grid.dx_m/2)
assert.deepEqual(city.grid.first_centre_m,[1.953125,1.953125])
const objects=[...city.obstacles,...city.pads,...city.solar_beds]
assert.equal(objects.length,20)
assert.equal(city.obstacles.length,14)
assert.equal(objects.length,canonical.objects.length)
const bounds=o=>[o.x_m-(o.radius_m??o.width_m/2),o.x_m+(o.radius_m??o.width_m/2),o.y_m-(o.radius_m??o.depth_m/2),o.y_m+(o.radius_m??o.depth_m/2)]
for(const o of canonical.objects){
 const actual=objects.find(v=>v.id===o.object_id)
 assert.ok(actual,`Missing ${o.object_id}`)
 for(const [a,b] of [['cx_m','x_m'],['cy_m','y_m'],['radius_m','radius_m'],['width_m','width_m'],['depth_m','depth_m'],['height_m','height_m']])assert.equal(actual[a]??null,o[b]??null,`${o.object_id} ${a}`)
 assert.equal(actual.role==='cfd',o.cfd_obstacle)
 assert.equal(actual.kind==='box',o.shape==='rectangle')
 const [xmin,xmax,ymin,ymax]=bounds(o)
 assert.ok(xmin>=0&&xmax<=500&&ymin>=0&&ymax<=500,`${o.object_id} outside city`)
}
const solid=canonical.objects.filter(o=>o.cfd_obstacle)
const contains=(o,x,y)=>o.shape==='circle'?Math.hypot(x-o.x_m,y-o.y_m)<=o.radius_m:Math.abs(x-o.x_m)<=o.width_m/2&&Math.abs(y-o.y_m)<=o.depth_m/2
function overlap(a,b){
 if(a.shape==='circle'&&b.shape==='circle')return Math.hypot(a.x_m-b.x_m,a.y_m-b.y_m)<=a.radius_m+b.radius_m
 if(a.shape==='rectangle'&&b.shape==='rectangle')return Math.abs(a.x_m-b.x_m)<=(a.width_m+b.width_m)/2&&Math.abs(a.y_m-b.y_m)<=(a.depth_m+b.depth_m)/2
 const circle=a.shape==='circle'?a:b,rect=a.shape==='rectangle'?a:b
 return Math.hypot(Math.max(0,Math.abs(circle.x_m-rect.x_m)-rect.width_m/2),Math.max(0,Math.abs(circle.y_m-rect.y_m)-rect.depth_m/2))<=circle.radius_m
}
for(let i=0;i<solid.length;i++)for(let j=i+1;j<solid.length;j++)assert.ok(!overlap(solid[i],solid[j]),`Obstacle overlap ${solid[i].object_id}/${solid[j].object_id}`)
assert.equal(city.sensors.length,5)
assert.equal(city.sensors.length,canonical.sensors.length)
for(const s of canonical.sensors){
 const actual=city.sensors.find(v=>v.id===s.sensor_id);assert.ok(actual)
 for(const key of ['x_m','y_m','model_role','use_for_prediction'])assert.equal(actual[key],s[key])
 assert.ok(s.x_m>=0&&s.x_m<=500&&s.y_m>=0&&s.y_m<=500)
 assert.ok(solid.every(o=>!contains(o,s.x_m,s.y_m)),`${s.sensor_id} inside obstacle`)
}
assert.deepEqual(city.sensors.filter(s=>s.use_for_prediction).map(s=>s.id),['S1','S2','S4','S5'])
assert.deepEqual(city.sensors.map(s=>[s.id,s.x_m,s.y_m]),[['S1',0,500],['S2',0,0],['S3',158,150],['S4',500,500],['S5',500,0]])
assert.equal(city.regional_sensors.length,24)
assert.equal(canonical.regional_sensors.length,24)
for(const s of city.regional_sensors){
 const original=canonical.regional_sensors.find(v=>v.sensor_id===s.id);assert.ok(original)
 for(const key of ['x_m','y_m','radius_m','bearing_deg','model_role','use_for_prediction'])assert.equal(s[key],original[key])
 assert.equal(s.use_for_prediction,false)
 assert.equal(s.model_role,'regional_observation')
 assert.ok(Math.abs(Math.hypot(s.x_m-250,s.y_m-250)-s.radius_m)<1e-6)
 const theta=s.bearing_deg*Math.PI/180
 assert.ok(Math.abs(s.x_m-(250+s.radius_m*Math.sin(theta)))<1e-6)
 assert.ok(Math.abs(s.y_m-(250+s.radius_m*Math.cos(theta)))<1e-6)
}
for(const r of [1000,5000,10000])assert.deepEqual(city.regional_sensors.filter(s=>s.radius_m===r).map(s=>s.bearing_deg),[0,45,90,135,180,225,270,315])
const ids=[...objects.map(o=>o.id),...city.sensors.map(s=>s.id),...city.regional_sensors.map(s=>s.id)]
assert.equal(new Set(ids).size,ids.length)
const rows=path=>text(path).trim().split('\n').map(line=>line.split(','))
for(const prefix of ['CFD/geometry','public/data/exports']){
 assert.deepEqual(rows(`${prefix}/sensors.csv`).slice(1),city.sensors.map(s=>[s.id,s.name,s.x_m,s.y_m].map(String)))
 assert.deepEqual(rows(`${prefix}/regional-sensors.csv`).slice(1),city.regional_sensors.map(s=>[s.id,s.name,s.x_m,s.y_m,s.radius_m,s.bearing_deg,s.model_role,s.use_for_prediction].map(String)))
}
const obstacleRows=rows('CFD/geometry/obstacles.csv').slice(1)
assert.deepEqual(obstacleRows,solid.map(o=>[o.object_id,o.shape,o.x_m,o.y_m,o.radius_m??'',o.width_m??'',o.depth_m??'',o.height_m,...bounds(o)].map(String)))
assert.deepEqual(rows('public/data/exports/obstacles.csv').slice(1),city.obstacles.map(o=>[o.id,o.name,o.kind,o.role,o.cx_m,o.cy_m,o.radius_m??'',o.width_m??'',o.depth_m??'',o.height_m??''].map(String)))
const map=text('CFD/geometry/city-map.svg')
assert.equal(map,text('public/data/exports/marswindnet-layout-v2.svg'))
for(const o of objects){
 const tag=map.match(new RegExp(`<[^>]*data-object-id="${o.id}"[^>]*>`))?.[0];assert.ok(tag,`SVG missing ${o.id}`)
 const attribute=name=>Number(tag.match(new RegExp(` ${name}="([^"]+)"`))?.[1])
 if(o.kind==='box'){assert.equal(attribute('x'),o.cx_m-o.width_m/2);assert.equal(attribute('y'),500-o.cy_m-o.depth_m/2);assert.equal(attribute('width'),o.width_m);assert.equal(attribute('height'),o.depth_m)}
 else{assert.equal(attribute('cx'),o.cx_m);assert.equal(attribute('cy'),500-o.cy_m);assert.equal(attribute('r'),o.radius_m)}
}
for(const s of city.sensors)assert.ok(map.includes(`data-sensor-id="${s.id}"`)&&map.includes(`cx="${s.x_m}" cy="${500-s.y_m}"`))
const regionalMap=text('CFD/geometry/regional-map.svg');assert.equal(regionalMap,text('public/data/exports/regional-map.svg'))
for(const s of city.regional_sensors){
 assert.ok(regionalMap.includes(`data-sensor-id="${s.id}" data-x-m="${s.x_m}" data-y-m="${s.y_m}"`))
 const tag=regionalMap.match(new RegExp(`<circle data-sensor-id="${s.id}"[^>]*>`))?.[0];assert.ok(tag)
 assert.ok(tag.includes(`cx="${360+(s.x_m-250)*.027}" cy="${360-(s.y_m-250)*.027}"`))
}
for(const scenario of SCENARIOS.filter(s=>s.fixture)){
 const prefix=`public/data/scenarios/${scenario.id}`
 assert.deepEqual(read(`${prefix}.observations.json`),makeScenarioObservations(city,scenario))
 const regional=read(`${prefix}.regional-observations.json`)
 assert.equal(regional.layout_id,city.layout_id);assert.equal(regional.scenario_id,scenario.id)
 assert.equal(regional.source,'analytic-fixture');assert.equal(regional.scope,'regional')
 assert.deepEqual(regional.readings,city.regional_sensors.map(s=>{
  const velocity=scenario.fixture==='obstacle-flow'?evaluateIllustrativeVelocity(city,s.x_m,s.y_m,scenario.inlet_u_mps,scenario.inlet_v_mps):{u:scenario.inlet_u_mps,v:scenario.inlet_v_mps}
  return {sensor_id:s.id,x_m:s.x_m,y_m:s.y_m,u_mps:velocity.u,v_mps:velocity.v}
 }))
 if(scenario.id==='eastward-inflow'||scenario.fixture==='obstacle-flow'){
  const paired=rows(`${prefix}.paired.csv`).slice(1)
  assert.equal(paired.length,16384)
  for(const [index,row] of paired.entries()){
   const x=(index%128+.5)*3.90625,y=(Math.floor(index/128)+.5)*3.90625
   assert.equal(Number(row[0]),index);assert.equal(Number(row[1]),x);assert.equal(Number(row[2]),y)
   assert.equal(Number(row[3]),Number(solid.every(o=>!contains(o,x,y))))
  }
  assert.equal(read(`${prefix}.metadata.json`).layout_id,city.layout_id)
 }
}
console.log(`Geometry and exports agree: ${canonical.layout_id}, 20 objects, 14 separated obstacles, 5 local + 24 regional stations, 128² cell-centred grid.`)
