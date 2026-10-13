import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
function php(code){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',`require ${JSON.stringify(root+'/tools/process-scans.php')}; try {echo json_encode(${code});} catch(Throwable $e) {echo json_encode(['error'=>$e->getMessage()]);}`],{encoding:'utf8'}))}

test('native and Meshroom alignment keep 80% default and allow explicit 65% with thirty views',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-retry-')).replaceAll('\\','/')
 try {
  for(const [aligned,total,minimum,passes] of [[41,61,null,false],[41,61,65,true],[39,61,65,false],[40,61,65,true],[40,62,65,false],[52,80,65,true],[29,40,65,false],[30,46,65,true],[30,47,65,false],[32,40,80,true],[41,61,64,false]]) {
   writeFileSync(dir+'/coverage.csv',`${aligned},${total}`)
   writeFileSync(dir+'/cameras.sfm',JSON.stringify({poses:Array.from({length:aligned},(_,i)=>({poseId:String(i)})),intrinsics:[{intrinsicId:'0'}],views:Array.from({length:total},(_,i)=>({viewId:String(i),poseId:String(i),intrinsicId:'0'}))}))
   for(const [fn,file] of [['scanNativeCoverage','coverage.csv'],['scanCameraCoverage','cameras.sfm']]) {
    const result=php(`${fn}(${JSON.stringify(dir+'/'+file)},${total}${minimum===null?'':','+minimum})`)
    assert.equal(!result.error,passes,JSON.stringify({fn,aligned,total,minimum,result}))
    if(passes)assert.deepEqual(result,{aligned,total})
   }
  }
 } finally {rmSync(dir,{recursive:true,force:true})}
})

test('experimental request only accepts explicit boolean and failed reconstruction',()=>{
 for(const value of ['true','1','65','null','"yes"']) {
  const result=php(`scanRetryMinimum(['experimental'=>${value}])`)
  if(value==='true')assert.equal(result,65);else assert.ok(result.error)
 }
 assert.equal(php("scanRetryMinimum([])"),80)
 assert.equal(php("scanRetryMinimum(['experimental'=>false])"),80)
 assert.equal(php("scanRetryable(['state'=>'failed','stage'=>'Reconstruction failed','operation'=>'reconstruct'])"),true)
 for(const job of [{state:'failed',stage:'Capture discarded',operation:'reconstruct'},{state:'failed',stage:'Reconstruction failed',operation:'prepare'},{state:'ready',stage:'Reconstruction failed',operation:'reconstruct'}])assert.equal(php(`scanRetryable(json_decode(${JSON.stringify(JSON.stringify(job))},true))`),false)
})
