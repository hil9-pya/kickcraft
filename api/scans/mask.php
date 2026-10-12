<?php
require_once __DIR__.'/common.php';
scanRequest('POST',function(int $owner) {
    $id=scanId($_POST['id'] ?? null); $path=scanUploadFile('file');
    $db=getDb(); $db->beginTransaction(); $job=scanJob($db,$id,$owner,true);
    if ($job['state']!=='uploading') scanFail('Masks can only change before reconstruction',409);
    $index=null;
    foreach ($job['images'] as $key=>$image) if ($image['id']===($_POST['image'] ?? '')) { $index=$key; break; }
    if ($index===null) scanFail('Photo not found',404);
    if (!in_array($_POST['reviewed'] ?? null,['0','1'],true)) scanFail('Specify whether the mask was reviewed');
    $image=$job['images'][$index];
    scanMaskInfo($path,(int)$image['width'],(int)$image['height']);
    $hash=hash_file('sha256',$path); $filename=$image['id'].'-'.$hash.'.png'; $folder=scanJobDir($id).'/masks';
    if (!is_dir($folder) && !@mkdir($folder,0700,true)) scanFail('Cannot create private mask folder',503);
    if (!is_file($folder.'/'.$filename) && !@move_uploaded_file($path,$folder.'/'.$filename)) scanFail('Mask could not be stored',503);
    $job['images'][$index]['maskFile']=$filename; $job['images'][$index]['maskHash']=$hash; $job['images'][$index]['maskReviewed']=$_POST['reviewed']==='1';
    $db->prepare('UPDATE scan_jobs SET images=? WHERE id=?')->execute([json_encode($job['images'],JSON_THROW_ON_ERROR),$id]);
    $db->commit(); jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});
