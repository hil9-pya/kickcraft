<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();$action=$body['action']??'';
 if(!in_array($action,['unpublish','archive','restore'],true))scanFail('Choose unpublish, remove, or restore.');
 $db=getDb();$db->beginTransaction();$row=productRow(sellerText($body,'id',1,100),(int)$user['id'],true,true);
 if($action==='archive'){
  $db->prepare('UPDATE shoes SET deleted_at=COALESCE(deleted_at,NOW()) WHERE id=?')->execute([$row['id']]);
 }elseif($action==='restore'){
  if($row['deleted_at']!==null)$db->prepare("UPDATE shoes SET deleted_at=NULL,publication_state='draft',review_note='',reviewer_id=NULL,reviewed_at=NULL WHERE id=?")->execute([$row['id']]);
 }else{
  if($row['deleted_at']!==null)scanFail('Restore this removed product before editing it.',409);
  $db->prepare("UPDATE shoes SET publication_state='draft',review_note='',reviewer_id=NULL,reviewed_at=NULL WHERE id=?")->execute([$row['id']]);
 }
 $db->commit();jsonResponse(['success'=>true,'shoe'=>formatShoeRow(productRow($row['id'],(int)$user['id'],false,true))]);
});
