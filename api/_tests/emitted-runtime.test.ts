// @vitest-environment node
import { expect, it } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

it('executes the emitted ESM functions without TypeScript loaders', () => {
  const directory=mkdtempSync(join(tmpdir(),'marswindnet-emitted-'))
  try {
    const compiler=spawnSync(process.execPath,[resolve('node_modules/typescript/bin/tsc'),'--ignoreConfig','--target','ES2023','--module','NodeNext','--moduleResolution','NodeNext','--types','node','--skipLibCheck','--outDir',directory,'--rootDir','.', 'api/model-info.ts','api/predict.ts'],{encoding:'utf8'})
    expect(compiler.status,compiler.stdout+compiler.stderr).toBe(0)
    writeFileSync(join(directory,'package.json'),'{"type":"module"}')
    writeFileSync(join(directory,'verify.mjs'),`
      import assert from 'node:assert/strict';
      import {GET} from './api/model-info.js';
      import {POST} from './api/predict.js';
      delete process.env.MODEL_API_URL;
      const info=await GET(new Request('http://localhost/api/model-info'));
      assert.equal(info.status,200);
      assert.equal((await info.json()).status,'not-connected');
      assert.equal((await POST(new Request('http://localhost/api/predict',{method:'POST'}))).status,503);
    `)
    const check=spawnSync(process.execPath,[join(directory,'verify.mjs')],{encoding:'utf8'})
    expect(check.status,check.stdout+check.stderr).toBe(0)
  } finally {rmSync(directory,{recursive:true,force:true})}
},15000)
