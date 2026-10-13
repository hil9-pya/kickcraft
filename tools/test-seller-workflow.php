<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../api/scans/common.php';
session_write_close();
if(configValue('DB_NAME')!=='kickcraft_photo_scan_dev') throw new RuntimeException('Isolated scan database required');
$options=getopt('', ['base:','scan:']);$base=rtrim($options['base']??'http://localhost:5174/api','/');
if(!in_array(parse_url($base,PHP_URL_HOST),['localhost','127.0.0.1'],true))throw new RuntimeException('Test target must be localhost');
$db=getDb();$ids=[];$products=[];$receipts=[];$jobs=[];$checks=0;
function check($ok,string $message): void {global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function req(string $path,string $cookie='', $body=null,array $headers=[]): array {
 global $base;$h=curl_init($base.'/'.$path);$all=array_filter($headers,fn($h)=>str_starts_with(strtolower($h),'x-requested-with:'))?[]:['X-Requested-With: KickCraft'];
 if($body!==null && !is_array($body))$all[]='Content-Type: application/json';
 curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_COOKIE=>$cookie,CURLOPT_HTTPHEADER=>array_merge($all,$headers)]);
 if($body!==null){curl_setopt($h,CURLOPT_POST,true);curl_setopt($h,CURLOPT_POSTFIELDS,is_array($body)?$body:$body);}
 $raw=curl_exec($h);if($raw===false)throw new RuntimeException(curl_error($h));
 $size=curl_getinfo($h,CURLINFO_HEADER_SIZE);$data=json_decode(substr($raw,$size),true);
 preg_match_all('/^Set-Cookie:\s*([^;\r\n]+)/mi',substr($raw,0,$size),$cookies);
 return ['status'=>curl_getinfo($h,CURLINFO_RESPONSE_CODE),'data'=>$data,'cookie'=>end($cookies[1])?:''];
}
function checkoutFixtureId(): string {$hex=bin2hex(random_bytes(16));return substr($hex,0,8).'-'.substr($hex,8,4).'-4'.substr($hex,13,3).'-8'.substr($hex,17,3).'-'.substr($hex,20);}
function post(string $path,string $cookie,array $body,array $headers=[]): array {if($path==='reservations/create.php'&&!array_key_exists('requestId',$body))$body['requestId']=checkoutFixtureId();return req($path,$cookie,json_encode($body),$headers);}
function raceCheckout(array $body,?array $second=null): array {
 global $base;$multi=curl_multi_init();$handles=[];$results=[];
 for($i=0;$i<2;$i++){$payload=$i===1&&$second!==null?$second:$body;if(!isset($payload['requestId']))$payload['requestId']=checkoutFixtureId();$h=curl_init($base.'/reservations/create.php');curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>['X-Requested-With: KickCraft','Content-Type: application/json']]);$handles[]=$h;curl_multi_add_handle($multi,$h);}
 do{curl_multi_exec($multi,$running);if($running)curl_multi_select($multi,1);}while($running);
 foreach($handles as $h){$results[]=['status'=>curl_getinfo($h,CURLINFO_RESPONSE_CODE),'data'=>json_decode(curl_multi_getcontent($h),true)];curl_multi_remove_handle($multi,$h);}curl_multi_close($multi);return $results;
}
function signIn(string $email,string $password): string {$r=post('auth/login.php','',['email'=>$email,'password'=>$password]);check($r['status']===200,'Login failed: '.json_encode($r['data']));return $r['cookie'];}
try {
 $admin=signIn(configValue('KICKCRAFT_OWNER_EMAIL'),configValue('KICKCRAFT_OWNER_PASSWORD'));
 $password=bin2hex(random_bytes(16));$accounts=[];
 foreach([1,2] as $n){
  $email='seller-check-'.bin2hex(random_bytes(5)).'@example.com';
  $form=['name'=>'Seller Verification '.$n,'email'=>$email,'password'=>$password,'confirmPassword'=>$password,'storeName'=>'Verification Studio '.$n,'description'=>'Original shoes for local verification','pickupAddress'=>'Studio '.$n.', Verification Street'];
  $r=post('auth/register.php','',$form);check($r['status']===201,'Registration expected 201, got '.$r['status'].': '.json_encode($r['data']));
  $ids[]=$r['data']['user']['id'];$id=end($ids);$cookie=signIn($email,$password);$accounts[]=['id'=>$id,'cookie'=>$cookie,'form'=>$form];
  check(post('auth/register.php','',$form)['status']===409,'Duplicate account allowed');
  check(req('sellers/profile.php',$cookie)['data']['seller']['status']==='pending','Seller not pending');
  check(post('scans/create.php',$cookie,[],['X-Requested-With: KickCraftScan'])['status']===403,'Pending seller scanning allowed');
  check(req('sellers/list.php',$cookie)['status']===403,'Seller got admin list');
  check(post('sellers/review.php',$cookie,['id'=>$id,'status'=>'approved'])['status']===403,'Seller self-approved');
  check(post('sellers/review.php',$admin,['id'=>$id,'status'=>'approved'])['status']===200,'Admin could not approve');
  check(req('sellers/profile.php',$cookie)['data']['seller']['status']==='approved','Existing session missed approval');
  $hash=$db->prepare('SELECT password_hash FROM users WHERE id=?');$hash->execute([$id]);check(password_verify($password,$hash->fetchColumn()),'Password not securely stored');
 }
 $a=$accounts[0];$b=$accounts[1];
 check(post('auth/register.php','',array_merge($a['form'],['email'=>'invalid']))['status']===422,'Invalid email accepted');
 check(post('auth/register.php','',array_merge($a['form'],['email'=>'bad-pass@example.com','password'=>'short','confirmPassword'=>'short']))['status']===422,'Weak password accepted');
 check(post('auth/register.php','',$a['form'],['Origin: https://untrusted.invalid'])['status']===403,'Untrusted registration accepted');
 check(post('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'suspended','note'=>'Verification suspension'])['status']===200,'Suspend failed');
 check(post('scans/create.php',$a['cookie'],[],['X-Requested-With: KickCraftScan'])['status']===403,'Suspended session kept scanning');
 check(post('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'approved'])['status']===200,'Restore approval failed');
 $upload=req('products/upload.php',$a['cookie'],['file'=>new CURLFile(realpath(__DIR__.'/../public/models/shoe-soleview-final.glb'),'model/gltf-binary','original.glb'),'thumbnail'=>new CURLFile(realpath(__DIR__.'/../public/images/kickcraft-one-card.png'),'image/png','original.png')]);
 check($upload['status']===201,'Multi-material GLB upload failed');$products[]=$upload['data']['shoe']['id'];
 check(count($upload['data']['shoe']['parts'])===8 && $upload['data']['shoe']['charmsEnabled']===false,'Uploaded regions were guessed or unverified charm enabled');
 $listed=req('products/list.php',$a['cookie'])['data']['shoes'];check(count($listed)===1,'Uploaded draft not owned by seller');
 // Synthetic original geometry verifies upload/painting plumbing, not shoe likeness.
 $raw=file_get_contents(__DIR__.'/../public/models/shoe-soleview-final.glb');$length=unpack('V',substr($raw,12,4))[1];$gltf=json_decode(substr($raw,20,$length),true);$bin=substr($raw,28+$length);
 $gltf['materials']=[['pbrMetallicRoughness'=>['baseColorTexture'=>['index'=>0]]]];
 foreach($gltf['meshes'] as &$mesh)foreach($mesh['primitives'] as &$primitive)$primitive['material']=0;unset($mesh,$primitive);
 $saveFixture=function($json)use($bin){$file=tempnam(sys_get_temp_dir(),'kc-upload-');$text=json_encode($json);$text.=str_repeat(' ',(4-strlen($text)%4)%4);file_put_contents($file,'glTF'.pack('VV',2,28+strlen($text)+strlen($bin)).pack('VV',strlen($text),0x4e4f534a).$text.pack('VV',strlen($bin),0x004e4942).$bin);return $file;};
 $singleFile=$saveFixture($gltf);
 try {
  $single=req('products/upload.php',$a['cookie'],['file'=>new CURLFile($singleFile,'model/gltf-binary','single.glb'),'thumbnail'=>new CURLFile(realpath(__DIR__.'/../public/images/kickcraft-one-card.png'),'image/png','thumb.png')]);
  check($single['status']===201,'Single-material GLB upload failed: '.json_encode($single['data']));$single=$single['data']['shoe'];$products[]=$single['id'];
  check($single['parts']===[]&&$single['publicationState']==='draft'&&!$single['charmsEnabled'],'Single surface was treated as an editable whole-shoe part or published');
  $singleUpdate=['id'=>$single['id'],'name'=>'Single upload workflow fixture','description'=>'Synthetic original geometry for local upload and region verification','price'=>100,'stock'=>2,'sizes'=>[9]];
  check(post('products/save.php',$a['cookie'],$singleUpdate)['status']===200,'Unpainted draft details could not save');
  check(post('products/submit.php',$a['cookie'],['id'=>$single['id']])['status']===422,'Unpainted upload submitted for review');
  check(req('products/regions.php?id='.$single['id'],$a['cookie'])['status']===200,'Own raw upload could not open painter');
  check(req('products/regions.php?id='.$single['id'],$b['cookie'])['status']===404,'Foreign seller opened raw upload painter');
  check(req('products/regions.php?id='.$single['id'])['status']===401,'Guest opened raw upload painter');
  $revision=['id'=>$single['id'],'expectedModel'=>$single['glbPath'],'file'=>new CURLFile($singleFile,'model/gltf-binary','regions.glb'),'neutralTexture'=>new CURLFile(realpath(__DIR__.'/../public/images/kickcraft-one-card.png'),'image/png','neutral.png'),'thumbnail'=>new CURLFile(realpath(__DIR__.'/../public/images/kickcraft-one-card.png'),'image/png','thumb.png'),'charmPoint'=>'null'];
  check(req('products/regions.php',$a['cookie'],$revision)['status']===422,'Unpainted save bypassed two-region requirement');
  $gltf['materials']=[['name'=>'KCScan_UpperMaterial','pbrMetallicRoughness'=>['baseColorTexture'=>['index'=>0]]],['name'=>'KCScan_MidsoleMaterial','pbrMetallicRoughness'=>['baseColorTexture'=>['index'=>0]]]];
  $gltf['meshes'][0]['primitives'][0]['material']=1;$paintedFile=$saveFixture($gltf);
  try {
   $revision['file']=new CURLFile($paintedFile,'model/gltf-binary','painted.glb');
   check(req('products/regions.php',$b['cookie'],$revision)['status']===404,'Foreign seller changed uploaded parts');
   $painted=req('products/regions.php',$a['cookie'],$revision);check($painted['status']===200,'Uploaded painted-region save failed: '.json_encode($painted['data']));$painted=$painted['data']['shoe'];
   check(count($painted['parts'])===2&&$painted['publicationState']==='draft'&&$painted['sourceScanId']===null,'Uploaded parts lost or scan ownership invented');
   check(is_file(__DIR__.'/../public'.$single['glbPath']),'Painting overwrote original uploaded model');
   check(req('products/regions.php?id='.$single['id'],$a['cookie'])['status']===200,'Painted upload could not reopen painter');
   check(req('products/regions.php',$a['cookie'],$revision)['status']===409,'Stale uploaded painting overwrote newer model');
   check(!in_array($single['id'],array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Painted upload auto-published');
   check(post('products/submit.php',$a['cookie'],['id'=>$single['id']])['status']===200,'Painted upload could not submit');
   check(post('products/review.php',$a['cookie'],['id'=>$single['id'],'status'=>'approved'])['status']===403,'Seller approved own painted upload');
   check(post('products/review.php',$admin,['id'=>$single['id'],'status'=>'approved'])['status']===200,'Admin could not approve painted upload');
   $revision['expectedModel']=$painted['glbPath'];
   check(req('products/regions.php',$a['cookie'],$revision)['data']['shoe']['publicationState']==='draft','Repainting approved upload did not withdraw listing');
   check(!in_array($single['id'],array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Repainted upload stayed live');
  }finally{unlink($paintedFile);}
 }finally{unlink($singleFile);}
 $r=post('products/create.php',$a['cookie'],['source'=>'template','template'=>'kickcraft-one']);check($r['status']===201,'Template draft creation failed: '.json_encode($r['data']));
 $product=$r['data']['shoe'];$products[]=$product['id'];$pid=$product['id'];
 check($product['sellerUserId']===$a['id'] && $product['publicationState']==='draft','Draft owner/state untrusted');
 check(count($product['parts'])===8,'Original template parts missing');
 check(post('products/create.php',$a['cookie'],['source'=>'template','template'=>'nike-air-max'])['status']===422,'Third-party template allowed');
 check(post('products/create.php',$a['cookie'],['source'=>'scan','scanId'=>'250270ba-ce17-411a-8cf0-b3da60f40963'])['status']===404,'Foreign scan imported');
 check(req('products/scan.php?id='.$pid)['status']===401,'Guest accessed private source review');
 check(req('products/scan.php?id='.$pid,$a['cookie'])['status']===403,'Seller accessed admin source review');
 check(req('products/scan.php?id='.$pid,$admin)['status']===404,'Template reported photographed source');
 check(req('products/list.php',$b['cookie'])['data']['shoes']===[],'Foreign seller products listed');
 $update=['id'=>$pid,'name'=>'Seller verification original','description'=>'Original template used only for integration verification','price'=>1234,'stock'=>1,'sizes'=>[8,9]];
 check(post('products/save.php',$b['cookie'],$update)['status']===404,'Foreign product edited');
 check(post('products/save.php',$a['cookie'],array_merge($update,['glbPath'=>'/models/private.glb']))['status']===422,'Arbitrary model path accepted');
 check(post('products/save.php',$a['cookie'],$update)['status']===200,'Own product save failed');
 $public=req('shoes/list.php')['data']['shoes'];check(!in_array($pid,array_column($public,'id'),true),'Draft visible publicly');
 check(post('products/submit.php',$a['cookie'],['id'=>$pid])['data']['shoe']['publicationState']==='pending','Submit did not queue review');
 check(post('products/review.php',$a['cookie'],['id'=>$pid,'status'=>'approved'])['status']===403,'Seller published own listing');
 check(post('products/review.php',$admin,['id'=>$pid,'status'=>'approved'])['data']['shoe']['publicationState']==='approved','Admin publication failed');
 check(in_array($pid,array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Approved listing not public');
 check(post('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'suspended','note'=>'Verification suspension'])['status']===200,'Suspension failed');
 check(!in_array($pid,array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Suspended listing remained public');
 check(post('products/save.php',$a['cookie'],$update)['status']===403,'Suspended seller edited product');
 check(post('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'approved'])['status']===200,'Approval restore failed');
 check(post('products/save.php',$a['cookie'],$update)['data']['shoe']['publicationState']==='draft','Editing published listing did not withdraw it');
 check(!in_array($pid,array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Edited listing stayed public');
 $scan=post('scans/create.php',$a['cookie'],[],['X-Requested-With: KickCraftScan']);check($scan['status']===201,'Approved seller scan denied');$jobs[]=$scan['data']['job']['id'];
 check(req('scans/status.php?id='.end($jobs),$b['cookie'])['status']===404,'Foreign seller scan visible');
 check(in_array(end($jobs),array_column(req('scans/list.php',$a['cookie'])['data']['jobs'],'id'),true),'Own capture missing from recovery');
 check(!in_array(end($jobs),array_column(req('scans/list.php',$b['cookie'])['data']['jobs'],'id'),true),'Foreign capture exposed in recovery');
 if(isset($options['scan'])) {
  $owner=$db->prepare('SELECT id FROM users WHERE email=?');$owner->execute([configValue('KICKCRAFT_OWNER_EMAIL')]);$source=scanJob($db,scanId($options['scan']),(int)$owner->fetchColumn());
  check($source['state']==='finalized','Scan fixture must be a finalized owner capture');$draft=json_decode($source['finalized_payload'],true)['draft'];$jobId=end($jobs);$dir=scanJobDir($jobId);$sourceDir=scanJobDir($source['id']);
  // Integration fixture reuses a real reconstruction; this does not assert seller capture quality.
  check(copy($sourceDir.'/preview.glb',$dir.'/preview.glb'),'Cannot stage actual preview');$image=$source['images'][0];
  check(copy($sourceDir.'/images/'.$image['file'],$dir.'/images/'.$image['file']),'Cannot stage source photo');
  $db->prepare("UPDATE scan_jobs SET state='ready',output_glb='preview.glb',images=? WHERE id=?")->execute([json_encode([$image]),$jobId]);$project=dirname(__DIR__).'/public';
  $multipart=['id'=>$jobId,'file'=>new CURLFile($project.$draft['glbPath'],'model/gltf-binary','scan.glb'),'neutralTexture'=>new CURLFile($project.$draft['parts'][0]['recolorTexturePath'],'image/png','neutral.png'),'thumbnail'=>new CURLFile($project.$draft['thumbnailPath'],'image/png','thumbnail.png'),'charmPoint'=>'[0.02,0.08,0.01]','charmSettings'=>'{"size":0.75,"rotation":[20,-30,45]}'];
  check(req('scans/finalize.php',$b['cookie'],$multipart,['X-Requested-With: KickCraftScan'])['status']===404,'Foreign seller finalized scan');
  check(req('scans/finalize.php',$a['cookie'],$multipart,['X-Requested-With: KickCraftScan'])['status']===200,'Seller region finalization failed');
  $scanProduct=post('products/create.php',$a['cookie'],['source'=>'scan','scanId'=>$jobId]);check($scanProduct['status']===201,'Owned finalized scan import failed');$scanPid=$scanProduct['data']['shoe']['id'];$products[]=$scanPid;
  check($scanProduct['data']['shoe']['charmsEnabled']&&str_ends_with($scanProduct['data']['shoe']['charmDir'],'-charms/'),'Fitted charms lost during scan import');
  check(post('products/create.php',$a['cookie'],['source'=>'scan','scanId'=>$jobId])['data']['shoe']['id']===$scanPid,'Scan retry duplicated listing');
  check(!in_array($jobId,array_column(req('scans/list.php',$a['cookie'])['data']['jobs'],'id'),true),'Linked scan still offered as an unlinked draft');
  check(req('products/scan.php?id='.$scanPid,$a['cookie'])['status']===403,'Seller accessed admin comparison');
  $reference=req('products/scan.php?id='.$scanPid,$admin);check($reference['status']===200 && count($reference['data']['job']['images'])===1,'Admin source comparison missing');
  check(!isset($reference['data']['job']['draft']) && !isset($reference['data']['job']['images'][0]['maskUrl']),'Admin review exposed unrelated draft assets');
  $asset='products/scan-asset.php?id='.$scanPid.'&image='.$image['id'];check(req($asset)['status']===401,'Guest source photo exposed');check(req($asset,$b['cookie'])['status']===403,'Other seller source photo exposed');check(req($asset,$admin)['status']===200,'Admin could not read linked source photo');
  check(post('products/save.php',$a['cookie'],['id'=>$scanPid,'name'=>'Synthetic scan integration fixture','description'=>'Copied actual reconstruction only for seller API tests, not physical fidelity proof.','price'=>1234,'stock'=>1,'sizes'=>[9]])['status']===200,'Scan details save failed');
  check(post('products/submit.php',$a['cookie'],['id'=>$scanPid])['status']===200,'Scan submission failed');
  check(post('products/review.php',$admin,['id'=>$scanPid,'status'=>'approved'])['status']===422,'Scan published without source comparison');
  check(post('products/review.php',$admin,['id'=>$scanPid,'status'=>'approved','photoReviewed'=>true])['status']===200,'Explicit scan review attestation failed');
  $painting=req('products/regions.php?id='.$scanPid,$a['cookie']);check($painting['status']===200&&$painting['data']['shoe']['publicationState']==='approved','Approved shoe painting unavailable');
  check($painting['data']['charmPoint']===[0.02,0.08,0.01]&&$painting['data']['charmSettings']['size']===0.75&&$painting['data']['charmSettings']['rotation']===[20,-30,45],'Charm fitting did not reopen exactly');
  check(req('products/regions.php?id='.$scanPid,$b['cookie'])['status']===404,'Other seller opened painted parts');
  $oldModel=$painting['data']['shoe']['glbPath'];$oldHash=hash_file('sha256',$project.$oldModel);
  $revision=['id'=>$scanPid,'expectedModel'=>$oldModel,'file'=>$multipart['file'],'neutralTexture'=>$multipart['neutralTexture'],'thumbnail'=>$multipart['thumbnail'],'charmPoint'=>'[0.03,0.07,0.02]','charmSettings'=>'{"size":1.25,"rotation":[-15,60,0]}'];
  check(req('products/regions.php',$b['cookie'],$revision)['status']===404,'Other seller changed painted parts');
  $badFit=$revision;$badFit['charmSettings']='{"size":0,"rotation":[0,0,0]}';check(req('products/regions.php',$a['cookie'],$badFit)['status']===422,'Invalid charm fit accepted');
  $revised=req('products/regions.php',$a['cookie'],$revision);check($revised['status']===200,'Revised part save failed');$revised=$revised['data']['shoe'];
  $reopened=req('products/regions.php?id='.$scanPid,$a['cookie']);check($reopened['data']['charmSettings']['size']===1.25&&$reopened['data']['charmPoint']===[0.03,0.07,0.02],'Revised charm fitting lost on reopen');
  foreach(['star','lightning','k-tag'] as $slug){$bytes=file_get_contents($project.$revised['charmDir'].$slug.'-charm.glb');$json=json_decode(substr($bytes,20,unpack('V',substr($bytes,12,4))[1]),true);$root=array_values(array_filter($json['nodes'],fn($node)=>($node['name']??'')==='CharmRoot'))[0];check($root['translation']===[0.03,0.07,0.02]&&$root['scale']===[1.25,1.25,1.25],'Customer charm asset does not match saved fit');}
  check($revised['publicationState']==='draft'&&$revised['glbPath']!==$oldModel,'Repaint overwrote approved model or stayed published');
  check(hash_file('sha256',$project.$oldModel)===$oldHash,'Old approved model modified');
  check($revised['sourceScanId']===$jobId&&$revised['price']==1234&&$revised['stock']===1,'Repaint changed source, price or stock');
  check(req('products/scan.php?id='.$scanPid,$admin)['status']===200&&req($asset,$admin)['status']===200,'Repaint broke admin source-photo comparison');
  check(req('products/regions.php',$a['cookie'],$revision)['status']===409,'Stale painting overwrote newer model');
  check(!in_array($scanPid,array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Revised unreviewed model appeared publicly');
  check(post('products/submit.php',$a['cookie'],['id'=>$scanPid])['status']===200,'Revised model submission failed');
  check(post('products/review.php',$admin,['id'=>$scanPid,'status'=>'approved'])['status']===422,'Revised model bypassed source-photo review');
  check(post('products/review.php',$admin,['id'=>$scanPid,'status'=>'approved','photoReviewed'=>true])['status']===200,'Revised model approval failed');
  $charmOrder=post('reservations/create.php','',['shoeId'=>$scanPid,'customerName'=>'Charm workflow check','email'=>'charm-check@example.test','pickupDate'=>(new DateTimeImmutable('today'))->modify('+8 days')->format('Y-m-d'),'size'=>9,'charmId'=>'lightning','partColors'=>[]]);
  check($charmOrder['status']===201,'Customer could not reserve fitted charm');$charmReceipt=$charmOrder['data']['reservation']['id'];$receipts[]=$charmReceipt;
  check(post('reservations/lookup.php','',['id'=>$charmReceipt,'email'=>'charm-check@example.test'])['data']['reservation']['charmId']==='lightning','Fitted charm choice lost in tracking');
  check(post('reservations/update-status.php',$a['cookie'],['id'=>$charmReceipt,'status'=>'cancelled','notes'=>'Retire charm verification order'])['status']===200,'Fitted charm reservation could not cancel');
  $db->prepare('UPDATE reservations SET deleted_at=NOW() WHERE id=?')->execute([$charmReceipt]);
  check(post('products/visibility.php',$a['cookie'],['id'=>$scanPid,'action'=>'archive'])['status']===200,'Generated shoe removal failed');
  check(!in_array($jobId,array_column(req('scans/list.php',$a['cookie'])['data']['jobs'],'id'),true),'Removed shoe offered as duplicate capture');
  check(post('products/create.php',$a['cookie'],['source'=>'scan','scanId'=>$jobId])['status']===409,'Removed capture import did not explain restore');
  $restored=post('products/visibility.php',$a['cookie'],['id'=>$scanPid,'action'=>'restore']);check($restored['status']===200&&$restored['data']['shoe']['publicationState']==='draft'&&$restored['data']['shoe']['glbPath']===$revised['glbPath'],'Restored generated shoe lost edited model or bypassed review');
 }
 // Dedicated retry fixture keeps the existing order/stock tests independent.
 $retryProduct=post('products/create.php',$a['cookie'],['source'=>'template','template'=>'kickcraft-one'])['data']['shoe'];$retryPid=$retryProduct['id'];$products[]=$retryPid;
 check(post('products/save.php',$a['cookie'],['id'=>$retryPid,'name'=>'Checkout retry fixture','description'=>'Original template for duplicate-request checks','price'=>1234,'stock'=>2,'sizes'=>[9,10]])['status']===200,'Retry fixture save failed');
 check(post('products/submit.php',$a['cookie'],['id'=>$retryPid])['status']===200,'Retry fixture submit failed');check(post('products/review.php',$admin,['id'=>$retryPid,'status'=>'approved'])['status']===200,'Retry fixture approval failed');
 $retryBody=['requestId'=>checkoutFixtureId(),'shoeId'=>$retryPid,'customerName'=>'Retry Guest','email'=>'checkout-retry@example.test','pickupDate'=>(new DateTimeImmutable('today'))->modify('+8 days')->format('Y-m-d'),'size'=>9,'charmId'=>'none','partColors'=>['upper'=>['name'=>'Ignored label','value'=>'#13ABCD']]];
 $retryResults=raceCheckout($retryBody);$retryStatuses=array_column($retryResults,'status');sort($retryStatuses);check($retryStatuses===[200,201],'Concurrent same-checkout retries did not return saved reservation');
 $retryRid=$retryResults[0]['data']['reservation']['id'];$receipts[]=$retryRid;check($retryRid===$retryResults[1]['data']['reservation']['id'],'Concurrent retries created different receipts');
 $stmt=$db->prepare('SELECT stock FROM shoes WHERE id=?');$stmt->execute([$retryPid]);check((int)$stmt->fetchColumn()===1,'Retry decremented stock more than once');
 $stmt=$db->prepare('SELECT COUNT(*) FROM reservations WHERE checkout_request_id=?');$stmt->execute([$retryBody['requestId']]);check((int)$stmt->fetchColumn()===1,'Retry saved multiple rows');
 $replay=$retryBody;$replay['email']=strtoupper($replay['email']);$replay['partColors']['upper']=['name'=>'Changed label','value'=>'#13abcd'];check(post('reservations/create.php','',$replay)['data']['reservation']['id']===$retryRid,'Equivalent input did not replay saved reservation');
 check(post('reservations/create.php','',array_merge($retryBody,['size'=>10]))['status']===409,'Same request ID accepted changed design');
 check(post('reservations/create.php','',array_merge($retryBody,['email'=>'another@example.test']))['status']===409,'Same request ID exposed another guest reservation');
 foreach([null,[], 'invalid'] as $badId)check(post('reservations/create.php','',array_merge($retryBody,['requestId'=>$badId]))['status']===400,'Invalid request ID passed');
 $otherRetry=post('products/create.php',$a['cookie'],['source'=>'template','template'=>'kickcraft-one'])['data']['shoe'];$otherRetryPid=$otherRetry['id'];$products[]=$otherRetryPid;
 check(post('products/save.php',$a['cookie'],['id'=>$otherRetryPid,'name'=>'Other checkout retry fixture','description'=>'Original template for conflicting request checks','price'=>1234,'stock'=>1,'sizes'=>[9]])['status']===200,'Other retry fixture save failed');
 check(post('products/submit.php',$a['cookie'],['id'=>$otherRetryPid])['status']===200&&post('products/review.php',$admin,['id'=>$otherRetryPid,'status'=>'approved'])['status']===200,'Other retry fixture review failed');
 $crossBody=array_merge($retryBody,['requestId'=>checkoutFixtureId()]);$crossOther=array_merge($crossBody,['shoeId'=>$otherRetryPid]);$crossResults=raceCheckout($crossBody,$crossOther);$crossStatuses=array_column($crossResults,'status');sort($crossStatuses);check($crossStatuses===[201,409],'Same ID with different products did not resolve safely');
 foreach($crossResults as $result)if($result['status']===201){$crossRid=$result['data']['reservation']['id'];$receipts[]=$crossRid;$db->prepare('UPDATE reservations SET deleted_at=NOW() WHERE id=?')->execute([$crossRid]);}
 $stmt=$db->prepare('SELECT SUM(stock) FROM shoes WHERE id IN (?,?)');$stmt->execute([$retryPid,$otherRetryPid]);check((int)$stmt->fetchColumn()===1,'Conflicting retry decremented both products');
 $db->prepare("UPDATE shoes SET stock=0,status='out_of_stock',publication_state='draft',deleted_at=NOW() WHERE id=?")->execute([$retryPid]);
 $afterRemoval=post('reservations/create.php','',$retryBody);check($afterRemoval['status']===200&&$afterRemoval['data']['reservation']['id']===$retryRid,'Lost-response retry failed after stock or publication changed');
 $stmt=$db->prepare('SELECT stock FROM shoes WHERE id=?');$stmt->execute([$retryPid]);check((int)$stmt->fetchColumn()===0,'Replay touched unavailable stock');
 $retryBody['pickupDate']=(new DateTimeImmutable('today'))->modify('+2 days')->format('Y-m-d');$oldHash=hash('sha256',json_encode([$retryBody['customerName'],$retryBody['email'],$retryBody['pickupDate'],$retryPid,9,'none',['upper'=>'#13abcd']],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES));
 $db->prepare('UPDATE reservations SET pickup_date=?,checkout_request_hash=? WHERE id=?')->execute([$retryBody['pickupDate'],$oldHash,$retryRid]);check(post('reservations/create.php','',$retryBody)['data']['reservation']['id']===$retryRid,'Historical retry incorrectly reapplied new-booking date window');
 $db->prepare('UPDATE reservations SET deleted_at=NOW() WHERE id=?')->execute([$retryRid]);check(post('reservations/create.php','',$retryBody)['status']===409,'Removed reservation was silently recreated');
 $pickup=(new DateTimeImmutable('today'))->modify('+8 days')->format('Y-m-d');
 $checkout=['shoeId'=>$pid,'customerName'=>'Guest Verification','email'=>'guest-verification@example.com','pickupDate'=>$pickup,'size'=>8,'charmId'=>'none','partColors'=>['upper'=>['name'=>'Injected label','value'=>'#ffffff']],'price'=>1,'sellerUserId'=>$b['id']];
 foreach(['customerName','email','pickupDate','shoeId','charmId'] as $field){$invalid=post('reservations/create.php','',array_merge($checkout,[$field=>['invalid']]));check($invalid['status']===400 && is_array($invalid['data']),'Malformed checkout '.$field.' broke JSON or passed validation');}
 check(post('reservations/create.php','',array_merge($checkout,['customerName'=>str_repeat('x',256)]))['status']===400,'Oversized guest name accepted');
 foreach(['id','status','notes'] as $field){$invalid=post('reservations/update-status.php',$a['cookie'],array_merge(['id'=>'invalid','status'=>'approved'],[$field=>['invalid']]));check($invalid['status']===400 && is_array($invalid['data']),'Malformed fulfillment '.$field.' broke JSON or passed validation');}
 check(post('reservations/create.php','',$checkout)['status']===400,'Draft accepted checkout');
 check(post('products/submit.php',$a['cookie'],['id'=>$pid])['status']===200,'Resubmit failed');
 check(post('products/review.php',$admin,['id'=>$pid,'status'=>'approved'])['status']===200,'Reapproval failed');
 check(post('products/visibility.php','',['id'=>$pid,'action'=>'archive'])['status']===401,'Guest removed seller product');
 check(post('products/visibility.php',$b['cookie'],['id'=>$pid,'action'=>'archive'])['status']===404,'Foreign seller removed product');
 check(post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'hard'])['status']===422,'Permanent deletion accepted');
 check(post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'archive'],['Origin: https://untrusted.invalid'])['status']===403,'Untrusted product removal accepted');
 $hidden=post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'unpublish']);check($hidden['status']===200&&$hidden['data']['shoe']['publicationState']==='draft','Unpublish did not create private draft');
 check($hidden['data']['shoe']['stock']===1&&$hidden['data']['shoe']['price']==1234,'Unpublish changed stock or price');
 check(!in_array($pid,array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Unpublished product stayed public');
 check(post('reservations/create.php','',$checkout)['status']===400,'Unpublished product accepted checkout');
 check(post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'unpublish'])['status']===200,'Repeated unpublish failed');
 check(post('products/submit.php',$a['cookie'],['id'=>$pid])['status']===200,'Unpublished draft resubmission failed');
 check(post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'unpublish'])['status']===200,'Pending review cancellation failed');
 check(post('products/review.php',$admin,['id'=>$pid,'status'=>'approved'])['status']===409,'Cancelled review still approved');
 check(post('products/submit.php',$a['cookie'],['id'=>$pid])['status']===200,'Draft resubmission failed after review cancellation');
 check(post('products/review.php',$admin,['id'=>$pid,'status'=>'approved'])['status']===200,'Unpublished shoe reapproval failed');
 check(post('reservations/create.php','',array_merge($checkout,['size'=>10]))['status']===400,'Unavailable size reserved');
 foreach(['#fff','#12345678','red','url(javascript:bad)',['#13abcd']] as $invalidColor)check(post('reservations/create.php','',array_merge($checkout,['partColors'=>['upper'=>['value'=>$invalidColor]]]))['status']===400,'Invalid custom RGB value accepted');
 check(post('reservations/create.php','',array_merge($checkout,['partColors'=>['unknown-part'=>['value'=>'#13abcd']]]))['status']===400,'Custom picker bypassed part validation');
 $race=raceCheckout($checkout);$statuses=array_column($race,'status');sort($statuses);check($statuses===[201,400],'Concurrent last-pair checkout oversold or failed');$r=$race[0]['status']===201?$race[0]:$race[1];check($r['status']===201,'Guest checkout failed: '.json_encode($r['data']));$reservation=$r['data']['reservation'];$rid=$reservation['id'];$receipts[]=$rid;
 check($reservation['price']==1234 && $reservation['sellerUserId']===$a['id'],'Checkout trusted browser price or owner');
 check($reservation['pickupStore']===$a['form']['storeName'] && $reservation['pickupAddress']===$a['form']['pickupAddress'],'Pickup snapshots missing');
 check($reservation['partColors']['upper']['name']==='White','Browser color label trusted');
 check(post('reservations/create.php','',$checkout)['status']===400,'Last pair oversold');
 check(post('products/save.php',$a['cookie'],array_merge($update,['expectedStock'=>1]))['status']===409,'Stale editor overwrote reserved stock');
 check(post('reservations/update-status.php',$a['cookie'],['id'=>$rid,'status'=>'cancelled','notes'=>''])['status']===422,'Cancellation reason missing');
 $removed=post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'archive']);check($removed['status']===200&&$removed['data']['shoe']['deletedAt']!==null&&!$removed['data']['shoe']['permanentlyDeleted'],'Remove was not recoverable');
 check(post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'archive'])['status']===200,'Repeated removal failed');
 check(!in_array($pid,array_column(req('products/list.php',$a['cookie'])['data']['shoes'],'id'),true),'Removed shoe stayed in active products');
 check(in_array($pid,array_column(req('products/list.php?include_archived=1',$a['cookie'])['data']['shoes'],'id'),true),'Removed shoe missing from seller archive');
 check(!in_array($pid,array_column(req('products/list.php?include_archived=1',$b['cookie'])['data']['shoes'],'id'),true),'Foreign seller read removed product');
 check(post('products/visibility.php',$b['cookie'],['id'=>$pid,'action'=>'restore'])['status']===404,'Foreign seller restored product');
 check(post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'unpublish'])['status']===409,'Archived product unpublish bypassed restore');
 check(post('reservations/lookup.php','',['id'=>$rid,'email'=>$checkout['email']])['data']['reservation']['id']===$rid,'Removal lost customer pickup tracking');
 check(req('sellers/orders.php',$b['cookie'])['data']['reservations']===[],'Foreign orders listed');
 check(post('reservations/update-status.php',$b['cookie'],['id'=>$rid,'status'=>'approved'])['status']===404,'Foreign order fulfilled');
 check(post('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'suspended','note'=>'Verification existing-session revocation'])['status']===200,'Suspend with orders failed');
 check(post('reservations/update-status.php',$a['cookie'],['id'=>$rid,'status'=>'approved'])['status']===403,'Suspended session fulfilled an order');
 check(post('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'approved'])['status']===200,'Restore fulfillment permission failed');
 check(post('reservations/update-status.php',$a['cookie'],['id'=>$rid,'status'=>'ready'])['status']===409,'Order skipped confirmation');
 check(post('reservations/update-status.php',$a['cookie'],['id'=>$rid,'status'=>'cancelled','notes'=>'Verification cancellation'])['status']===200,'Seller cancellation failed');
 check(post('reservations/update-status.php',$a['cookie'],['id'=>$rid,'status'=>'cancelled'])['status']===200,'Cancellation retry failed');
 $stock=$db->prepare('SELECT stock FROM shoes WHERE id=?');$stock->execute([$pid]);check((int)$stock->fetchColumn()===1,'Cancellation restored stock more than once');
 check(!in_array($pid,array_column(req('shoes/list.php')['data']['shoes'],'id'),true),'Cancellation republished removed product');
 $restored=post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'restore']);check($restored['status']===200&&$restored['data']['shoe']['publicationState']==='draft'&&$restored['data']['shoe']['deletedAt']===null&&$restored['data']['shoe']['stock']===1,'Restore lost stock or bypassed review');
 check(post('reservations/create.php','',$checkout)['status']===400,'Restored private shoe accepted checkout');
 check(post('products/submit.php',$a['cookie'],['id'=>$pid])['status']===200,'Restored shoe resubmission failed');
 check(post('products/review.php',$admin,['id'=>$pid,'status'=>'approved'])['status']===200,'Restored shoe reapproval failed');
 check(post('products/visibility.php',$a['cookie'],['id'=>$pid,'action'=>'restore'])['data']['shoe']['publicationState']==='approved','Repeated restore withdrew already active shoe');
 $customCheckout=array_merge($checkout,['partColors'=>['upper'=>['name'=>'Untrusted label','value'=>'#13ABCD'],'laces'=>['name'=>'Untrusted label','value'=>'#AABBCC']]]);
 $r=post('reservations/create.php','',$customCheckout);check($r['status']===201,'Custom color checkout failed');$rid2=$r['data']['reservation']['id'];$receipts[]=$rid2;
 $expectedColors=['upper'=>['name'=>'Custom #13ABCD','value'=>'#13abcd'],'laces'=>['name'=>'Custom #AABBCC','value'=>'#aabbcc']];
 check($r['data']['reservation']['partColors']===$expectedColors,'Custom colors or server-derived labels changed');
 $savedColors=$db->prepare('SELECT part_colors FROM reservations WHERE id=?');$savedColors->execute([$rid2]);check(json_decode($savedColors->fetchColumn(),true)===$expectedColors,'Custom colors not persisted in MySQL');
 check(post('reservations/lookup.php','',['id'=>$rid2,'email'=>$checkout['email']])['data']['reservation']['partColors']===$expectedColors,'Guest tracking lost custom colors');
 $sellerOrders=req('sellers/orders.php',$a['cookie'])['data']['reservations'];$savedOrder=array_values(array_filter($sellerOrders,fn($order)=>$order['id']===$rid2))[0];check($savedOrder['partColors']===$expectedColors,'Seller order lost custom colors');
 $adminOrders=req('reservations/list.php?search='.rawurlencode($rid2),$admin)['data']['reservations'];check($adminOrders[0]['partColors']===$expectedColors,'Admin order lost custom colors');
 foreach(['approved','ready','completed'] as $state)check(post('reservations/update-status.php',$a['cookie'],['id'=>$rid2,'status'=>$state])['status']===200,'Seller fulfillment failed: '.$state);
 check(post('reservations/update-status.php',$a['cookie'],['id'=>$rid2,'status'=>'cancelled'])['status']===409,'Completed order reopened');
 $orders=req('sellers/orders.php',$a['cookie'])['data']['reservations'];check(count($orders)===2,'Seller own orders missing');
 check(post('sellers/update-profile.php',$a['cookie'],['storeName'=>'Changed verification studio','description'=>'New details','pickupAddress'=>'Changed pickup address'])['data']['seller']['status']==='pending','Address change did not require review');
 $saved=$db->prepare('SELECT pickup_store,pickup_address FROM reservations WHERE id=?');$saved->execute([$rid2]);$snapshot=$saved->fetch();check($snapshot['pickup_store']===$a['form']['storeName'] && $snapshot['pickup_address']===$a['form']['pickupAddress'],'Store edit changed old receipt');
 check(post('sellers/review.php',$admin,['id'=>$b['id'],'status'=>'rejected'])['status']===422,'Rejection without explanation accepted');
 check(post('sellers/review.php',$admin,['id'=>$b['id'],'status'=>'rejected','note'=>'Clarify pickup directions'])['status']===200,'Request changes failed');
 check(post('sellers/update-profile.php',$b['cookie'],$b['form'])['data']['seller']['status']==='pending','Corrected application did not return to pending');
 check(post('products/create.php',$b['cookie'],['source'=>'template','template'=>'kickcraft-one'])['status']===403,'Resubmitted pending store unlocked products');
 check(post('sellers/review.php',$admin,['id'=>$b['id'],'status'=>'approved'])['status']===200,'Corrected store approval failed');
 check(post('sellers/update-profile.php',$b['cookie'],['tutorialStep'=>3])['data']['seller']['tutorialStep']===3,'Walkthrough progress was not saved');
 check(req('sellers/profile.php',$b['cookie'])['data']['seller']['tutorialStep']===3,'Walkthrough progress did not persist');
 echo "PASS: $checks seller workflow checks\n";
} finally {
 foreach($jobs as $id)$db->prepare("UPDATE scan_jobs SET state='failed',stage='Retired verification' WHERE id=? AND state NOT IN ('queued','processing')")->execute([$id]);
 foreach($products as $id){$db->prepare('UPDATE shoes SET deleted_at=NOW() WHERE id=?')->execute([$id]);$db->prepare('UPDATE reservations SET deleted_at=NOW() WHERE shoe_id=?')->execute([$id]);}
 foreach($receipts as $id)$db->prepare('UPDATE reservations SET deleted_at=NOW() WHERE id=?')->execute([$id]);
 foreach($ids as $id)$db->prepare('UPDATE users SET deleted_at=NOW() WHERE id=?')->execute([$id]);
}
