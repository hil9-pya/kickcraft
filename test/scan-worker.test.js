import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync,spawn} from 'node:child_process'
import {mkdtempSync,writeFileSync,rmSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
const php=process.env.PHP_BINARY || 'C:/xampp/php/php.exe'
function run(args) {return execFileSync(php,['-r',`require ${JSON.stringify(root+'/tools/process-scans.php')}; ${args}`],{encoding:'utf8'})}
test('worker reports nonzero tool exit and missing executable instead of readiness',()=>{
 assert.equal(run(`try {scanProcess([PHP_BINARY,'-r','exit(7);'],sys_get_temp_dir().'/kc-scan-worker.log',function(){},5);} catch(Throwable $e) {echo $e->getMessage();}`),'Reconstruction tool exited with code 7')
 assert.match(run(`try {scanProcess(['/missing/meshroom'],sys_get_temp_dir().'/kc-scan-worker.log',function(){},5);} catch(Throwable $e) {echo $e->getMessage();}`),/not installed/)
 assert.match(run(`try {scanToolCommand(['/missing/blender'],sys_get_temp_dir(),'missing');} catch(Throwable $e) {echo $e->getMessage();}`),/not installed/)
})
test('worker enforces a deadline and terminates child tools',()=>{
 const started=Date.now()
 assert.match(run(`try {scanProcess([PHP_BINARY,'-r','sleep(30);'],sys_get_temp_dir().'/kc-scan-timeout.log',function(){},1);} catch(Throwable $e) {echo $e->getMessage();}`),/time limit/)
 assert.ok(Date.now()-started<10000)
})

test('worker passes a controlled runtime environment to the actual child process',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-worker-env-'))
 try {
  const output=path.join(dir,'environment.txt').replaceAll('\\','/')
  const code=`file_put_contents(${JSON.stringify(output)},getenv('KC_SCAN_ENV_TEST'));`
  run(`scanProcess([PHP_BINARY,'-r',${JSON.stringify(code)}],sys_get_temp_dir().'/kc-scan-env.log',function(){},5,array_merge(getenv(),['KC_SCAN_ENV_TEST'=>'private-cache']));`)
  assert.equal(readFileSync(output,'utf8'),'private-cache')
 } finally {rmSync(dir,{recursive:true,force:true})}
})

test('Windows tool runner waits for a relaunched child after its parent exits',()=>{
 if(process.platform!=='win32') return
 const dir=mkdtempSync(path.join(tmpdir(),'kc-process-tree-'))
 try {
  const child=path.join(dir,'child.ps1'),parent=path.join(dir,'parent.ps1'),done=path.join(dir,'done.txt'),args=path.join(dir,'args.json')
  writeFileSync(child,`Start-Sleep -Seconds 1\nSet-Content -LiteralPath '${done}' -Value 'done'`)
  writeFileSync(parent,`Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile -File "${child}"'`)
  writeFileSync(args,JSON.stringify(['-NoProfile','-File',parent]))
  try { execFileSync('powershell.exe',['-NoProfile','-File',root+'/tools/run-scan-tool.ps1','-Executable','C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-ArgumentsFile',args,'-LogPrefix',path.join(dir,'tool')]) } catch(error) { throw new Error(readFileSync(path.join(dir,'tool-stderr.log'),'utf8') || error.message) }
  assert.equal(readFileSync(done,'utf8').trim(),'done')
 } finally {rmSync(dir,{recursive:true,force:true})}
})


for(const relaunched of [true,false]) test(`hard-stopping PHP also stops ${relaunched?'relaunched':'direct'} reconstruction tools`,async()=>{
 if(process.platform!=='win32')return
 const dir=mkdtempSync(path.join(tmpdir(),'kc-worker-crash-'))
 let driver,toolPid
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
 try {
  const child=path.join(dir,'child.ps1'),parent=path.join(dir,'parent.ps1'),pidFile=path.join(dir,'tool.pid'),args=path.join(dir,'args.json'),script=path.join(dir,'driver.php')
  writeFileSync(child,`Set-Content -LiteralPath '${pidFile}' -Value $PID\nStart-Sleep -Seconds 30`)
  writeFileSync(parent,`Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile -File "${child}"'`)
  writeFileSync(args,JSON.stringify(['-NoProfile','-File',parent]))
  const direct=path.join(dir,'direct.php')
  writeFileSync(direct,`<?php file_put_contents('${pidFile.replaceAll('\\','/')}',getmypid()); sleep(30);`)
  const command=relaunched?['C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-File',parent]:[php,direct]
  writeFileSync(script,`<?php require '${root}/tools/process-scans.php'; scanProcess(scanToolCommand(json_decode('${JSON.stringify(command).replaceAll('\\','\\\\')}',true),'${dir.replaceAll('\\','/')}','tool'),'${dir.replaceAll('\\','/')}/worker.log',function(){},60);`)
  driver=spawn(php,[script],{stdio:'ignore'})
  for(let tries=0;tries<100 && !existsSync(pidFile);tries++)await pause(100)
  assert.ok(existsSync(pidFile),'fixture tool did not start')
  toolPid=Number(readFileSync(pidFile,'utf8').trim())
  execFileSync('taskkill.exe',['/PID',String(driver.pid),'/F'],{stdio:'ignore'})
  await pause(2500)
  const alive=execFileSync('powershell.exe',['-NoProfile','-Command',`if(Get-Process -Id ${toolPid} -ErrorAction SilentlyContinue){'alive'}else{'stopped'}`],{encoding:'utf8'}).trim()
  assert.equal(alive,'stopped','reconstruction survived the PHP worker')
 }finally {
  if(toolPid)try{execFileSync('taskkill.exe',['/PID',String(toolPid),'/T','/F'],{stdio:'ignore'})}catch{}
  if(driver?.pid)try{execFileSync('taskkill.exe',['/PID',String(driver.pid),'/T','/F'],{stdio:'ignore'})}catch{}
  rmSync(dir,{recursive:true,force:true})
 }
})
