<?php
// Local integration fixtures only. Provider transport is injected; no external API calls or credits.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/process-scans.php';session_write_close();
if(configValue('DB_NAME')!=='kickcraft_photo_scan_dev')throw new RuntimeException('Isolated scan database required');
$db=getDb();$base='http://localhost:5174/api';$checks=0;$jobs=[];$users=[];$products=[];$temporary=[];
$lock='kickcraft-scan-'.substr(hash('sha256',(string)configValue('DB_NAME')),0,32);$statement=$db->prepare('SELECT GET_LOCK(?,5)');$statement->execute([$lock]);
if((int)$statement->fetchColumn()!==1)throw new RuntimeException('Wait for active scanner before verification');
function verifyTripo($ok,string $message): void {global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function tripoHttp(string $path,string $cookie='', $body=null,array $headers=[]): array {
 global $base;$curl=curl_init($base.'/'.$path);$all=['X-Requested-With: '.(str_starts_with($path,'scans/')?'KickCraftScan':'KickCraft')];if($body!==null && !is_array($body))$all[]='Content-Type: application/json';
 curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_COOKIE=>$cookie,CURLOPT_HTTPHEADER=>array_merge($all,$headers)]);
 if($body!==null){curl_setopt($curl,CURLOPT_POST,true);curl_setopt($curl,CURLOPT_POSTFIELDS,$body);}
 $raw=curl_exec($curl);if($raw===false)throw new RuntimeException('Local HTTP request failed');$size=curl_getinfo($curl,CURLINFO_HEADER_SIZE);preg_match_all('/^Set-Cookie:\s*([^;\r\n]+)/mi',substr($raw,0,$size),$cookies);
 return ['status'=>curl_getinfo($curl,CURLINFO_RESPONSE_CODE),'data'=>json_decode(substr($raw,$size),true),'cookie'=>end($cookies[1])?:''];
}
function tripoPost(string $path,string $cookie,array $body,array $headers=[]): array {return tripoHttp($path,$cookie,json_encode($body),$headers);}
function tripoFixture(string $path,bool $regions=false): void {
 // Use only original KickCraft geometry; this incomplete synthetic fixture proves plumbing, not likeness.
 $raw=file_get_contents(__DIR__.'/../public/models/shoe-soleview-final.glb');$length=unpack('V',substr($raw,12,4))[1];$json=json_decode(substr($raw,20,$length),true);$bin=substr($raw,28+$length);
 $mesh=$json['meshes'][7];$primitive=$mesh['primitives'][0];$primitive['material']=0;
 $material=['name'=>'KCScan_Original','pbrMetallicRoughness'=>['baseColorTexture'=>['index'=>0],'metallicFactor'=>0,'roughnessFactor'=>1]];
 $json['materials']=[$material];$json['meshes']=[['name'=>'SyntheticWorkflowSurface','primitives'=>[$primitive]]];$json['nodes']=[['mesh'=>0]];$json['scenes']=[['nodes'=>[0]]];$json['scene']=0;unset($json['animations'],$json['skins']);
 if($regions){
  $index=$json['accessors'][$primitive['indices']];$count=intdiv($index['count'],6)*3;$width=[5121=>1,5123=>2,5125=>4][$index['componentType']];
  $first=$index;$first['count']=$count;$second=$index;$second['count']-=$count;$second['byteOffset']=($second['byteOffset']??0)+$count*$width;
  $a=count($json['accessors']);$json['accessors'][]=$first;$json['accessors'][]=$second;
  $one=$primitive;$one['indices']=$a;$one['material']=0;$two=$primitive;$two['indices']=$a+1;$two['material']=1;$json['meshes'][0]['primitives']=[$one,$two];
  $json['materials']=[$material,$material];$json['materials'][0]['name']='KCScan_UpperMaterial';$json['materials'][1]['name']='KCScan_MidsoleMaterial';
 }
 $text=json_encode($json,JSON_UNESCAPED_SLASHES);$text.=str_repeat(' ',(4-strlen($text)%4)%4);file_put_contents($path,'glTF'.pack('VV',2,28+strlen($text)+strlen($bin)).pack('VV',strlen($text),0x4e4f534a).$text.pack('VV',strlen($bin),0x004e4942).$bin);
}
try {
 verifyTripo((int)$db->query("SELECT COUNT(*) FROM scan_jobs WHERE state IN ('queued','processing')")->fetchColumn()===0,'Existing active jobs; no test job queued');
 $admin=tripoPost('auth/login.php','',['email'=>configValue('KICKCRAFT_OWNER_EMAIL'),'password'=>configValue('KICKCRAFT_OWNER_PASSWORD')]);verifyTripo($admin['status']===200,'Owner login failed');$admin=$admin['cookie'];
 verifyTripo(tripoPost('scans/create.php','',['engine'=>'tripo'])['status']===401,'Guest created Tripo job');
 verifyTripo(tripoPost('scans/create.php',$admin,['engine'=>'tripo'],['Origin: https://untrusted.invalid'])['status']===403,'Cross-origin job allowed');
 $password=bin2hex(random_bytes(16));$email='tripo-check-'.bin2hex(random_bytes(6)).'@example.com';
 $r=tripoPost('auth/register.php','',['name'=>'Tripo Workflow Check','email'=>$email,'password'=>$password,'confirmPassword'=>$password,'storeName'=>'Tripo Verification','description'=>'Synthetic original model workflow tests','pickupAddress'=>'Verification Street 12']);verifyTripo($r['status']===201,'Seller registration failed');$user=(int)$r['data']['user']['id'];$users[]=$user;
 $login=tripoPost('auth/login.php','',['email'=>$email,'password'=>$password]);$seller=$login['cookie'];verifyTripo($login['status']===200,'Seller login failed');
 verifyTripo(tripoPost('scans/create.php',$seller,['engine'=>'tripo'])['status']===403,'Unapproved seller generated model');
 verifyTripo(tripoPost('sellers/review.php',$admin,['id'=>$user,'status'=>'approved'])['status']===200,'Seller approval failed');
 verifyTripo(tripoHttp('scans/capabilities.php',$seller)['data']['tripo']===true,'Tripo capability not configured');
 $r=tripoPost('scans/create.php',$seller,['engine'=>'tripo']);verifyTripo($r['status']===201,'Tripo job creation failed');$id=$r['data']['job']['id'];$jobs[]=$id;
 verifyTripo(tripoHttp('scans/status.php?id='.$id,$admin)['status']===404,'Foreign scan readable');
 $photo=tempnam(sys_get_temp_dir(),'kc-tripo-photo-');$temporary[]=$photo;$image=imagecreatetruecolor(256,256);imagefill($image,0,0,0x997755);imagepng($image,$photo);imagedestroy($image);
 $upload=['id'=>$id,'view'=>'front','file'=>new CURLFile($photo,'image/png','front.png')];$r=tripoHttp('scans/upload.php',$seller,$upload);verifyTripo($r['status']===200 && $r['data']['job']['images'][0]['view']==='front','Labeled photo upload failed');
 verifyTripo(tripoHttp('scans/upload.php',$seller,$upload)['data']['job']['imageCount']===1,'Upload retry duplicated reference');
 $upload['view']='left';verifyTripo(tripoHttp('scans/upload.php',$seller,$upload)['status']===422,'Same photo assigned two views');
 $image=imagecreatetruecolor(256,256);imagefill($image,0,0,0x775599);imagepng($image,$photo);imagedestroy($image);
 verifyTripo(tripoHttp('scans/upload.php',$seller,$upload)['data']['job']['imageCount']===2,'Second labeled view failed');
 verifyTripo(tripoPost('scans/start.php',$seller,['id'=>$id])['status']===400,'Generation started without cost/cloud consent');
 verifyTripo(tripoPost('scans/start.php',$seller,['id'=>$id,'confirmCloud'=>true,'maxCredits'=>99])['status']===400,'Unbounded generation budget accepted');
 verifyTripo(tripoPost('scans/start.php',$seller,['id'=>$id,'confirmCloud'=>true,'maxCredits'=>30,'experimental'=>true])['status']===400,'Photogrammetry alignment option accepted for Tripo');
 $masking=tripoPost('scans/ai-masks.php',$seller,['id'=>$id]);verifyTripo($masking['status']===200 && $masking['data']['job']['engine']==='tripo','Local background removal queue lost Tripo engine');
 verifyTripo(tripoPost('scans/start.php',$seller,['id'=>$id,'confirmCloud'=>true,'maxCredits'=>30])['status']===409,'Paid generation accepted while local masks are processing');
 $db->prepare("UPDATE scan_jobs SET state='uploading',operation='reconstruct' WHERE id=?")->execute([$id]);
 $mask=tempnam(sys_get_temp_dir(),'kc-tripo-mask-');$temporary[]=$mask;
 $chunk=fn($type,$data)=>pack('N',strlen($data)).$type.$data.hash('crc32b',$type.$data,true);$rows='';for($y=0;$y<256;$y++)$rows.="\0".str_repeat("\0",64).str_repeat("\xff",128).str_repeat("\0",64);
 file_put_contents($mask,"\x89PNG\r\n\x1a\n".$chunk('IHDR',pack('NNCCCCC',256,256,8,0,0,0,0)).$chunk('IDAT',gzcompress($rows)).$chunk('IEND',''));
 $savedImages=scanJob($db,$id,$user)['images'];$originalHashes=array_column($savedImages,'hash');
 $maskBody=['id'=>$id,'image'=>$savedImages[0]['id'],'file'=>new CURLFile($mask,'image/png','mask.png'),'reviewed'=>'0'];
 verifyTripo(tripoHttp('scans/mask.php',$seller,$maskBody)['status']===200,'Draft cutout save failed');
 $maskedStart=['id'=>$id,'confirmCloud'=>true,'maxCredits'=>30,'useMasks'=>true];
 verifyTripo(tripoPost('scans/start.php',$seller,$maskedStart)['status']===422,'Unreviewed cutouts accepted for paid generation');
 $maskBody['reviewed']='1';verifyTripo(tripoHttp('scans/mask.php',$seller,$maskBody)['status']===200,'First reviewed cutout save failed');
 verifyTripo(tripoPost('scans/start.php',$seller,$maskedStart)['status']===422,'Partial review accepted for paid generation');
 $maskBody['image']=$savedImages[1]['id'];verifyTripo(tripoHttp('scans/mask.php',$seller,$maskBody)['data']['job']['maskCount']===2,'Second reviewed cutout save failed');
 $start=$maskedStart;$r=tripoPost('scans/start.php',$seller,$start);verifyTripo($r['status']===200 && $r['data']['job']['state']==='queued','Consented queue failed');
 verifyTripo(tripoPost('scans/start.php',$seller,$start)['data']['job']['state']==='queued','Repeated start not idempotent');
 $source=tempnam(sys_get_temp_dir(),'kc-tripo-model-');$temporary[]=$source;tripoFixture($source);tripoPreview($source);
 $paid=0;$uploads=0;$request=function($method,$path,$body=null)use(&$paid,&$uploads){
  if($path==='/account/balance')return ['balance'=>170];
  if($path==='/files'){$uploads++;verifyTripo($body['file'] instanceof CURLFile,'Worker did not upload a real photo');$prepared=imagecreatefrompng($body['file']->getFilename());verifyTripo(((imagecolorat($prepared,0,0)>>24)&127)===127,'Reviewed background not removed before cloud upload');imagedestroy($prepared);return ['file_token'=>'file_'.$uploads];}
  if($path==='/generation/multiview-to-model'){$paid++;verifyTripo($body['face_limit']===49900 && count($body['inputs'])===2 && $body['texture']===true,'Invalid V3 production request');return ['task_id'=>'workflow-fixture'];}
  if($path==='/tasks/workflow-fixture')return ['status'=>'success','progress'=>100,'credits_consumed'=>30,'output'=>['model_url'=>'https://cdn.tripo3d.ai/workflow-fixture.glb']];
  throw new RuntimeException('Unexpected provider request');
 };
 $download=function($url,$target)use($source){verifyTripo($url==='https://cdn.tripo3d.ai/workflow-fixture.glb','Unsafe download request');copy($source,$target);};
 verifyTripo(scanWorkerOnce($db,$request,$download),'Worker did not claim job');$job=scanJob($db,$id,$user);
 verifyTripo($job['state']==='ready' && $paid===1 && $uploads===2,'Worker did not reach validated ready state');verifyTripo(array_column($job['images'],'hash')===$originalHashes,'Background cleanup changed original photo metadata');foreach($job['images'] as $reference)verifyTripo(hash_file('sha256',scanJobDir($id).'/images/'.$reference['file'])===$reference['hash'],'Original reference bytes changed');
 verifyTripo(tripoHttp('scans/asset.php?id='.$id.'&preview=1')['status']===401,'Guest accessed private preview');
 $db->prepare("UPDATE scan_jobs SET state='failed',stage='Processing interrupted' WHERE id=?")->execute([$id]);
 $status=tripoHttp('scans/status.php?id='.$id,$seller)['data']['job'];verifyTripo($status['canRetry']===true && $status['tripoTaskSaved']===true,'Saved task not resumable');
 verifyTripo(tripoPost('scans/start.php',$seller,array_merge($start,['useMasks'=>false]))['status']===409,'Resume changed already submitted photo choice');
 verifyTripo(tripoPost('scans/start.php',$seller,$start)['status']===200,'Resume queue failed');verifyTripo(scanWorkerOnce($db,$request,$download) && $paid===1,'Resume generated again');
 $final=tempnam(sys_get_temp_dir(),'kc-tripo-regions-');$temporary[]=$final;tripoFixture($final,true);scanGlbInfo($final,true);
 $body=['id'=>$id,'file'=>new CURLFile($final,'model/gltf-binary','regions.glb'),'neutralTexture'=>new CURLFile($photo,'image/png','neutral.png'),'thumbnail'=>new CURLFile($photo,'image/png','thumb.png'),'charmPoint'=>'null'];
 verifyTripo(tripoHttp('scans/finalize.php',$admin,$body)['status']===404,'Foreign region finalization allowed');
 $r=tripoHttp('scans/finalize.php',$seller,$body);verifyTripo($r['status']===200 && count($r['data']['draft']['parts'])===2,'Region finalization failed');
 verifyTripo(tripoHttp('scans/finalize.php',$seller,$body)['status']===200,'Finalize retry failed');
 $r=tripoPost('products/create.php',$seller,['source'=>'scan','scanId'=>$id]);verifyTripo($r['status']===201 && $r['data']['shoe']['publicationState']==='draft','Seller draft creation failed');$pid=$r['data']['shoe']['id'];$products[]=$pid;
 verifyTripo(tripoPost('products/create.php',$seller,['source'=>'scan','scanId'=>$id])['data']['shoe']['id']===$pid,'Repeated import duplicated product');
 verifyTripo(!in_array($pid,array_column(tripoHttp('shoes/list.php')['data']['shoes'],'id'),true),'Draft was automatically published');
 $comparison=tripoHttp('products/scan.php?id='.$pid,$admin);verifyTripo($comparison['status']===200 && count($comparison['data']['job']['images'])===2,'Admin source comparison missing');
 verifyTripo(tripoPost('products/save.php',$seller,['id'=>$pid,'name'=>'Tripo workflow verification fixture','description'=>'Synthetic incomplete original KickCraft geometry for local plumbing tests. Not fidelity proof.','price'=>1234,'stock'=>1,'sizes'=>[9]])['status']===200,'Product details save failed');
 verifyTripo(tripoPost('products/submit.php',$seller,['id'=>$pid])['status']===200,'Review submission failed');
 verifyTripo(!in_array($pid,array_column(tripoHttp('shoes/list.php')['data']['shoes'],'id'),true),'Pending product appeared publicly');
 verifyTripo(tripoPost('products/review.php',$admin,['id'=>$pid,'status'=>'approved'])['status']===422,'Approval bypassed photo comparison');
 verifyTripo(tripoPost('products/review.php',$admin,['id'=>$pid,'status'=>'approved','photoReviewed'=>true])['status']===200,'Explicit admin comparison approval failed');
 verifyTripo(in_array($pid,array_column(tripoHttp('shoes/list.php')['data']['shoes'],'id'),true),'Approved fixture not visible');
 $discard=tripoPost('scans/create.php',$seller,['engine'=>'tripo']);verifyTripo($discard['status']===201,'Discard fixture create failed');$discardId=$discard['data']['job']['id'];$jobs[]=$discardId;
 verifyTripo(tripoPost('scans/discard.php',$seller,['id'=>$discardId])['status']===200,'Discard Tripo upload failed');
 verifyTripo(!in_array($discardId,array_column(tripoHttp('scans/list.php',$seller)['data']['jobs'],'id'),true),'Discarded Tripo capture still offered for recovery');
 echo "PASS: $checks Tripo integration checks, one mocked generation; no external calls or credits.\n";
}finally{
 foreach($products as $pid)$db->prepare('UPDATE shoes SET deleted_at=NOW() WHERE id=?')->execute([$pid]);
 foreach($jobs as $id){$db->prepare("UPDATE scan_jobs SET state='failed',stage='Retired Tripo verification' WHERE id=?")->execute([$id]);foreach(['/models/uploads/scan-'.$id.'.glb','/images/uploads/scan-'.$id.'-neutral.png','/images/uploads/scan-'.$id.'-thumb.png'] as $asset){$path=dirname(__DIR__).'/public'.$asset;if(is_file($path))unlink($path);}}
 foreach($users as $id)$db->prepare('UPDATE users SET deleted_at=NOW() WHERE id=?')->execute([$id]);
 foreach($temporary as $file)if(is_file($file))unlink($file);
 $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);
}
