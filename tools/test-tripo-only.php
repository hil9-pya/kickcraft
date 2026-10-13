<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/scans/common.php';session_write_close();
if(configValue('DB_NAME')!=='kickcraft_photo_scan_dev')throw new RuntimeException('Isolated database required');
$db=getDb();$jobs=[];$checks=0;$cookie='';
function onlyCheck($ok,string $message):void{global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function onlyRequest(string $path,$body=null,string $cookie=''):array{
 $h=curl_init('http://localhost:5174/api/'.$path);$headers=['X-Requested-With: '.(str_starts_with($path,'scans/')?'KickCraftScan':'KickCraft')];if($body!==null&&!is_array($body))$headers[]='Content-Type: application/json';
 curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_COOKIE=>$cookie,CURLOPT_TIMEOUT=>30,CURLOPT_HTTPHEADER=>$headers]);if($body!==null){curl_setopt($h,CURLOPT_POST,true);curl_setopt($h,CURLOPT_POSTFIELDS,$body);}
 $raw=curl_exec($h);if($raw===false)throw new RuntimeException('Local request failed');$size=curl_getinfo($h,CURLINFO_HEADER_SIZE);preg_match_all('/^Set-Cookie:\s*([^;\r\n]+)/mi',substr($raw,0,$size),$cookies);
 return ['status'=>curl_getinfo($h,CURLINFO_RESPONSE_CODE),'data'=>json_decode(substr($raw,$size),true),'cookie'=>end($cookies[1])?:''];
}
function onlyPost(string $path,array $body):array{global $cookie;return onlyRequest($path,json_encode($body),$cookie);}
try{
 $login=onlyPost('auth/login.php',['email'=>configValue('KICKCRAFT_OWNER_EMAIL'),'password'=>configValue('KICKCRAFT_OWNER_PASSWORD')]);onlyCheck($login['status']===200,'Owner login failed');$cookie=$login['cookie'];
 foreach(['meshroom','realityscan'] as $engine){$r=onlyPost('scans/create.php',['engine'=>$engine]);if(isset($r['data']['job']))$jobs[]=$r['data']['job']['id'];onlyCheck($r['status']===410,'Retired engine still creatable: '.$engine);}
 $r=onlyPost('scans/create.php',[]);if(isset($r['data']['job']))$jobs[]=$r['data']['job']['id'];onlyCheck($r['status']===201&&$r['data']['job']['engine']==='tripo','New captures must default to Tripo');
 onlyCheck(onlyRequest('scans/video.php',[], $cookie)['status']===410,'Video upload endpoint still active');
 $owner=(int)$login['data']['user']['id'];
 // Stage private, empty historical job only; never queue reconstruction.
 $hex=bin2hex(random_bytes(16));$id=substr($hex,0,8).'-'.substr($hex,8,4).'-4'.substr($hex,13,3).'-8'.substr($hex,17,3).'-'.substr($hex,20);$jobs[]=$id;mkdir(scanJobDir($id).'/images',0700,true);
 $db->prepare("INSERT INTO scan_jobs(id,owner_id,engine,state,images) VALUES(?,?,'meshroom','uploading','[]')")->execute([$id,$owner]);
 foreach(['start.php','ai-masks.php'] as $endpoint)onlyCheck(onlyPost('scans/'.$endpoint,['id'=>$id])['status']===410,'Retired capture accepted '.$endpoint);
 $photo=realpath(__DIR__.'/../public/images/kickcraft-one-card.png');onlyCheck(onlyRequest('scans/upload.php',['id'=>$id,'file'=>new CURLFile($photo,'image/png','reference.png')],$cookie)['status']===410,'Retired capture accepted photos');
 $listed=onlyRequest('scans/list.php',null,$cookie);onlyCheck($listed['status']===200&&!in_array($id,array_column($listed['data']['jobs'],'id'),true),'Legacy capture offered for new workflow');
 onlyCheck(onlyRequest('scans/status.php?id='.$id,null,$cookie)['status']===200,'Historical capture metadata removed');
 $cap=onlyRequest('scans/capabilities.php',null,$cookie);onlyCheck(isset($cap['data']['aiMasks'],$cap['data']['tripo'])&&!isset($cap['data']['realityscan']),'Capabilities still advertise retired scanner');
 echo "PASS: $checks Tripo-only workflow checks; no generation or credits\n";
}finally{foreach($jobs as $id)$db->prepare("UPDATE scan_jobs SET state='failed',stage='Retired verification' WHERE id=? AND state='uploading'")->execute([$id]);}
