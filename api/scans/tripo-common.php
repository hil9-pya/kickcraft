<?php
require_once __DIR__.'/common.php';
const TRIPO_SCAN_CREDITS=30;
function tripoCaptureEngine($engine): string {
 if(in_array($engine,['meshroom','realityscan'],true))scanFail('Local photo/video scanning is retired. Use Generate from photos.',410);
 if($engine!=='tripo')scanFail('Unknown scan engine',400);
 return 'tripo';
}
function tripoKey(): string {
 $key=trim((string)configValue('TRIPO_API_KEY'));
 if($key==='') {
  $file=(string)configValue('TRIPO_ENV_FILE');$real=$file!==''?realpath($file):false;
  if($real) {
   foreach([dirname(__DIR__,2),$_SERVER['DOCUMENT_ROOT']??dirname(__DIR__,2)] as $web)if(str_starts_with(strtolower(str_replace('\\','/',$real)),rtrim(strtolower(str_replace('\\','/',$web)),'/').'/'))scanFail('AI provider key file must be outside the web project',503);
   $values=@parse_ini_file($real,false,INI_SCANNER_RAW);$key=trim($values['TRIPO_API_KEY']??'');
  }
 }
 if($key==='' || strlen($key)>512 || preg_match('/[\r\n]/',$key))scanFail('AI provider API key is not configured on the local server',503);
 return $key;
}
function tripoConfigured(): bool {try{tripoKey();return extension_loaded('curl');}catch(Throwable $e){return false;}}
function tripoConsent(array $body): void {
 if(($body['confirmCloud']??false)!==true || ($body['maxCredits']??null)!==TRIPO_SCAN_CREDITS)scanFail('Confirm sending photos to AI provider and the 30-credit generation cost',400);
 if(($body['experimental']??false)!==false)scanFail('Alignment thresholds do not apply to AI provider generation',400);
}
function tripoMaskChoice(array $job,array $body): bool {
 $use=$body['useMasks']??false;if(!is_bool($use))scanFail('Choose originals or reviewed background-removed photos',400);
 $dir=scanJobDir($job['id']);$options=tripoRecord($dir.'/tripo-options.json');
 if(array_key_exists('useMasks',$options) && (is_file($dir.'/tripo-attempt.json') || in_array($job['state']??'', ['queued','processing','ready'],true)) && $options['useMasks']!==$use)scanFail('This AI provider task already started with different input photos. Resume its saved background choice.',409);
 if($use)scanCheckMasks($job['images'],$dir.'/masks');
 return $use;
}
function tripoCredits($balance): void {
 if(!is_numeric($balance) || !is_finite((float)$balance) || (float)$balance<TRIPO_SCAN_CREDITS)scanFail('Photo generation needs at least 30 available API credits. Studio credits are separate.',422);
}
function tripoViews(array $images): array {
 if(count($images)<1 || count($images)>4)scanFail('Choose one to four shoe photos');
 $views=[];
 foreach($images as $image){$view=$image['view']??'';if(!in_array($view,['front','left','back','right'],true) || isset($views[$view]))scanFail('Choose one distinct photo per labeled view');$views[$view]=$image;}
 if(!isset($views['front']))scanFail('A front or three-quarter reference photo is required');
 return array_replace(array_intersect_key(array_fill_keys(['front','left','back','right'],null),$views),$views);
}
function tripoGeneration(array $tokens): array {
 tripoViews(array_map(fn($view)=>['view'=>$view],array_keys($tokens)));
 $ordered=[];foreach(['front','left','back','right'] as $view)if(isset($tokens[$view])){if(!is_string($tokens[$view]) || $tokens[$view]==='')scanFail('Missing uploaded reference photo token');$ordered[$view]=$tokens[$view];}
 $body=['model'=>'v3.1-20260211','texture'=>true,'pbr'=>true,'texture_quality'=>'standard','geometry_quality'=>'standard','face_limit'=>49900,'texture_alignment'=>'original_image'];
 if(count($ordered)===1){$body['input']=$ordered['front'];$path='/generation/image-to-model';}
 else {$body['inputs']=array_map(fn($view,$token)=>[$view=>$token],array_keys($ordered),array_values($ordered));$path='/generation/multiview-to-model';}
 return ['path'=>$path,'body'=>$body];
}
function tripoRecord(string $path): array {return is_file($path)?json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR):[];}
function tripoWrite(string $path,array $data): void {
 $temporary=$path.'.tmp';$json=json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES);
 if(file_put_contents($temporary,$json,LOCK_EX)!==strlen($json) || !rename($temporary,$path))scanFail('Cannot save private generation task record',503);
}
function tripoCanResume(array $job): bool {
 if($job['state']!=='failed' || !in_array($job['stage'],['Reconstruction failed','Processing interrupted'],true))return false;
 $dir=scanJobDir($job['id']);
 try {
  if(!is_file($dir.'/tripo-attempt.json'))return true;
  $task=tripoRecord($dir.'/tripo-task.json');
  return isset($task['task_id']) && preg_match('/^[a-zA-Z0-9_-]{1,200}$/D',$task['task_id']) && !in_array($task['status']??'',['failed','cancelled','banned','expired'],true);
 }catch(Throwable $e){return false;}
}
function tripoAssetUrl($url): string {
 $parts=is_string($url)?parse_url($url):false;
 if(!$parts || ($parts['scheme']??'')!=='https' || !preg_match('/(?:^|\.)tripo3d\.(?:ai|com)$/Di',$parts['host']??'') || isset($parts['user']) || isset($parts['pass']) || isset($parts['port']))scanFail('AI provider returned an unsupported model download host');
 return $url;
}
function tripoApi(string $method,string $path,?array $body=null,bool $multipart=false): array {
 if(!preg_match('~^/(?:account/balance|files|generation/(?:image|multiview)-to-model|tasks/[a-zA-Z0-9_-]{1,200})$~D',$path))scanFail('Invalid AI provider API request');
 $headers=['Authorization: Bearer '.tripoKey()];if($body!==null && !$multipart)$headers[]='Content-Type: application/json';
 $response='';$curl=curl_init('https://openapi.tripo3d.ai/v3'.$path);
 curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_CONNECTTIMEOUT=>15,CURLOPT_TIMEOUT=>90,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_WRITEFUNCTION=>function($handle,$data)use(&$response){if(strlen($response)+strlen($data)>2*1024*1024)return 0;$response.=$data;return strlen($data);}]);
 if($body!==null)curl_setopt($curl,CURLOPT_POSTFIELDS,$multipart?$body:json_encode($body,JSON_THROW_ON_ERROR));
 $ok=curl_exec($curl);$status=curl_getinfo($curl,CURLINFO_RESPONSE_CODE);curl_close($curl);
 if($ok===false)scanFail('AI provider connection interrupted. Saved task will be resumed when known; generation will not be submitted twice.',503);
 $json=json_decode($response,true);
 if($status<200 || $status>=300 || ($json['code']??null)!==0 || !is_array($json['data']??null))scanFail($status===401?'AI provider API key was rejected. Ask the owner to check server configuration.':($status===403?'AI provider refused the request. Check API credits and account access.':'AI provider request failed (HTTP '.$status.'). Existing photos are kept.'),502);
 return $json['data'];
}
