<?php
require_once __DIR__.'/common.php';
scanRequest('POST', function(int $owner) {
    $id = scanId($_POST['id'] ?? null);
    $path = scanUploadFile('file');
    $info = scanImageInfo($path);
    $hash = hash_file('sha256',$path);
    $db = getDb(); $db->beginTransaction();
    $job = scanJob($db,$id,$owner,true);
    tripoCaptureEngine($job['engine']);
    if ($job['state'] !== 'uploading') scanFail('This scan no longer accepts photos',409);
    $view=$_POST['view']??'';if(!in_array($view,['front','left','back','right'],true))scanFail('Choose a valid labeled shoe view');
    if(min($info['width'],$info['height'])<256)scanFail('Reference photos must be at least 256 pixels on each side');
    foreach($job['images'] as $image)if(($image['view']??'')===$view && $image['hash']!==$hash)scanFail('This view is already saved. Start a new capture to replace it.',409);
    foreach ($job['images'] as $image) if ($image['hash'] === $hash) {
        if(($image['view']??'')!==$view)scanFail('Use a different photo for each shoe view');
        $db->commit(); jsonResponse(['success'=>true,'job'=>scanPublic($job)]);
    }
    if(count($job['images'])>=4)scanFail('Photo generation accepts at most four labeled views');
    $imageId = bin2hex(random_bytes(12));
    $filename = $imageId . ($info['mime']==='image/png' ? '.png' : '.jpg');
    if (!@move_uploaded_file($path,scanJobDir($id).'/images/'.$filename)) scanFail('Photo could not be stored',503);
    $job['images'][] = array_merge($info,['view'=>$view,'id'=>$imageId,'file'=>$filename,'hash'=>$hash,'name'=>mb_substr(basename(str_replace('\\','/',$_FILES['file']['name'])),0,100)]);
    $db->prepare('UPDATE scan_jobs SET images = ? WHERE id = ?')->execute([json_encode($job['images']),$id]);
    $db->commit();
    jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});

