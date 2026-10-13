<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();$status=$body['status']??'';if(!in_array($status,['approved','rejected'],true))scanFail('Choose approve or reject');
 $note=sellerText($body,'note',$status==='approved'?0:3,1000);$db=getDb();$db->beginTransaction();$row=sharedTemplate(sellerText($body,'id',1,100),true);
 if($status==='approved'){
  if($row['status']!=='pending')scanFail('Only pending templates can be approved',409);
  if($row['creator_status']!=='approved' || $row['creator_deleted'] || $row['creator_removed'])scanFail('Creator store must remain approved',409);
  $asset=json_decode($row['asset'],true);$names=productMaterialNames(templateFile($asset['glbPath'],'glb'));$materials=array_column($asset['parts'],'material');
  foreach($materials as $material)if(!in_array($material,$names,true))scanFail('Template material missing');
  $tested=$body['testedParts']??[];
  if(($body['photoReviewed']??false)!==true || !is_array($tested) || !array_is_list($tested) || count(array_filter($tested,'is_string'))!==count($tested) || count(array_unique($tested))<2 || array_diff($tested,$materials))scanFail('Compare original photos and test at least two different editable parts');
  $job=templateScan($row['id']);if(!$job['images'])scanFail('Original photographs unavailable',503);
  foreach($job['images'] as $image)if(!is_file(scanJobDir($job['id']).'/images/'.$image['file']))scanFail('Original photograph missing',503);
 }
 $db->prepare('UPDATE shoe_templates SET status=?,review_note=?,reviewer_id=?,reviewed_at=NOW() WHERE id=?')->execute([$status,$note,$user['id'],$row['id']]);$db->commit();jsonResponse(['template'=>templatePublic(sharedTemplate($row['id']))]);
},'admin');
