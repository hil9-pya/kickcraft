import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
const configUrl=new URL('../vite.config.js',import.meta.url).href
function configured(local='',overrides={}){
 const directory=mkdtempSync(join(tmpdir(),'kickcraft-dev-')),file=join(directory,'.env.development.local')
 const env={...process.env};delete env.KICKCRAFT_API_TARGET;delete env.KICKCRAFT_DEV_PORT;Object.assign(env,overrides)
 try{
  writeFileSync(file,local)
  const code=`const {default:value}=await import(${JSON.stringify(configUrl)});const config=typeof value==='function'?value({command:'serve',mode:'development'}):value;console.log(JSON.stringify({port:config.server.port,target:config.server.proxy['/api'].target,strict:config.server.strictPort}));`
  return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:directory,env,encoding:'utf8'}))
 }finally{unlinkSync(file);rmdirSync(directory)}
}
test('local development settings survive a fresh shell and keep the isolated backend and port',()=>{
 assert.deepEqual(configured('KICKCRAFT_API_TARGET=http://localhost/kickcraft-photo-scan\nKICKCRAFT_DEV_PORT=5174\n'),{port:5174,target:'http://localhost/kickcraft-photo-scan',strict:true})
})
test('default checkout and explicit shell overrides still work',()=>{
 assert.deepEqual(configured(),{port:5173,target:'http://localhost/kickcraft',strict:true})
 assert.deepEqual(configured('KICKCRAFT_API_TARGET=http://localhost/kickcraft-photo-scan\nKICKCRAFT_DEV_PORT=5174\n',{KICKCRAFT_API_TARGET:'http://localhost/alternate',KICKCRAFT_DEV_PORT:'5180'}),{port:5180,target:'http://localhost/alternate',strict:true})
})
