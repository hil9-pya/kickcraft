import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
function php(code){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-d','extension=gd','-d','memory_limit=512M','-r',`require ${JSON.stringify(root+'/api/scans/tripo-common.php')}; ${code}`],{encoding:'utf8'}))}
test('V3 generation keeps standard textured geometry and maps single or labeled multiview inputs',()=>{
 const result=php(`$out=[];foreach([['front'=>'one'],['right'=>'r','front'=>'f','left'=>'l']] as $tokens)$out[]=tripoGeneration($tokens);echo json_encode($out);`)
 assert.equal(result[0].path,'/generation/image-to-model');assert.equal(result[0].body.input,'one')
 assert.equal(result[1].path,'/generation/multiview-to-model');assert.deepEqual(result[1].body.inputs,[{front:'f'},{left:'l'},{right:'r'}])
 for(const {body} of result){assert.equal(body.model,'v3.1-20260211');assert.equal(body.texture,true);assert.equal(body.pbr,true);assert.equal(body.face_limit,49900);assert.equal(body.texture_quality,'standard');assert.equal(body.generate_parts,undefined)}
})
test('Tripo guard rejects missing consent, insufficient funds and invalid or duplicate views',()=>{
 const result=php(`$out=[];foreach([[],['confirmCloud'=>true],['confirmCloud'=>true,'maxCredits'=>30],['confirmCloud'=>'yes','maxCredits'=>30]] as $body){try{tripoConsent($body);$out[]=true;}catch(Throwable $e){$out[]=false;}}foreach([0,29,30,170,null,'bad',INF] as $balance){try{tripoCredits($balance);$out[]=true;}catch(Throwable $e){$out[]=false;}}foreach([[['view'=>'front']],[['view'=>'left']],[['view'=>'front'],['view'=>'front']],[['view'=>'front'],['view'=>'right']]] as $images){try{tripoViews($images);$out[]=true;}catch(Throwable $e){$out[]=false;}}echo json_encode($out);`)
 assert.deepEqual(result,[false,false,true,false,false,false,true,true,false,false,false,true,false,false,true])
})
test('model download restricts HTTPS to Tripo assets without credentials, ports or redirects',()=>{
 const result=php(`$out=[];foreach(['https://tripo-data.rg1.data.tripo3d.com/a.glb?sig=abc','https://cdn.tripo3d.ai/a.glb','http://cdn.tripo3d.ai/a.glb','https://tripo3d.ai.evil.invalid/a','https://eviltripo3d.ai/a','https://user:pass@cdn.tripo3d.ai/a','https://cdn.tripo3d.ai:444/a','file:///tmp/a'] as $url){try{tripoAssetUrl($url);$out[]=true;}catch(Throwable $e){$out[]=false;}}echo json_encode($out);`)
 assert.deepEqual(result,[true,true,false,false,false,false,false,false])
})

test('Tripo uploads label views, keep saved job on failure, and require explicit paid start',async()=>{
 const {uploadTripoCapture,startTripoScan}=await import('../src/tripo-capture.js'),saved=globalThis.fetch
 let job={id:'tripo-one',engine:'tripo',state:'uploading',images:[]},uploads=[],starts=[]
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('create.php')){assert.equal(JSON.parse(options.body).engine,'tripo');return Response.json({job})}
  if(url.endsWith('upload.php')){uploads.push(options.body.get('view'));assert.equal(options.body.get('id'),job.id);return Response.json({job})}
  starts.push(JSON.parse(options.body));return Response.json({job:{...job,state:'queued'}})
 }
 try{
  const photo=new File(['photo'],'original.png',{type:'image/png'})
  assert.equal((await uploadTripoCapture([{view:'front',file:photo},{view:'left',file:photo}],()=>{})).id,job.id)
  assert.deepEqual(uploads,['front','left']);assert.equal(starts.length,0,'local upload must never auto-generate')
  await startTripoScan(job.id);assert.deepEqual(starts,[{id:job.id,confirmCloud:true,maxCredits:30,useMasks:false}])
  globalThis.fetch=async()=>{throw new Error('offline')}
  await assert.rejects(uploadTripoCapture([{view:'right',file:photo}],()=>{},job),error=>error.jobId===job.id)
 }finally{globalThis.fetch=saved}
})

test('lost paid response is fenced before POST and cannot trigger a duplicate charge',()=>{
 const result=php(`require ${JSON.stringify(root+'/tools/tripo.php')};
 $root=sys_get_temp_dir().'/kc-tripo-ledger-'.bin2hex(random_bytes(5));$_ENV['SCAN_STORAGE']=$root;
 $id='11111111-1111-4111-8111-111111111111';$dir=scanJobDir($id);mkdir($dir.'/images',0700,true);
 $photo=imagecreatetruecolor(256,256);imagepng($photo,$dir.'/images/front.png');imagedestroy($photo);
 $image=array_merge(scanImageInfo($dir.'/images/front.png'),['view'=>'front','file'=>'front.png','hash'=>hash_file('sha256',$dir.'/images/front.png')]);
 $job=['id'=>$id,'images'=>[$image],'state'=>'failed','stage'=>'Reconstruction failed'];$paid=0;$errors=[];
 $request=function($method,$path)use(&$paid){if($path==='/account/balance')return ['balance'=>170];if($path==='/files')return ['file_token'=>'file_test'];$paid++;throw new RuntimeException('lost response');};
 for($i=0;$i<2;$i++){try{tripoProcess($job,fn($stage)=>null,$request);}catch(Throwable $e){$errors[]=$e->getMessage();}}
 $canResume=tripoCanResume($job);
 tripoWrite($dir.'/tripo-task.json',['task_id'=>'known-task','status'=>'running']);$knownResume=tripoCanResume($job);
 $queried=[];$failed=function($method,$path)use(&$queried){$queried[]=$path;return ['status'=>'failed'];};
 try{tripoProcess($job,fn($stage)=>null,$failed);}catch(Throwable $e){}
 echo json_encode(['paid'=>$paid,'errors'=>$errors,'unknownResume'=>$canResume,'knownResume'=>$knownResume,'queries'=>$queried,'failedResume'=>tripoCanResume($job),'inputIntact'=>hash_file('sha256',$dir.'/images/front.png')===$image['hash']]);
 foreach(glob($dir.'/*') as $file)if(is_file($file))unlink($file);unlink($dir.'/images/front.png');rmdir($dir.'/images');rmdir($dir);rmdir($root);`)
 assert.equal(result.paid,1);assert.match(result.errors[1],/resubmission is blocked/)
 assert.equal(result.unknownResume,false);assert.equal(result.knownResume,true)
 assert.deepEqual(result.queries,['/tasks/known-task']);assert.equal(result.failedResume,false);assert.equal(result.inputIntact,true)
})

test('cloud photo preparation strips metadata and applies reviewed masks without changing originals',()=>{
 const result=php(`require ${JSON.stringify(root+'/tools/tripo.php')};
 $dir=sys_get_temp_dir().'/kc-tripo-input-'.bin2hex(random_bytes(5));mkdir($dir.'/images',0700,true);mkdir($dir.'/masks',0700,true);
 $source=imagecreate(256,256);$color=imagecolorallocate($source,120,90,60);imagefill($source,0,0,$color);imagepng($source,$dir.'/images/front.png');imagedestroy($source);
 $chunk=function($type,$data){return pack('N',strlen($data)).$type.$data.hash('crc32b',$type.$data,true);};
 $original=file_get_contents($dir.'/images/front.png');file_put_contents($dir.'/images/front.png',substr($original,0,33).$chunk('tEXt',"camera\\0private-camera-note").substr($original,33));
 $rows='';for($y=0;$y<256;$y++)$rows.="\\0".str_repeat("\\0",64).str_repeat("\\xff",128).str_repeat("\\0",64);
 $mask="\\x89PNG\\r\\n\\x1a\\n".$chunk('IHDR',pack('NNCCCCC',256,256,8,0,0,0,0)).$chunk('IDAT',gzcompress($rows)).$chunk('IEND','');file_put_contents($dir.'/masks/front.png',$mask);
 $image=array_merge(scanImageInfo($dir.'/images/front.png'),['file'=>'front.png','hash'=>hash_file('sha256',$dir.'/images/front.png'),'maskReviewed'=>true,'maskFile'=>'front.png','maskHash'=>hash_file('sha256',$dir.'/masks/front.png')]);
 $path=tripoInput($image,$dir,'front');$prepared=imagecreatefrompng($path);
 $backgroundAlpha=(imagecolorat($prepared,0,0)>>24)&127;$shoeAlpha=(imagecolorat($prepared,128,128)>>24)&127;tripoInput($image,$dir,'front',false);$raw=imagecreatefrompng($path);
 echo json_encode(['stripped'=>!str_contains(file_get_contents($path),'private-camera-note'),'alphaBackground'=>$backgroundAlpha,'alphaShoe'=>$shoeAlpha,'originalModeAlpha'=>(imagecolorat($raw,0,0)>>24)&127,'originalIntact'=>hash_file('sha256',$dir.'/images/front.png')===$image['hash'],'maskIntact'=>hash_file('sha256',$dir.'/masks/front.png')===$image['maskHash']]);imagedestroy($raw);
 imagedestroy($prepared);unlink($path);unlink($dir.'/images/front.png');unlink($dir.'/masks/front.png');rmdir($dir.'/images');rmdir($dir.'/masks');rmdir($dir);`)
 assert.deepEqual(result,{stripped:true,alphaBackground:127,alphaShoe:0,originalModeAlpha:0,originalIntact:true,maskIntact:true})
})

test('Tripo background mode is explicit, requires review when enabled, and stays frozen after submission',()=>{
 const result=php(`$dir=sys_get_temp_dir().'/kc-tripo-choice-'.bin2hex(random_bytes(5));$_ENV['SCAN_STORAGE']=$dir;$id='22222222-2222-4222-8222-222222222222';$folder=scanJobDir($id);mkdir($folder,0700,true);$job=['id'=>$id,'images'=>[['maskReviewed'=>false]]];$out=[];
 foreach([[],['useMasks'=>false],['useMasks'=>true],['useMasks'=>'yes']] as $body){try{$out[]=tripoMaskChoice($job,$body);}catch(Throwable $e){$out[]='rejected';}}
 tripoWrite($folder.'/tripo-options.json',['useMasks'=>false]);file_put_contents($folder.'/tripo-attempt.json','{}');
 try{tripoMaskChoice($job,['useMasks'=>true]);$out[]='allowed';}catch(Throwable $e){$out[]=$e->getCode();}
 foreach(glob($folder.'/*') as $file)unlink($file);rmdir($folder);rmdir($dir);echo json_encode($out);`)
 assert.deepEqual(result,[false,false,'rejected','rejected',409])
})
test('Tripo client sends explicit cleaned-photo choice without starting background removal or generation automatically',async()=>{
 const {startTripoScan}=await import('../src/tripo-capture.js'),saved=globalThis.fetch,choices=[]
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/scans/start.php');choices.push(JSON.parse(options.body).useMasks);return Response.json({job:{id:'saved'}})}
 try{await startTripoScan('saved');await startTripoScan('saved',true);assert.deepEqual(choices,[false,true])}finally{globalThis.fetch=saved}
})


test('capture engine accepts only Tripo and marks local reconstruction engines retired',()=>{
 const result=php(`$out=[];foreach(['tripo','meshroom','realityscan','template',null,[],false] as $engine){try{$out[]=tripoCaptureEngine($engine);}catch(Throwable $e){$out[]=$e->getCode();}}echo json_encode($out);`)
 assert.deepEqual(result,['tripo',410,410,400,400,400,400])
})
