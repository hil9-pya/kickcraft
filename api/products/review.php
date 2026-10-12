<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();$status=$body['status']??'';$note=sellerText($body,'note',0,1000);if(!in_array($status,['approved','rejected'],true) || ($status==='rejected' && strlen($note)<3))scanFail('Choose a review decision and explain any rejection');
 $db=getDb();$db->beginTransaction();$row=productRow(sellerText($body,'id',1,100),null,true);if(!$row['seller_user_id'])scanFail('Seller product not found',404);
 if($row['publication_state']!=='pending' && !($row['publication_state']==='approved' && $status==='rejected'))scanFail('Only submitted listings can be reviewed',409);
 $seller=sellerProfile((int)$row['seller_user_id']);if($status==='approved'){if($seller['status']!=='approved')scanFail('Approve the seller before publishing',409);productCheck($row);if($row['source_scan_id'] && ($body['photoReviewed']??false)!==true)scanFail('Compare this scan against its source photos before approval');}
 $db->prepare('UPDATE shoes SET publication_state=?,review_note=?,reviewer_id=?,reviewed_at=NOW() WHERE id=?')->execute([$status,$note,$user['id'],$row['id']]);$db->commit();jsonResponse(['success'=>true,'shoe'=>formatShoeRow(productRow($row['id']))]);
},'admin');
