<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();$db=getDb();$db->beginTransaction();$stmt=$db->prepare('SELECT * FROM seller_profiles WHERE user_id=? FOR UPDATE');$stmt->execute([$user['id']]);$current=$stmt->fetch();
 if(array_key_exists('tutorialStep',$body)){
  $step=filter_var($body['tutorialStep'],FILTER_VALIDATE_INT);if($step===false || $step<0 || $step>5)scanFail('Invalid tutorial step');
  $db->prepare('UPDATE seller_profiles SET tutorial_step=? WHERE user_id=?')->execute([$step,$user['id']]);
 }else{
  if($current['status']==='suspended')scanFail('Contact admin before changing a suspended store',403);
  $values=sellerProfileInput($body);$state=$current['status']==='rejected'?'pending':$current['status'];
  // Approved store identity/address changes require another review before new pickups.
  if($current['status']==='approved' && ($values[0]!==$current['store_name'] || $values[2]!==$current['pickup_address']))$state='pending';
  $db->prepare('UPDATE seller_profiles SET store_name=?,description=?,pickup_address=?,contact=?,status=? WHERE user_id=?')->execute(array_merge($values,[$state,$user['id']]));
 }
 $db->commit();jsonResponse(['success'=>true,'seller'=>sellerProfile((int)$user['id'])]);
},'account');
