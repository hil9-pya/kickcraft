<?php
// Local integration check. Uses only the explicitly isolated photo-scanning database.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../api/scans/common.php';
session_write_close();
if (configValue('DB_NAME') !== 'kickcraft_photo_scan_dev') throw new RuntimeException('Use kickcraft_photo_scan_dev only');
$options=getopt('', ['base:','scan:']);
$base=rtrim($options['base'] ?? 'http://localhost:5174/api','/');
$host=parse_url($base,PHP_URL_HOST);
if (!in_array($host,['localhost','127.0.0.1'],true)) throw new RuntimeException('Test target must be localhost');
$db=getDb(); $jobs=[]; $users=[]; $temporary=[]; $createdShoes=[];
$integrationLock='kickcraft-scan-'.substr(hash('sha256',configValue('DB_NAME')),0,32);
$lockCheck=$db->prepare('SELECT GET_LOCK(?,5)');$lockCheck->execute([$integrationLock]);
if((int)$lockCheck->fetchColumn()!==1) throw new RuntimeException('Wait for active reconstruction before running capture API verification');

function verify(bool $condition,string $message): void {if (!$condition) throw new RuntimeException($message);}
function httpHandle(string $endpoint,string $cookie='', $body=null,array $extra=[]): CurlHandle {
    global $base;
    $headers=['X-Requested-With: KickCraftScan'];
    if ($body!==null && !is_array($body)) $headers[]='Content-Type: application/json';
    $handle=curl_init($base.'/'.$endpoint);
    curl_setopt_array($handle,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_COOKIE=>$cookie,CURLOPT_HTTPHEADER=>array_merge($headers,$extra)]);
    if ($body!==null) {curl_setopt($handle,CURLOPT_POST,true);curl_setopt($handle,CURLOPT_POSTFIELDS,$body);}
    return $handle;
}
function response(CurlHandle $handle,string $raw): array {
    $headers=substr($raw,0,curl_getinfo($handle,CURLINFO_HEADER_SIZE));
    $body=substr($raw,curl_getinfo($handle,CURLINFO_HEADER_SIZE));
    $json=json_decode($body,true);
    verify(is_array($json),'Invalid API JSON: '.substr($body,0,150));
    preg_match_all('/^Set-Cookie:\s*([^;\r\n]+)/mi',$headers,$cookies);
    return ['status'=>curl_getinfo($handle,CURLINFO_RESPONSE_CODE),'data'=>$json,'cookie'=>end($cookies[1]) ?: ''];
}
function request(string $endpoint,string $cookie='', $body=null,array $extra=[]): array {
    $handle=httpHandle($endpoint,$cookie,$body,$extra);$raw=curl_exec($handle);
    verify($raw!==false,curl_error($handle));return response($handle,$raw);
}
function login(string $email,string $password): string {
    $result=request('auth/login.php','',json_encode(['email'=>$email,'password'=>$password]));
    verify($result['status']===200,'Login failed');return $result['cookie'];
}
function newJob(string $cookie): string {
    global $jobs;
    $result=request('scans/create.php',$cookie,'{}');verify($result['status']===201,'Create failed');
    $jobs[]=$result['data']['job']['id'];return end($jobs);
}
function pngChunk(string $type,string $data): string { return pack('N',strlen($data)).$type.$data.hash('crc32b',$type.$data,true); }
function maskFixture(): string {
    global $temporary;
    $path=tempnam(sys_get_temp_dir(),'kc-scan-mask-');
    file_put_contents($path,"\x89PNG\r\n\x1a\n".pngChunk('IHDR',pack('NNCCCCC',2,2,8,0,0,0,0)).pngChunk('IDAT',gzcompress("\0\0\xff\0\xff\0")).pngChunk('IEND',''));
    $temporary[]=$path; return $path;
}
function photo(int $number): string {
    global $temporary;
    $png="\x89PNG\r\n\x1a\n".pngChunk('IHDR',pack('NNCCCCC',2,2,8,0,0,0,0)).pngChunk('IDAT',gzcompress("\0\0\xff\0\xff\0")).pngChunk('IEND','');
    $chunk='tEXt'."fixture\0".$number;
    $png=substr($png,0,33).pack('N',strlen($chunk)-4).$chunk.hash('crc32b',$chunk,true).substr($png,33);
    $path=tempnam(sys_get_temp_dir(),'kc-scan-photo-');file_put_contents($path,$png);$temporary[]=$path;return $path;
}
function uploads(string $id,string $cookie,int $start,int $count): array {
    $multi=curl_multi_init();$handles=[];
    for($i=$start;$i<$start+$count;$i++) {
        $handle=httpHandle('scans/upload.php',$cookie,['id'=>$id,'file'=>new CURLFile(photo($i),'image/png','fixture-'.$i.'.png')]);
        $handles[]=$handle;curl_multi_add_handle($multi,$handle);
    }
    do {curl_multi_exec($multi,$running);if($running)curl_multi_select($multi,1);} while($running);
    $results=[];
    foreach($handles as $handle) {$results[]=response($handle,curl_multi_getcontent($handle));curl_multi_remove_handle($multi,$handle);}
    curl_multi_close($multi);return $results;
}
try {
    $cookie=login(configValue('KICKCRAFT_OWNER_EMAIL'),configValue('KICKCRAFT_OWNER_PASSWORD'));
    verify(request('scans/create.php','','{}')['status']===401,'Unauthenticated scan allowed');
    verify(request('scans/create.php',$cookie,'{}',['Origin: https://untrusted.invalid'])['status']===403,'Cross-origin scan allowed');
    verify(request('scans/start.php',$cookie,'{broken')['status']===400,'Malformed JSON accepted');
    $password=bin2hex(random_bytes(16));$otherCookie='';
    foreach(['owner'] as $role) {
        $email='scan-test-'.bin2hex(random_bytes(5)).'@example.com';
        $db->prepare('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)')->execute(['Scanner verification',$email,password_hash($password,PASSWORD_BCRYPT),$role]);
        $users[]=$db->lastInsertId();$session=login($email,$password);
        $otherCookie=$session;
    }
    verify(request('scans/create.php',$otherCookie,'{"engine":"unknown"}')['status']===400,'Unknown engine accepted');
    $native=request('scans/create.php',$otherCookie,'{"engine":"realityscan"}');
    if ($native['status']===201) {
        $nativeId=$native['data']['job']['id'];$jobs[]=$nativeId;
        $box=fn($type,$data)=>pack('N',strlen($data)+8).$type.$data;
        $tkhd=str_repeat("\0",76).pack('NN',768*65536,768*65536);
        $mdhd=str_repeat("\0",12).pack('NN',1000,48000).str_repeat("\0",4);
        $hdlr=str_repeat("\0",8).'vide'.str_repeat("\0",12);
        $videoBytes=$box('ftyp',"mp42\0\0\0\0mp42isom").$box('moov',$box('trak',$box('tkhd',$tkhd).$box('mdia',$box('mdhd',$mdhd).$box('hdlr',$hdlr)))).$box('mdat',str_repeat("\0",20));
        $chunk=tempnam(sys_get_temp_dir(),'kc-video-');$temporary[]=$chunk;file_put_contents($chunk,substr($videoBytes,0,32));
        $payload=['id'=>$nativeId,'key'=>str_repeat('a',64),'name'=>'capture.mp4','offset'=>'0','total'=>(string)strlen($videoBytes),'file'=>new CURLFile($chunk,'application/octet-stream','chunk.bin')];
        verify(request('scans/video.php','',$payload)['status']===401,'Guest video upload accepted');
        verify(request('scans/video.php',$cookie,$payload)['status']===404,'Another owner uploaded a video');
        verify(request('scans/video.php',$otherCookie,$payload,['Origin: https://untrusted.invalid'])['status']===403,'Cross-origin video accepted');
        $first=request('scans/video.php',$otherCookie,$payload);verify($first['status']===200 && $first['data']['job']['video']['received']===32,'Video chunk did not save');
        verify(!isset($first['data']['job']['video']['file'],$first['data']['job']['video']['sha256']),'Private video details leaked');
        verify(request('scans/video.php',$otherCookie,$payload)['data']['job']['video']['received']===32,'Video retry appended duplicate bytes');
        file_put_contents($chunk,str_repeat('X',32));verify(request('scans/video.php',$otherCookie,$payload)['status']===409,'Changed retry accepted');
        $payload['offset']='33';verify(request('scans/video.php',$otherCookie,$payload)['status']===409,'Video gap accepted');
        $payload['offset']='32';file_put_contents($chunk,substr($videoBytes,32));
        $queued=request('scans/video.php',$otherCookie,$payload);verify($queued['status']===200 && $queued['data']['job']['state']==='queued','Complete video did not queue native preparation');
        verify(request('scans/upload.php',$otherCookie,['id'=>$nativeId,'file'=>new CURLFile(photo(999),'image/png','photo.png')])['status']===409,'Photo appended to native video scan');
        echo "Native video API passed: ownership, origin, resumable chunks, conflicting retry, gaps, metadata, private response, preparation queue.\n";
    } else verify($native['status']===503,'Missing native runtime did not fail clearly');
    for($capture=0;$capture<12;$capture++) {
        $discardId=newJob($otherCookie);
        if($capture%2) $db->prepare("UPDATE scan_jobs SET state='ready' WHERE id=?")->execute([$discardId]);
        verify(request('scans/discard.php',$cookie,json_encode(['id'=>$discardId]))['status']===404,'Another owner discarded private scan');
        verify(request('scans/discard.php',$otherCookie,json_encode(['id'=>$discardId]))['data']['job']['state']==='failed','Discard did not retire capture');
        verify(request('scans/discard.php',$otherCookie,json_encode(['id'=>$discardId]))['status']===200,'Discard retry was not idempotent');
    }
    foreach(['queued','processing'] as $activeState) {
        $activeId=newJob($otherCookie);
        $db->prepare('UPDATE scan_jobs SET state=? WHERE id=?')->execute([$activeState,$activeId]);
        verify(request('scans/discard.php',$otherCookie,json_encode(['id'=>$activeId]))['status']===409,'Active reconstruction was discarded');
        $db->prepare("UPDATE scan_jobs SET state='failed' WHERE id=?")->execute([$activeId]);
    }
    $id=newJob($cookie);
    verify(request('scans/status.php?id='.$id,$otherCookie)['status']===404,'Another owner read private scan');
    verify(request('scans/asset.php?id='.$id.'&preview=1',$otherCookie)['status']===404,'Another owner read private asset');
    $db->prepare("UPDATE users SET role='customer' WHERE id=?")->execute([$users[0]]);
    verify(request('scans/create.php',$otherCookie,'{}')['status']===401,'Revoked owner retained scan access');
    verify(request('scans/status.php?id=../outside',$cookie)['status']===400,'Traversal accepted');
    foreach(uploads($id,$cookie,0,29) as $result)verify($result['status']===200,'Photo upload failed');
    verify(request('scans/start.php',$cookie,json_encode(['id'=>$id]))['status']===422,'29 photos accepted');
    verify(uploads($id,$cookie,29,1)[0]['status']===200,'30th photo rejected');
    verify(uploads($id,$cookie,29,1)[0]['data']['job']['imageCount']===30,'Duplicate photo counted twice');
    verify(request('scans/start.php',$cookie,json_encode(['id'=>$id]))['status']===422,'Unmasked capture queued');
    $images=request('scans/status.php?id='.$id,$cookie)['data']['job']['images']; $mask=maskFixture();
    $payload=['id'=>$id,'image'=>$images[0]['id'],'file'=>new CURLFile($mask,'image/png','mask.png'),'reviewed'=>'1'];
    verify(request('scans/mask.php','',$payload)['status']===401,'Unauthenticated mask upload allowed');
    // Other owner role was revoked above; restore only this disposable test account.
    $db->prepare("UPDATE users SET role='owner' WHERE id=?")->execute([$users[0]]);
    $stmt=$db->prepare('SELECT email FROM users WHERE id=?');$stmt->execute([$users[0]]);$otherCookie=login($stmt->fetchColumn(),$password);
    verify(request('scans/mask.php',$otherCookie,$payload)['status']===404,'Another owner changed a mask');
    verify(request('scans/asset.php?id='.$id.'&mask='.$images[0]['id'],$otherCookie)['status']===404,'Another owner read a mask');
    if (is_file((string)configValue('REALITYSCAN_EXE'))) {
        verify(request('scans/ai-masks.php','',json_encode(['id'=>$id]))['status']===401,'Guest AI masking accepted');
        verify(request('scans/ai-masks.php',$otherCookie,json_encode(['id'=>$id]))['status']===404,'Cross-owner AI masking accepted');
        verify(request('scans/ai-masks.php',$cookie,json_encode(['id'=>$id]),['Origin: https://untrusted.invalid'])['status']===403,'Cross-origin AI masking accepted');
        verify(request('scans/mask.php',$cookie,$payload)['data']['job']['maskCount']===1,'Reviewed-mask setup failed');
        $ai=request('scans/ai-masks.php',$cookie,json_encode(['id'=>$id]));
        verify($ai['status']===200 && $ai['data']['job']['state']==='queued' && $ai['data']['job']['engine']==='meshroom' && $ai['data']['job']['maskCount']===1,'AI queue replaced engine or reviewed mask');
        verify(request('scans/ai-masks.php',$cookie,json_encode(['id'=>$id]))['data']['job']['state']==='queued','AI queue retry was not idempotent');
        verify(request('scans/mask.php',$cookie,$payload)['status']===409,'AI queued masks remained mutable');
        $db->prepare("UPDATE scan_jobs SET state='uploading',operation='reconstruct' WHERE id=?")->execute([$id]);
        echo "AI mask API passed: authentication, ownership, origin, preserved review, engine, retry, mutation gate.\n";
    }
    $payload['reviewed']='0';
    verify(request('scans/mask.php',$cookie,$payload)['data']['job']['maskCount']===0,'Generated mask counted as reviewed');
    verify(request('scans/start.php',$cookie,json_encode(['id'=>$id]))['status']===422,'Unreviewed masks queued');
    foreach($images as $image) {
        $payload['image']=$image['id'];$payload['reviewed']='1';
        verify(request('scans/mask.php',$cookie,$payload)['status']===200,'Reviewed mask rejected');
    }
    verify(request('scans/status.php?id='.$id,$cookie)['data']['job']['maskCount']===30,'Reviewed mask count is incorrect');
    verify(request('scans/ai-masks.php',$cookie,json_encode(['id'=>$id]))['status']===422,'AI overwrote already reviewed masks');
    verify(request('scans/start.php',$cookie,json_encode(['id'=>$id]))['data']['job']['state']==='queued','30 photos did not queue');
    verify(request('scans/mask.php',$cookie,$payload)['status']===409,'Queued mask remained mutable');
    verify(request('scans/start.php',$cookie,json_encode(['id'=>$id]))['data']['job']['state']==='queued','Queue retry restarted scan');
    verify(uploads($id,$cookie,30,1)[0]['status']===409,'Queued job accepted upload');
    $db->prepare("UPDATE scan_jobs SET state='failed',stage='Verification fixture completed' WHERE id=?")->execute([$id]);
    $retryId=newJob($cookie);
    foreach(uploads($retryId,$cookie,300,61) as $result)verify($result['status']===200,'Retry fixture upload failed');
    $stmt=$db->prepare('SELECT owner_id FROM scan_jobs WHERE id=?');$stmt->execute([$retryId]);$retryJob=scanJob($db,$retryId,(int)$stmt->fetchColumn());
    foreach($retryJob['images'] as $image) {
        verify(request('scans/mask.php',$cookie,['id'=>$retryId,'image'=>$image['id'],'file'=>new CURLFile($mask,'image/png','mask.png'),'reviewed'=>'1'])['status']===200,'Retry fixture mask failed');
    }
    $retryOwner=(int)$retryJob['owner_id'];$retryJob=scanJob($db,$retryId,$retryOwner);
    $originalImages=$retryJob['images'];$originalHashes=[];
    foreach($originalImages as $image)foreach(['images/'.$image['file'],'masks/'.$image['maskFile']] as $file)$originalHashes[$file]=hash_file('sha256',scanJobDir($retryId).'/'.$file);
    $failRetry=function() use($db,$retryId){$db->prepare("UPDATE scan_jobs SET state='failed',operation='reconstruct',stage='Reconstruction failed',error_message='Only 41 of 61 photos aligned.' WHERE id=?")->execute([$retryId]);};
    $retryBody=json_encode(['id'=>$retryId,'experimental'=>true]);
    verify(request('scans/start.php',$cookie,$retryBody)['status']===422,'Experimental mode accepted on a new capture');
    $retryEngine=is_file((string)configValue('REALITYSCAN_EXE'))?'realityscan':'meshroom';
    $db->prepare('UPDATE scan_jobs SET engine=? WHERE id=?')->execute([$retryEngine,$retryId]);$failRetry();
    verify(request('scans/start.php','',$retryBody)['status']===401,'Guest retry accepted');
    verify(request('scans/start.php',$otherCookie,$retryBody)['status']===404,'Cross-owner retry accepted');
    verify(request('scans/start.php',$cookie,$retryBody,['Origin: https://untrusted.invalid'])['status']===403,'Cross-origin retry accepted');
    verify(request('scans/start.php',$cookie,json_encode(['id'=>$retryId,'experimental'=>65]))['status']===400,'Custom numeric threshold accepted');
    verify(request('scans/start.php',$cookie,$retryBody)['status']===422,'Missing alignment report accepted');
    $writeReport=function(string $counts) use($retryId) {
        [$aligned,$total]=array_map('intval',explode(',',$counts));$dir=scanJobDir($retryId);
        file_put_contents($dir.'/coverage.csv',$counts);
        $folder=$dir.'/cache/MeshroomCache/StructureFromMotion/retry-fixture';if(!is_dir($folder))mkdir($folder,0700,true);
        $cameras=['poses'=>array_map(fn($i)=>['poseId'=>(string)$i],range(0,$aligned-1)),'intrinsics'=>[['intrinsicId'=>'0']],'views'=>array_map(fn($i)=>['viewId'=>(string)$i,'poseId'=>(string)$i,'intrinsicId'=>'0'],range(0,$total-1))];
        file_put_contents($folder.'/cameras.sfm',json_encode($cameras));
    };
    foreach(['41,60','39,61','29,61','49,61'] as $invalid){$writeReport($invalid);verify(request('scans/start.php',$cookie,$retryBody)['status']===422,'Ineligible alignment accepted: '.$invalid);}
    $writeReport('41,61');
    $unreviewed=$originalImages;$unreviewed[0]['maskReviewed']=false;
    $db->prepare('UPDATE scan_jobs SET images=? WHERE id=?')->execute([json_encode($unreviewed),$retryId]);
    verify(request('scans/start.php',$cookie,$retryBody)['status']===422,'Retry bypassed mask review');
    $db->prepare('UPDATE scan_jobs SET images=? WHERE id=?')->execute([json_encode($originalImages),$retryId]);
    $maskPath=scanJobDir($retryId).'/masks/'.$originalImages[0]['maskFile'];$maskBytes=file_get_contents($maskPath);file_put_contents($maskPath,'changed');
    try {verify(request('scans/start.php',$cookie,$retryBody)['status']===422,'Retry bypassed mask integrity');}finally{file_put_contents($maskPath,$maskBytes);}
    $status=request('scans/status.php?id='.$retryId,$cookie)['data']['job'];
    verify($status['canExperimentalRetry'] && $status['alignment']===['aligned'=>41,'total'=>61] && $status['alignmentMinPercent']===80,'Failed scan did not expose trusted retry eligibility');
    verify(in_array($retryId,array_column(request('scans/list.php',$cookie)['data']['jobs'],'id'),true),'Failed saved capture cannot be recovered');
    $queued=request('scans/start.php',$cookie,$retryBody);
    verify($queued['status']===200 && $queued['data']['job']['state']==='queued' && $queued['data']['job']['alignmentMinPercent']===65 && !$queued['data']['job']['previewUrl'],'Experimental retry was not privately queued');
    verify(request('scans/start.php',$cookie,$retryBody)['data']['job']['state']==='queued','Experimental queue retry not idempotent');
    verify(request('scans/start.php',$cookie,json_encode(['id'=>$retryId]))['status']===409,'Active threshold changed silently');
    verify(request('scans/mask.php',$cookie,['id'=>$retryId,'image'=>$originalImages[0]['id'],'file'=>new CURLFile($mask,'image/png','mask.png'),'reviewed'=>'1'])['status']===409,'Retry inputs remained mutable');
    verify(scanJob($db,$retryId,$retryOwner)['images']===$originalImages,'Retry replaced saved photo/mask metadata');
    foreach($originalHashes as $file=>$hash)verify(hash_file('sha256',scanJobDir($retryId).'/'.$file)===$hash,'Retry changed saved input bytes');
    if($retryEngine==='realityscan') {
        $failRetry();$db->prepare("UPDATE scan_jobs SET engine='meshroom' WHERE id=?")->execute([$retryId]);
        verify(request('scans/status.php?id='.$retryId,$cookie)['data']['job']['canExperimentalRetry'],'Meshroom saved report was not eligible');
        $meshroom=request('scans/start.php',$cookie,$retryBody);
        verify($meshroom['status']===200 && $meshroom['data']['job']['alignmentMinPercent']===65,'Existing Meshroom scanner did not queue experimental retry');
    }
    $failRetry();$default=request('scans/start.php',$cookie,json_encode(['id'=>$retryId]));
    verify($default['status']===200 && $default['data']['job']['alignmentMinPercent']===80,'Normal retry did not restore 80% default');
    $db->prepare("UPDATE scan_jobs SET state='failed',stage='Capture discarded' WHERE id=?")->execute([$retryId]);
    verify(request('scans/start.php',$cookie,$retryBody)['status']===409,'Discarded capture resurrected');
    echo "Experimental retry passed: 41/61 alignment, 65% opt-in, 80% default, minimum views, authentication, ownership, origin, report checks, mask integrity, input reuse, queue idempotence and no automatic acceptance.\n";
    $id=newJob($cookie);
    for($start=0;$start<119;$start+=8)foreach(uploads($id,$cookie,$start,min(8,119-$start)) as $result)verify($result['status']===200,'Limit setup upload failed');
    $results=uploads($id,$cookie,119,4);
    verify(count(array_filter($results,fn($r)=>$r['status']===200))===1,'Concurrent uploads crossed limit');
    verify(count(array_filter($results,fn($r)=>$r['status']===422))===3,'Excess uploads not rejected');
    verify(request('scans/status.php?id='.$id,$cookie)['data']['job']['imageCount']===120,'Image limit is not atomic');
    $lock='kickcraft-scan-'.substr(hash('sha256',configValue('DB_NAME')),0,32);
    $stmt=$db->prepare('SELECT IS_USED_LOCK(?)');$stmt->execute([$lock]);
    $lockAlreadyHeld=(bool)$stmt->fetchColumn();
    if(!$lockAlreadyHeld) $db->prepare('SELECT GET_LOCK(?,0)')->execute([$lock]);
    {
        $command=[PHP_BINARY,'-r','require '.var_export(__DIR__.'/process-scans.php',true).'; echo scanWorkerOnce(getDb()) ? "claimed" : "locked";'];
        $process=proc_open($command,[['pipe','r'],['pipe','w'],['pipe','w']],$pipes);fclose($pipes[0]);$result=stream_get_contents($pipes[1]);fclose($pipes[1]);fclose($pipes[2]);proc_close($process);
        verify($result==='locked','Second worker ignored advisory lock');
        if(!$lockAlreadyHeld) $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);
    }
    echo "Capture API passed: owner isolation, trust, JSON, duplicate retries, 29/30 concurrent 120/121 limits, and reviewed-mask queue enforcement.\n";
    if(isset($options['scan'])) {
        $stmt=$db->prepare('SELECT id FROM users WHERE email=?');$stmt->execute([configValue('KICKCRAFT_OWNER_EMAIL')]);
        $scan=scanJob($db,scanId($options['scan']),(int)$stmt->fetchColumn());
        verify($scan['state']==='finalized','Finish region editing in the admin interface first');
        $draft=json_decode($scan['finalized_payload'],true)['draft'];
        $info=scanGlbInfo(dirname(__DIR__).'/public'.$draft['glbPath'],true);
        verify(count($info['parts'])>=2,'Saved scan lost independent regions');
        $finalizeId=newJob($cookie);
        $project=dirname(__DIR__).'/public';
        $multipart=['id'=>$finalizeId,'file'=>new CURLFile($project.$draft['glbPath'],'model/gltf-binary','scan.glb'),'neutralTexture'=>new CURLFile($project.$draft['parts'][0]['recolorTexturePath'],'image/png','neutral.png'),'thumbnail'=>new CURLFile($project.$draft['thumbnailPath'],'image/png','thumbnail.png'),'charmPoint'=>'[0.01,0.02,0.03]','regions'=>'[{"id":"falsified"}]'];
        verify(request('scans/finalize.php',$cookie,$multipart)['status']===409,'Unready scan was finalized');
        $db->prepare("UPDATE scan_jobs SET state='ready' WHERE id=?")->execute([$finalizeId]);
        verify(request('scans/finalize.php',$cookie,$multipart)['status']===503,'Missing prepared surface leaked a warning or was accepted');
        // Reuse an actual reconstructed source only to exercise finalization, not reconstruction quality.
        verify(copy(scanJobDir($scan['id']).'/preview.glb',scanJobDir($finalizeId).'/preview.glb'),'Cannot stage actual finalization source');
        $db->prepare("UPDATE users SET role='owner' WHERE id=?")->execute([$users[0]]);
        $otherCookie=login($email,$password);
        verify(request('scans/finalize.php',$otherCookie,$multipart)['status']===404,'Another owner finalized a private scan');
        $malformed=$multipart;$malformed['charmPoint']='{"x":0,"y":0,"z":0}';
        verify(request('scans/finalize.php',$cookie,$malformed)['status']===422,'Associative charm point accepted');
        $malformed['charmPoint']='{broken';
        verify(request('scans/finalize.php',$cookie,$malformed)['status']===422,'Malformed charm JSON accepted');
        $finalResult=request('scans/finalize.php',$cookie,$multipart);
        verify($finalResult['status']===200,'Valid region finalization failed');
        $finalDraft=$finalResult['data']['draft'];
        verify($finalDraft['charmsEnabled'] && $finalDraft['charmOffset']===scanCharmOffset([0.01,0.02,0.03]),'Picked charm point calibration was not persisted');
        verify(array_column($finalDraft['parts'],'id')===array_column($draft['parts'],'id'),'Browser region descriptors were trusted');
        verify(request('scans/finalize.php',$cookie,$multipart)['data']['draft']===$finalDraft,'Finalization retry changed the saved draft');
        $changed=$multipart;$changed['charmPoint']='[0,0,0]';
        verify(request('scans/finalize.php',$cookie,$changed)['status']===409,'Finalized model was silently overwritten');
        echo "Finalizer passed: owner/state checks, actual regions, point calibration, malformed point, retry identity, conflicting edits.\n";
        $shoeId='scan-verification-'.bin2hex(random_bytes(4));
        $shoe=array_merge($draft,['id'=>$shoeId,'name'=>'Scan workflow verification','description'=>'Synthetic capture used only for local integration verification.','price'=>1234,'stock'=>2,'status'=>'available','categories'=>['kickcraft']]);
        verify(request('shoes/create.php',$cookie,json_encode($shoe))['status']===201,'Catalog save failed');$createdShoes[]=$shoeId;
        $colors=[];
        foreach(array_slice($draft['parts'],0,2) as $index=>$part)$colors[$part['id']]=$draft['colors'][$index];
        $reservation=['customerName'=>'Scan Verification','email'=>'scan-verification@example.com','pickupDate'=>date('Y-m-d',strtotime('+8 days')),'shoeId'=>$shoeId,'size'=>9,'price'=>0,'charmId'=>'none','partColors'=>$colors];
        $result=request('reservations/create.php','',json_encode($reservation));
        verify($result['status']===201,'Guest reservation failed');$receipt=$result['data']['reservation']['id'];
        $stmt=$db->prepare('SELECT price,part_colors FROM reservations WHERE id=?');$stmt->execute([$receipt]);$saved=$stmt->fetch();
        verify((float)$saved['price']===1234.0,'Browser price was trusted');
        verify(json_decode($saved['part_colors'],true)===$colors,'Independent colors were not persisted');
        $stockCheck=$db->prepare('SELECT stock,status FROM shoes WHERE id=?');$stockCheck->execute([$shoeId]);$remaining=$stockCheck->fetch();
        verify((int)$remaining['stock']===1 && $remaining['status']==='available','First reservation incorrectly exhausted two-pair stock');
        $reservation['partColors']=[];
        $result=request('reservations/create.php','',json_encode($reservation));verify($result['status']===201,'Original appearance reservation failed');
        $originalReceipt=$result['data']['reservation']['id'];
        $stockCheck->execute([$shoeId]);$remaining=$stockCheck->fetch();verify((int)$remaining['stock']===0 && $remaining['status']==='out_of_stock','Last reservation failed to exhaust stock');
        $stmt->execute([$originalReceipt]);verify(count(json_decode($stmt->fetch()['part_colors'],true))===0,'Original reset serialized replacement colors');
        verify(request('reservations/update-status.php','',json_encode(['id'=>$receipt,'status'=>'approved']))['status']===401,'Guest changed reservation status');
        foreach(['approved','ready','completed'] as $status)verify(request('reservations/update-status.php',$cookie,json_encode(['id'=>$receipt,'status'=>$status]))['status']===200,'Admin status transition failed');
        verify(request('reservations/update-status.php',$cookie,json_encode(['id'=>$originalReceipt,'status'=>'cancelled','notes'=>'Synthetic workflow verification cancellation']))['status']===200,'Cancellation failed');
        $stmt=$db->prepare('SELECT stock FROM shoes WHERE id=?');$stmt->execute([$shoeId]);verify((int)$stmt->fetchColumn()===1,'Cancellation did not restore exactly one unit');
        $lookup=request('reservations/lookup.php','',json_encode(['id'=>$receipt,'email'=>'scan-verification@example.com']));
        verify(($lookup['data']['reservation']['status'] ?? '')==='completed','Guest tracking lost fulfilled status');
        echo "Finalized scan passed: catalog asset/regions, guest custom colors, original reset, server price, admin fulfillment, cancellation stock. Shoe: $shoeId; receipt: $receipt\n";
    }
} finally {
    foreach($createdShoes as $id){$db->prepare('UPDATE reservations SET deleted_at=NOW() WHERE shoe_id=?')->execute([$id]);$db->prepare('UPDATE shoes SET deleted_at=NOW() WHERE id=?')->execute([$id]);}
    foreach($jobs as $id)$db->prepare("UPDATE scan_jobs SET state='failed',stage='Verification fixture completed' WHERE id=? AND state IN ('uploading','queued')")->execute([$id]);
    foreach($users as $id)$db->prepare('UPDATE users SET deleted_at=NOW() WHERE id=?')->execute([$id]);
    foreach($temporary as $path)unlink($path);
    $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$integrationLock]);
}
