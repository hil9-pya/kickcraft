import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
const root=new URL('../',import.meta.url)
test('normal dev startup includes the local worker launcher',()=>{
 const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'))
 assert.equal(pkg.scripts.dev,'node tools/dev.mjs')
})
test('missing PHP fails clearly before starting website or worker',()=>{
 const result=spawnSync(process.execPath,['tools/dev.mjs','--check'],{cwd:root,env:{...process.env,PHP_BINARY:'C:/kickcraft-missing/php.exe'},encoding:'utf8'})
 assert.equal(result.status,1)
 assert.match(result.stderr,/PHP unavailable/)
 assert.doesNotMatch(result.stdout,/worker running|Local site ready/)
})
