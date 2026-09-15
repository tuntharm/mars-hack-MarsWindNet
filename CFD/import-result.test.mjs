import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { importResult } from './import-result.mjs'
const temporary=[]
afterEach(()=>{for(const path of temporary.splice(0))rmSync(path,{recursive:true,force:true})})
function setup(){
 const root=mkdtempSync(join(tmpdir(),'marswindnet-import-test-'));temporary.push(root)
 mkdirSync(join(root,'public/data/city'),{recursive:true});mkdirSync(join(root,'public/data/scenarios'),{recursive:true})
 cpSync('public/data/city/marswindnet-layout-v2.json',join(root,'public/data/city/marswindnet-layout-v2.json'))
 const city=JSON.parse(readFileSync('public/data/city/marswindnet-layout-v2.json','utf8'))
 const result={kind:'cfd-reference',layout_id:city.layout_id,scenario_id:'cfd-eastward-8',grid:city.grid,u_mps:Array(16384).fill(8),v_mps:Array(16384).fill(0),is_fluid:Array(16384).fill(true),provenance:'TEST ONLY — no CFD solve'}
 writeFileSync(join(root,'test-result.json'),JSON.stringify(result))
 return {root,city,result}
}
describe('CFD file import',()=>{
 it('writes a reloadable reference and no invented observations or comparison',()=>{
  const {root}=setup();const imported=importResult(root,join(root,'test-result.json'))
  const saved=JSON.parse(readFileSync(imported.destination,'utf8'))
  expect(saved.u_mps).toHaveLength(16384);expect(saved.u_mps.some(v=>v===null)).toBe(true)
  expect(existsSync(join(root,'public/data/scenarios/cfd-eastward-8.observations.json'))).toBe(false)
  expect(existsSync(join(root,'public/data/scenarios/cfd-eastward-8.paired.csv'))).toBe(false)
 })
 it('validates observations before writing the reference',()=>{
  const {root}=setup();writeFileSync(join(root,'bad-observations.json'),JSON.stringify({source:'provided',readings:[]}))
  expect(()=>importResult(root,join(root,'test-result.json'),join(root,'bad-observations.json'))).toThrow()
  expect(existsSync(join(root,'public/data/scenarios/cfd-eastward-8.reference.json'))).toBe(false)
 })
})
