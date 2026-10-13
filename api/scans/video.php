<?php
require_once __DIR__.'/video-common.php';
scanRequest('POST',function(int $owner) {
    $id=scanId($_POST['id'] ?? null);$key=(string)($_POST['key'] ?? '');
    $offset=filter_var($_POST['offset'] ?? null,FILTER_VALIDATE_INT);$total=filter_var($_POST['total'] ?? null,FILTER_VALIDATE_INT);
    if ($offset===false || $offset===null || $total===false || $total===null) scanFail('Invalid upload offset',400);
    $chunk=scanUploadFile('file');scanVideoChunkBounds($offset,$total,filesize($chunk),$key);
    $name=mb_substr(basename(str_replace('\\','/',(string)($_POST['name'] ?? ''))),0,200);
    $extension=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    if (!in_array($extension,['mp4','mov'],true)) scanFail('Choose an MP4 or MOV video',415);
    $db=getDb();$db->beginTransaction();$job=scanJob($db,$id,$owner,true);
    if (($job['engine'] ?? '')!=='realityscan' || $job['state']!=='uploading' || $job['images']) scanFail('This scan cannot accept a video',409);
    if (!is_file((string)configValue('REALITYSCAN_EXE'))) scanFail('Local RealityScan is unavailable',503);
    $video=json_decode($job['input_video'] ?? 'null',true);
    if (!$video) $video=['key'=>$key,'name'=>$name,'total'=>$total,'received'=>0,'file'=>'source.'.$extension];
    if ($video['key']!==$key || $video['total']!==$total || $video['name']!==$name) scanFail('Reselect the same video to resume, or start a new capture',409);
    $path=scanJobDir($id).'/'.$video['file'];
    $video['received']=scanAppendVideoChunk($path,$chunk,$offset,$video['received']);
    if ($video['received']===$total) {
        $video=array_merge($video,scanVideoInfo($path));$video['sha256']=hash_file('sha256',$path);
        $db->prepare("UPDATE scan_jobs SET state='queued',operation='prepare',stage='Waiting for video import and AI masks',input_video=? WHERE id=?")->execute([json_encode($video,JSON_THROW_ON_ERROR),$id]);
    } else $db->prepare('UPDATE scan_jobs SET input_video=? WHERE id=?')->execute([json_encode($video,JSON_THROW_ON_ERROR),$id]);
    $db->commit();jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});
