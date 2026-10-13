import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
import {mkdtempSync,writeFileSync,rmSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
const php=process.env.PHP_BINARY||'C:/xampp/php/php.exe'
function run(code){return JSON.parse(execFileSync(php,['-r',`require ${JSON.stringify(root+'/tools/probe-realityscan.php')}; ${code}`],{encoding:'utf8'}))}
test('RealityScan trial uses native video import and AI masking in independent private projects',()=>{
 const commands=run(`echo json_encode(realityScanProbeCommands('C:/Tools/RealityScan.exe','C:/clips/shoe video.mp4','C:/private/trial',1));`)
 const imported=commands.import
 assert.deepEqual(imported.slice(imported.indexOf('-importVideo'),imported.indexOf('-importVideo')+4),['-importVideo','C:/clips/shoe video.mp4','C:/private/trial/frames','1'])
 assert.ok(commands.mask.includes('-generateAIMasks'));assert.deepEqual(commands.mask.slice(commands.mask.indexOf('-exportMasks'),commands.mask.indexOf('-exportMasks')+3),['-exportMasks','C:/private/trial/masks',root+'/tools/realityscan-mask.xml'])
 assert.ok(commands.align.includes('inpMaskOpts=2'))
 assert.ok(commands.align.includes('-exportReport'));assert.ok(!commands.align.includes('-exportXMPForSelectedComponent'))
 for(const command of Object.values(commands)){assert.equal(command[0],'C:/Tools/RealityScan.exe');assert.ok(command.includes('-headless'));assert.ok(command.includes('-disableOnlineCommunication'));assert.ok(command.includes('appQuitOnError=true'));assert.equal(command.at(-1),'-quit');assert.ok(!command.includes('-delegateTo'))}
 assert.ok(commands.model.includes('49900'));assert.ok(commands.model.includes('C:/private/trial/model.obj'))
})
test('trial camera coverage enforces existing 30-view and 80-percent rule',()=>{
 const outcomes=run(`$results=[];foreach([[29,40],[30,40],[32,40],[40,40]] as [$aligned,$total]){try{realityScanProbeCoverage($aligned,$total);$results[]=true;}catch(Throwable $e){$results[]=false;}}echo json_encode($results);`)
 assert.deepEqual(outcomes,[false,false,true,true])
})
test('trial cannot claim completion without actual extracted frames or matching masks',()=>{
 const outcomes=run(`$results=[];foreach([[29,29],[41,0],[41,40],[41,41],[121,121]] as [$images,$masks]){try{realityScanProbeInputs($images,$masks);$results[]=true;}catch(Throwable $e){$results[]=false;}}echo json_encode($results);`)
 assert.deepEqual(outcomes,[false,false,false,true,false])
})

test('missing RealityScan fails cleanly before a trial, process or database write',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-native-probe-'))
 try {
  const video=path.join(dir,'capture.mp4').replaceAll('\\','/'),privateRoot=path.join(dir,'private').replaceAll('\\','/')
  writeFileSync(video,Buffer.from('00000018667479706d703432000000006d70343269736f6d','hex'))
  const result=run(`$_ENV['SCAN_STORAGE']=${JSON.stringify(privateRoot)};try{realityScanProbeMain(['video'=>${JSON.stringify(video)},'exe'=>'C:/missing/RealityScan.exe','trial'=>'unit-trial','run'=>true]);}catch(Throwable $e){echo json_encode(['error'=>$e->getMessage()]);}`)
  assert.match(result.error,/not installed/);assert.equal(existsSync(path.join(privateRoot,'realityscan-comparisons','unit-trial')),false)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
