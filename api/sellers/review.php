<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();$id=filter_var($body['id']??null,FILTER_VALIDATE_INT);$status=$body['status']??'';$note=sellerText($body,'note',0,1000);
 if(!$id || !in_array($status,['approved','rejected','suspended'],true))scanFail('Choose approved, rejected, or suspended');
 if($status!=='approved' && strlen($note)<3)scanFail('Explain the review decision');
 $db=getDb();$db->beginTransaction();$stmt=$db->prepare("SELECT sp.status FROM seller_profiles sp JOIN users u ON u.id=sp.user_id WHERE sp.user_id=? AND u.role='seller' AND u.deleted_at IS NULL AND u.permanently_deleted=0 FOR UPDATE");$stmt->execute([$id]);if(!$stmt->fetch())scanFail('Seller not found',404);
 $db->prepare('UPDATE seller_profiles SET status=?,review_note=?,reviewer_id=?,reviewed_at=NOW() WHERE user_id=?')->execute([$status,$note,$user['id'],$id]);$db->commit();jsonResponse(['success'=>true,'seller'=>sellerProfile($id)]);
},'admin');
