<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/scans/tripo-common.php';
function tripoInput(array $image,string $dir,string $view,bool $useMasks=true): string {
 if(!extension_loaded('gd'))scanFail('Start the local worker with PHP -d extension=gd -d memory_limit=512M to prepare Reference photos',503);
 $file=$dir.'/images/'.basename($image['file']);
 if(!is_file($file) || hash_file('sha256',$file)!==$image['hash'])scanFail('Saved reference photo changed; start a new capture');
 $info=scanImageInfo($file);if(min($info['width'],$info['height'])<256)scanFail('Reference photos must be at least 256 pixels on each side');
 $source=@imagecreatefromstring(file_get_contents($file));if(!$source)scanFail('Cannot decode reference photo');
 try {
  imagepalettetotruecolor($source);imagealphablending($source,false);imagesavealpha($source,true);
  if($useMasks && !empty($image['maskReviewed'])) {
   scanCheckMasks([$image],$dir.'/masks');$mask=imagecreatefrompng($dir.'/masks/'.$image['maskFile']);
   if(imagesx($mask)!==imagesx($source) || imagesy($mask)!==imagesy($source))scanFail('Reviewed mask dimensions do not match reference photo');
   for($y=0;$y<imagesy($source);$y++)for($x=0;$x<imagesx($source);$x++)if((imagecolorat($mask,$x,$y)&255)<128)imagesetpixel($source,$x,$y,0x7f000000);
   imagedestroy($mask);
  }
  $orientation=$info['orientation'];
  if(in_array($orientation,[3,5,6,7,8],true)){$angle=$orientation===3?180:($orientation===8?90:-90);$rotated=imagerotate($source,$angle,0x7f000000);imagedestroy($source);$source=$rotated;}
  if(in_array($orientation,[2,5],true))imageflip($source,IMG_FLIP_HORIZONTAL);
  if(in_array($orientation,[4,7],true))imageflip($source,IMG_FLIP_VERTICAL);
  $ratio=min(1,1536/max(imagesx($source),imagesy($source)));$target=imagecreatetruecolor(max(1,(int)round(imagesx($source)*$ratio)),max(1,(int)round(imagesy($source)*$ratio)));
  imagealphablending($target,false);imagesavealpha($target,true);
  imagecopyresampled($target,$source,0,0,0,0,imagesx($target),imagesy($target),imagesx($source),imagesy($source));
  $path=$dir.'/tripo-'.$view.'.png';if(!imagepng($target,$path))scanFail('Cannot prepare private reference photo');imagedestroy($target);
  return $path;
 }finally{imagedestroy($source);}
}
function tripoDownload(string $url,string $target): void {
 $url=tripoAssetUrl($url);$stream=fopen($target.'.part','wb');if(!$stream)scanFail('Cannot write private generated model');
 $bytes=0;$curl=curl_init($url);
 curl_setopt_array($curl,[CURLOPT_CONNECTTIMEOUT=>15,CURLOPT_TIMEOUT=>120,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_WRITEFUNCTION=>function($handle,$data)use($stream,&$bytes){$bytes+=strlen($data);return $bytes>20*1024*1024?0:fwrite($stream,$data);}]);
 $ok=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);fclose($stream);
 if($ok===false || $status!==200 || $bytes<20)scanFail('AI provider model download failed or exceeded 20 MB. Retry resumes this task without new generation.',502);
 scanSurfaceQuality(scanGlbInfo($target.'.part'));
 if(!rename($target.'.part',$target))scanFail('Cannot save private generated model',503);
}
function tripoPreview(string $path): array {
 $info=scanSurfaceQuality(scanGlbInfo($path));$bytes=file_get_contents($path);$json=json_decode(substr($bytes,20,unpack('V',substr($bytes,12,4))[1]),true,512,JSON_THROW_ON_ERROR);
 if(count($json['meshes']??[])!==1 || count($json['meshes'][0]['primitives']??[])!==1)scanFail('Generated model needs one textured surface for region selection. Existing capture is kept.');
 return $info;
}
function tripoProcess(array $job,callable $progress,?callable $request=null,?callable $download=null): array {
 $request??='tripoApi';$download??='tripoDownload';$dir=scanJobDir($job['id']);$record=$dir.'/tripo-task.json';$attempt=$dir.'/tripo-attempt.json';$task=tripoRecord($record);
 if(isset($task['task_id']) && is_file($dir.'/preview.glb'))return tripoPreview($dir.'/preview.glb');
 if(empty($task['task_id'])) {
  if(is_file($attempt))scanFail('Generation response was lost. Check the AI provider dashboard; automatic resubmission is blocked to prevent duplicate charges.');
  $useMasks=tripoRecord($dir.'/tripo-options.json')['useMasks']??(bool)array_filter($job['images'],fn($image)=>!empty($image['maskReviewed']));
  if($useMasks)scanCheckMasks($job['images'],$dir.'/masks');
  $progress('Checking generation credit balance');$balance=$request('GET','/account/balance');tripoCredits($balance['balance']??null);
  $tokens=[];
  foreach(tripoViews($job['images']) as $view=>$image){$progress('Preparing and uploading '.$view.' reference to AI provider');$file=tripoInput($image,$dir,$view,$useMasks);$upload=$request('POST','/files',['file'=>new CURLFile($file,'image/png',$view.'.png')],true);$tokens[$view]=$upload['file_token']??'';}
  $generation=tripoGeneration($tokens);
  $fence=@fopen($attempt,'x');if(!$fence)scanFail('Generation already attempted; no duplicate paid request was sent');
  $json=json_encode(['startedAt'=>gmdate('c'),'expectedCredits'=>TRIPO_SCAN_CREDITS,'useMasks'=>$useMasks,'inputHashes'=>array_column($job['images'],'hash'),'request'=>$generation],JSON_THROW_ON_ERROR);
  $written=fwrite($fence,$json);fflush($fence);fclose($fence);if($written!==strlen($json))scanFail('Cannot save paid-request guard; no generation was sent');
  $progress('Photo generation requested (30 credits)');$task=$request('POST',$generation['path'],$generation['body']);
  if(!is_string($task['task_id']??null) || !preg_match('/^[a-zA-Z0-9_-]{1,200}$/D',$task['task_id']))scanFail('AI provider returned no valid task ID. Automatic resubmission is blocked; check the AI provider dashboard.');
  tripoWrite($record,$task);
 }
 $id=$task['task_id'];if(!is_string($id) || !preg_match('/^[a-zA-Z0-9_-]{1,200}$/D',$id))scanFail('Invalid saved AI provider task ID');
 $started=microtime(true);
 while(true) {
  $progress('Checking saved generation task');$task=$request('GET','/tasks/'.$id);$task['task_id']=$id;tripoWrite($record,$task);
  $status=$task['status']??'';
  if($status==='success')break;
  if(!in_array($status,['queued','running','processing'],true))scanFail('AI provider task did not succeed ('.(in_array($status,['failed','cancelled','banned','expired'],true)?$status:'unknown status').'). No automatic paid regeneration. Existing photos are kept.');
  $percent=is_numeric($task['progress']??null)?max(0,min(100,(int)$task['progress'])):0;$progress('Generating your 3D shoe: '.$percent.'%');
  if(microtime(true)-$started>1800)scanFail('Generation is taking longer than expected. Retry resumes the saved task without another generation charge.');
  sleep(3);
 }
 $progress('Downloading and validating generated model');$url=tripoAssetUrl($task['output']['model_url']??null);$download($url,$dir.'/preview.glb');
 return tripoPreview($dir.'/preview.glb');
}
