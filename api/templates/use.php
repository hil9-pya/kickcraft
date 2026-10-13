<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 if(($_POST['matches']??'')!=='1')scanFail('Confirm this template matches the actual shoe you sell');
 $id=sellerText($_POST,'id',1,100);$request=scanId($_POST['requestId']??null);$photo=scanUploadFile('file');$info=scanImageInfo($photo);
 if($info['width']<256 || $info['height']<256)scanFail('Matching-shoe reference must be at least 256 pixels on each side');
 $hash=hash('sha256',$id.'|'.$user['id'].'|'.hash_file('sha256',$photo));$db=getDb();$db->beginTransaction();
 $db->prepare('SELECT id FROM users WHERE id=? FOR UPDATE')->execute([$user['id']]);
 $stmt=$db->prepare('SELECT * FROM scan_jobs WHERE id=? FOR UPDATE');$stmt->execute([$request]);$existing=$stmt->fetch();
 if($existing){
  $payload=json_decode($existing['finalized_payload']??'null',true);
  if((int)$existing['owner_id']!==(int)$user['id'] || ($payload['hash']??'')!==$hash || ($payload['templateId']??'')!==$id)scanFail('This retry ID already belongs to a different draft',409);
  $stmt=$db->prepare('SELECT id FROM shoes WHERE source_scan_id=? AND seller_user_id=? AND deleted_at IS NULL AND permanently_deleted=0');$stmt->execute([$request,$user['id']]);$pid=$stmt->fetchColumn();if(!$pid)scanFail('Previous draft was removed. Start a new reuse request.',409);
  $db->commit();jsonResponse(['shoe'=>formatShoeRow(productRow($pid,(int)$user['id']))]);
 }
 $row=sharedTemplate($id,true);if(!templateAvailable($row))scanFail('Template is not approved for reuse',409);
 $asset=json_decode($row['asset'],true);templateFile($asset['glbPath'],'glb');templateFile($asset['thumbnailPath'],'png');
 $dir=scanJobDir($request);if(is_dir($dir) || !mkdir($dir.'/images',0700,true))scanFail('Cannot create private reference folder',503);
 $file='reference.'.($info['mime']==='image/png'?'png':'jpg');
 try {
  if(!move_uploaded_file($photo,$dir.'/images/'.$file))scanFail('Could not save matching-shoe reference',503);
  $image=array_merge($info,['id'=>'reference','file'=>$file,'name'=>'Seller matching-shoe reference','hash'=>hash_file('sha256',$dir.'/images/'.$file)]);
  $db->prepare("INSERT INTO scan_jobs(id,owner_id,state,engine,stage,images,finalized_path,finalized_payload) VALUES(?,?,'finalized','template','Shared template; matching-shoe reference saved',?,?,?)")->execute([$request,$user['id'],json_encode([$image]),$asset['glbPath'],json_encode(['hash'=>$hash,'templateId'=>$id,'draft'=>$asset])]);
  $shoe=productInsert((int)$user['id'],$asset,$request);$db->prepare('UPDATE shoes SET source_template_id=? WHERE id=?')->execute([$id,$shoe['id']]);
  $db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();@unlink($dir.'/images/'.$file);@rmdir($dir.'/images');@rmdir($dir);throw $e;}
 jsonResponse(['shoe'=>formatShoeRow(productRow($shoe['id'],(int)$user['id']))],201);
});
