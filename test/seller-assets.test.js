import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const php='C:/xampp/php/php.exe'
function run(expression){return JSON.parse(execFileSync(php,['-r',`require ${JSON.stringify(root+'/api/scans/common.php')}; try { echo json_encode(${expression}); } catch(Throwable $e){echo json_encode({error:$e->getMessage()});}`.replace('{error:$e->getMessage()}',"['error'=>$e->getMessage()]" )],{encoding:'utf8'}))}
test('multipart original GLB validation derives real material names without requiring a photographed texture',()=>{
 const info=run(`scanGlbInfo(${JSON.stringify(root+'/public/models/shoe-soleview-final.glb')},false,false)`)
 assert.ok(info.materialNames?.includes('UpperMaterial'),JSON.stringify(info))
 assert.ok(info.materialNames.includes('OutsoleMaterial'))
 assert.ok(info.triangles>0 && info.triangles<=50000)
})
