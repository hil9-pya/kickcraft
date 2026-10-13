<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();if(($body['allowReuse']??false)!==true)scanFail('Confirm this is your original design and allow other sellers to reuse its model and part boundaries');
 $name=sellerText($body,'name',2,160);$description=sellerText($body,'description',10,3000);$db=getDb();$db->beginTransaction();
 $product=productRow(sellerText($body,'productId',1,100),(int)$user['id'],true);
 if(!$product['source_scan_id'] || $product['source_template_id'])scanFail('Share your own finished photo-generated model; reused templates cannot be shared as originals');
 $job=scanJob($db,$product['source_scan_id'],(int)$user['id'],true);if($job['state']!=='finalized' || !$job['images'])scanFail('Finish photo comparison and part editing first',409);
 $stmt=$db->prepare('SELECT id FROM shoe_templates WHERE source_product_id=?');$stmt->execute([$product['id']]);
 if($id=$stmt->fetchColumn()){
  $existing=sharedTemplate($id,true);
  if($existing['status']==='rejected')$db->prepare("UPDATE shoe_templates SET status='pending',name=?,description=?,review_note='',reviewer_id=NULL,reviewed_at=NULL WHERE id=?")->execute([$name,$description,$id]);
  $db->commit();jsonResponse(['template'=>templatePublic(sharedTemplate($id))]);
 }
 $id='shared-'.bin2hex(random_bytes(12));$asset=templateSnapshot($product,$id);
 $db->prepare('INSERT INTO shoe_templates(id,creator_user_id,source_product_id,source_scan_id,name,description,asset) VALUES(?,?,?,?,?,?,?)')->execute([$id,$user['id'],$product['id'],$job['id'],$name,$description,json_encode($asset)]);
 $db->commit();jsonResponse(['template'=>templatePublic(sharedTemplate($id))],201);
});
