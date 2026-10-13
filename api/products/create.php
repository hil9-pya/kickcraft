<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();$source=$body['source']??'';$scan=null;$db=getDb();$db->beginTransaction();
 if($source==='template'){
  if(($body['template']??'')!=='kickcraft-one')scanFail('Choose the original KickCraft template');
  $asset=productTemplate();
 }elseif($source==='scan'){
  $scan=scanId($body['scanId']??null);$job=scanJob($db,$scan,(int)$user['id'],true);
  if($job['state']!=='finalized')scanFail('Finish scan region painting first',409);
  $existing=$db->prepare('SELECT id,deleted_at,permanently_deleted FROM shoes WHERE source_scan_id=? AND seller_user_id=?');$existing->execute([$scan,$user['id']]);
  if($saved=$existing->fetch()){if($saved['deleted_at']!==null || $saved['permanently_deleted'])scanFail('This capture belongs to a removed product. Restore it from Removed products.',409);$db->commit();jsonResponse(['success'=>true,'shoe'=>formatShoeRow(productRow($saved['id'],(int)$user['id']))]);}
  $asset=json_decode($job['finalized_payload'],true)['draft'];
 }else scanFail('Choose photos, a GLB upload, or the original template');
 $shoe=productInsert((int)$user['id'],$asset,$scan);$db->commit();jsonResponse(['success'=>true,'shoe'=>$shoe],201);
});
