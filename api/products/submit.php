<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();$db=getDb();$db->beginTransaction();$row=productRow(sellerText($body,'id',1,100),(int)$user['id'],true);productCheck($row);
 if($row['publication_state']==='approved')scanFail('Edit this listing before resubmitting',409);
 $db->prepare("UPDATE shoes SET publication_state='pending',review_note='',reviewer_id=NULL,reviewed_at=NULL WHERE id=?")->execute([$row['id']]);$db->commit();jsonResponse(['success'=>true,'shoe'=>formatShoeRow(productRow($row['id'],(int)$user['id']))]);
});
