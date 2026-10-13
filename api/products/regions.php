<?php
require_once __DIR__.'/common.php';
$method=$_SERVER['REQUEST_METHOD']??'';
if(!in_array($method,['GET','POST'],true))jsonError('Method not allowed',405);
sellerRequest($method,function($user)use($method){
 $input=$method==='GET'?$_GET:$_POST;$db=getDb();
 if($method==='POST')$db->beginTransaction();
 $row=productRow(sellerText($input,'id',1,100),(int)$user['id'],$method==='POST');
 if(!$row['source_scan_id'])scanFail('Repainting is available for photo-generated shoes.');
 scanJob($db,$row['source_scan_id'],(int)$user['id']);
 if($method==='GET'){
  scanGlbInfo(dirname(__DIR__,2).'/public'.$row['glb_path'],true);
  $point=null;
  if($row['charms_enabled']&&$row['charm_offset']){
   $offset=array_map('floatval',preg_split('/\s+/',trim($row['charm_offset'])));
   $origin=array_map('floatval',explode(' ',scanCharmOffset([0,0,0])));
   $point=array_map(fn($axis)=>$offset[$axis]-$origin[$axis],[0,1,2]);
  }
  jsonResponse(['shoe'=>formatShoeRow($row),'charmPoint'=>$point]);
 }
 if(sellerText($input,'expectedModel',1,500)!==$row['glb_path'])scanFail('Shoe model changed while painting. Reopen the latest saved model.',409);
 $model=scanUploadFile('file');$info=scanGlbInfo($model,true);scanSurfaceQuality($info);
 $neutral=scanUploadFile('neutralTexture');$thumbnail=scanUploadFile('thumbnail');
 foreach([$neutral,$thumbnail] as $image)if(scanImageInfo($image)['mime']!=='image/png')scanFail('Detail texture and thumbnail must be PNG.');
 $point=json_decode($input['charmPoint']??'null',true);
 if(json_last_error()!==JSON_ERROR_NONE || ($point!==null&&(!is_array($point)||!array_is_list($point)||count($point)!==3||array_filter($point,fn($value)=>!is_numeric($value)||!is_finite((float)$value)||abs((float)$value)>2))))scanFail('Invalid charm placement');
 $name='regions-'.bin2hex(random_bytes(16));$project=dirname(__DIR__,2).'/public';
 $glb='/models/uploads/'.$name.'.glb';$texture='/images/uploads/'.$name.'-neutral.png';$thumb='/images/uploads/'.$name.'-thumb.png';
 if(!copy($model,$project.$glb)||!copy($neutral,$project.$texture)||!copy($thumbnail,$project.$thumb))scanFail('Could not save revised shoe parts.',503);
 $labels=array_column(json_decode($row['parts'],true),'label','id');
 $parts=array_map(fn($part)=>array_merge($part,['label'=>$labels[$part['id']]??$part['label'],'recolorTexturePath'=>$texture]),$info['parts']);
 $db->prepare("UPDATE shoes SET glb_path=?,thumbnail_path=?,parts=?,charms_enabled=?,charm_offset=?,publication_state='draft',review_note='',reviewer_id=NULL,reviewed_at=NULL WHERE id=? AND seller_user_id=?")->execute([$glb,$thumb,json_encode($parts),$point!==null?1:0,scanCharmOffset($point),$row['id'],$user['id']]);
 $db->commit();jsonResponse(['success'=>true,'shoe'=>formatShoeRow(productRow($row['id'],(int)$user['id']))]);
});
