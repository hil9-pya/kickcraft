<?php
require_once __DIR__.'/common.php';
scanRequest('POST', function(int $owner) {
    $id = scanId($_POST['id'] ?? null);
    $path = scanUploadFile('file');
    $info = scanImageInfo($path);
    $hash = hash_file('sha256',$path);
    $db = getDb(); $db->beginTransaction();
    $job = scanJob($db,$id,$owner,true);
    if ($job['state'] !== 'uploading') scanFail('This scan no longer accepts photos',409);
    foreach ($job['images'] as $image) if ($image['hash'] === $hash) {
        $db->commit(); jsonResponse(['success'=>true,'job'=>scanPublic($job)]);
    }
    if (count($job['images']) >= 120) scanFail('A scan accepts at most 120 photos');
    $imageId = bin2hex(random_bytes(12));
    $filename = $imageId . ($info['mime']==='image/png' ? '.png' : '.jpg');
    if (!@move_uploaded_file($path,scanJobDir($id).'/images/'.$filename)) scanFail('Photo could not be stored',503);
    $job['images'][] = array_merge($info,['id'=>$imageId,'file'=>$filename,'hash'=>$hash,'name'=>mb_substr(basename(str_replace('\\','/',$_FILES['file']['name'])),0,100)]);
    $db->prepare('UPDATE scan_jobs SET images = ? WHERE id = ?')->execute([json_encode($job['images']),$id]);
    $db->commit();
    jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});

