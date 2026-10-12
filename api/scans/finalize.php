<?php
require_once __DIR__.'/common.php';
scanRequest('POST', function(int $owner) {
    $id=scanId($_POST['id'] ?? null); $path=scanUploadFile('file');
    $info=scanGlbInfo($path,true); $neutral=scanUploadFile('neutralTexture');
    $texture=scanImageInfo($neutral);
    $thumbnail=scanUploadFile('thumbnail'); $thumbnailInfo=scanImageInfo($thumbnail);
    if ($thumbnailInfo['mime'] !== 'image/png') scanFail('Shoe thumbnail must be PNG');
    if ($texture['mime'] !== 'image/png') scanFail('Replacement detail texture must be PNG');
    $db=getDb(); $db->beginTransaction(); $job=scanJob($db,$id,$owner,true);
    $hash=hash_file('sha256',$path).hash_file('sha256',$neutral).hash_file('sha256',$thumbnail).hash('sha256',$_POST['charmPoint'] ?? 'null');
    if ($job['state']==='finalized') {
        $saved=json_decode($job['finalized_payload'],true);
        if ($saved['hash']!==$hash) scanFail('This scan was already finalized with different edits',409);
        $db->commit(); jsonResponse(['success'=>true,'draft'=>$saved['draft']]);
    }
    if ($job['state']!=='ready') scanFail('Wait for reconstruction before saving regions',409);
    scanSurfaceQuality(scanGlbInfo(scanJobDir($id).'/preview.glb'));
    $point=json_decode($_POST['charmPoint'] ?? 'null',true);
    if (json_last_error()!==JSON_ERROR_NONE) scanFail('Invalid charm placement');
    if ($point!==null && (!is_array($point) || !array_is_list($point) || count($point)!==3 || array_filter($point,fn($n)=>!is_numeric($n) || !is_finite((float)$n) || abs((float)$n)>2))) scanFail('Invalid charm placement');
    $filename='scan-'.$id; $project=dirname(__DIR__,2);
    foreach (['models','images'] as $kind) if (!is_dir($project.'/public/'.$kind.'/uploads')) mkdir($project.'/public/'.$kind.'/uploads',0755,true);
    $glbPath='/models/uploads/'.$filename.'.glb'; $texturePath='/images/uploads/'.$filename.'-neutral.png';
    $thumbnailPath='/images/uploads/'.$filename.'-thumb.png';
    if (!@copy($path,$project.'/public'.$glbPath) || !@copy($neutral,$project.'/public'.$texturePath) || !@copy($thumbnail,$project.'/public'.$thumbnailPath)) scanFail('Final scan could not be saved',503);
    $parts=array_map(fn($part)=>array_merge($part,['recolorTexturePath'=>$texturePath]),$info['parts']);
    $draft=['glbPath'=>$glbPath,'parts'=>$parts,'colors'=>[['name'=>'White','value'=>'#ffffff'],['name'=>'Graphite','value'=>'#292b2d'],['name'=>'Rust','value'=>'#b94d27']],'thumbnailPath'=>$thumbnailPath,'charmsEnabled'=>$point!==null,'charmOffset'=>scanCharmOffset($point),'charmScale'=>'1 1 1'];
    $db->prepare("UPDATE scan_jobs SET state='finalized',stage='Regions saved; complete catalog details',finalized_path=?,finalized_payload=? WHERE id=?")->execute([$glbPath,json_encode(['hash'=>$hash,'draft'=>$draft]),$id]);
    $db->commit(); jsonResponse(['success'=>true,'draft'=>$draft]);
});

