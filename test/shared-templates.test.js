import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
function php(code){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',`require ${JSON.stringify(root+'/api/templates/common.php')}; ${code}`],{encoding:'utf8'}))}
test('template reuse requires approved entry and an active approved creator',()=>{
 const result=php(`$base=['status'=>'approved','creator_status'=>'approved','creator_deleted'=>null,'creator_removed'=>0];$out=[templateAvailable($base)];foreach([['status','pending'],['status','rejected'],['creator_status','suspended'],['creator_status','pending'],['creator_deleted','2026-10-13'],['creator_removed',1]] as [$key,$value])$out[]=templateAvailable(array_replace($base,[$key=>$value]));echo json_encode($out);`)
 assert.deepEqual(result,[true,false,false,false,false,false,false])
})
test('template snapshots may only read matching local public assets',()=>{
 const result=php(`$out=[];foreach([['/models/shoe-soleview-final.glb','glb'],['/../api/config.php','php'],['https://example.com/model.glb','glb'],['/models/shoe-soleview-final.glb','png'],['/models/missing.glb','glb']] as [$file,$extension]){try{templateFile($file,$extension);$out[]=true;}catch(Throwable $e){$out[]=false;}}echo json_encode($out);`)
 assert.deepEqual(result,[true,false,false,false,false])
})
