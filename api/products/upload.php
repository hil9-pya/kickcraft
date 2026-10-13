<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $path=scanUploadFile('file');$names=productMaterialNames($path,true);$thumb=scanUploadFile('thumbnail');$info=scanImageInfo($thumb);if($info['mime']!=='image/png')scanFail('Thumbnail must be PNG');
 $parts=[];foreach($names as $index=>$name)$parts[]=['id'=>'part-'.($index+1),'label'=>substr(preg_replace('/Material$/','',$name),0,80)?:'Part '.($index+1),'material'=>$name];
 $slug='product-'.bin2hex(random_bytes(16));$project=dirname(__DIR__,2).'/public';foreach(['models','images'] as $dir)if(!is_dir($project.'/'.$dir.'/uploads'))mkdir($project.'/'.$dir.'/uploads',0755,true);
 $asset=productTemplate();$asset['glbPath']='/models/uploads/'.$slug.'.glb';$asset['thumbnailPath']='/images/uploads/'.$slug.'.png';$asset['parts']=$parts;$asset['charmsEnabled']=false;
 if(!copy($path,$project.$asset['glbPath']) || !copy($thumb,$project.$asset['thumbnailPath']))scanFail('Upload could not be saved',503);
 jsonResponse(['success'=>true,'shoe'=>productInsert((int)$user['id'],$asset)],201);
});
