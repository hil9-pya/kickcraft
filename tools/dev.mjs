import {spawn,spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {createServer,loadEnv} from 'vite'

const root=fileURLToPath(new URL('../',import.meta.url))
process.chdir(root)
const php=process.env.PHP_BINARY || (process.platform==='win32'&&existsSync('C:/xampp/php/php.exe')?'C:/xampp/php/php.exe':'php')
let server,worker,stopping=false
async function stop(code=0){
 if(stopping)return
 stopping=true
 if(worker?.pid && worker.exitCode===null){
  if(process.platform==='win32')spawnSync('taskkill',['/PID',String(worker.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'})
  else worker.kill('SIGTERM')
 }
 await server?.close()
 process.exitCode=code
}
process.once('SIGINT',()=>stop())
process.once('SIGTERM',()=>stop())
try{
 const check=spawnSync(php,['-d','extension=gd','tools/check-local.php'],{cwd:root,encoding:'utf8',windowsHide:true})
 if(check.error)throw new Error('PHP unavailable. Start XAMPP PHP or set PHP_BINARY to its executable.')
 if(check.status!==0)throw new Error(check.stderr.trim()||'Local readiness check failed.')
 process.stdout.write(check.stdout)
 const env=loadEnv('development',root,'KICKCRAFT_')
 const target=(env.KICKCRAFT_API_TARGET||'http://localhost/kickcraft').replace(/\/$/,'')
 try{
  const response=await fetch(target+'/api/shoes/list.php',{signal:AbortSignal.timeout(5000)})
  if(!response.ok||!Array.isArray((await response.json()).shoes))throw new Error('Invalid API response')
 }catch{throw new Error('PHP API unavailable. Start Apache and MySQL in XAMPP; check KICKCRAFT_API_TARGET.')}
 console.log('Apache PHP API ready.')
 if(!process.argv.includes('--check')){
  server=await createServer({root});await server.listen()
  worker=spawn(php,['-d','extension=gd','-d','memory_limit=512M','tools/process-scans.php'],{cwd:root,stdio:'inherit',windowsHide:true})
  worker.once('spawn',()=>{console.log('Local worker running. Keep this terminal open while jobs process.');server.printUrls()})
  worker.once('error',error=>{console.error('Worker failed to start: '+error.message);void stop(1)})
  worker.once('exit',code=>{if(!stopping){console.error('Local worker stopped. Restart npm run dev after checking the error above.');void stop(code||1)}})
 }else console.log('Local readiness checks passed. Run npm run dev to start website and worker together.')
}catch(error){console.error(error.message);await stop(1)}
