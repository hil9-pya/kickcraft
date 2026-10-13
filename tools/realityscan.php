<?php
// Native processing is CLI-only; the website talks to PHP jobs, never the desktop executable.
if (PHP_SAPI!=='cli') {http_response_code(404);exit;}
require_once __DIR__.'/../api/scans/common.php';
function scanNativeCommand(string $dir,array $arguments): array {
    return array_merge([(string)configValue('REALITYSCAN_EXE'),'-headless','-silent',$dir.'/crashes','-disableOnlineCommunication','-stdConsole','-set','appQuitOnError=true','-set','suppressErrors=true','-writeProgress',$dir.'/progress.txt','5'],$arguments,['-quit']);
}
function scanNativeRun(string $dir,string $name,array $arguments,callable $heartbeat,int $timeout): void {
    scanProcess(scanToolCommand(scanNativeCommand($dir,$arguments),$dir,'realityscan-'.$name),$dir.'/worker.log',$heartbeat,$timeout);
}
function scanNativeCoverage(string $path,int $total,int $minimum=80): array {
    return scanRequireAlignment(scanReadNativeAlignment($path,$total),$minimum);
}
function scanNativePrepare(PDO $db,array $job,string $dir,callable $heartbeat): void {
    require_once __DIR__.'/../api/scans/video-common.php';
    $video=json_decode($job['input_video'],true,512,JSON_THROW_ON_ERROR);
    if (!$video || !in_array($video['file'] ?? '',['source.mp4','source.mov'],true) || ($video['received'] ?? 0)!==($video['total'] ?? -1)) scanFail('Saved video is incomplete');
    $source=$dir.'/'.$video['file'];$info=scanVideoInfo($source);
    if (hash_file('sha256',$source)!==($video['sha256'] ?? '')) scanFail('Saved video changed; start a new capture');
    $native=$dir.'/native';
    foreach (['frames','masks','crashes'] as $folder) if (!is_dir($native.'/'.$folder) && !mkdir($native.'/'.$folder,0700,true)) scanFail('Cannot prepare native video folders');
    $guard=function() use($heartbeat,$native) {
        $heartbeat();$frames=glob($native.'/frames/*.png');$bytes=0;
        foreach($frames as $frame) $bytes+=filesize($frame);
        if (count($frames)>120 || $bytes>1500*1024*1024) scanFail('Native video import exceeds capture limits; use a shorter, smaller video');
    };
    $db->prepare("UPDATE scan_jobs SET stage='Importing video frames with RealityScan' WHERE id=?")->execute([$job['id']]);
    scanNativeRun($native,'import',['-newScene','-importVideo',$source,$native.'/frames',(string)round($info['duration']/60,3),'-save',$native.'/imported.rsproj'],$guard,300);
    $frames=glob($native.'/frames/*.png');
    scanCanStart('uploading',count($frames));
    if (!is_file($native.'/imported.rsproj')) scanFail('RealityScan did not save the imported video project');
    foreach($frames as $frame) scanImageInfo($frame);
    $db->prepare("UPDATE scan_jobs SET stage='Generating AI background masks; review required' WHERE id=?")->execute([$job['id']]);
    scanNativeRun($native,'masks',['-load',$native.'/imported.rsproj','-selectAllImages','-generateAIMasks','-exportMasks',$native.'/masks',str_replace('\\','/',__DIR__).'/realityscan-mask.xml','-save',$native.'/masked.rsproj'],$heartbeat,1200);
    if (!is_file($native.'/masked.rsproj') || count(glob($native.'/masks/*.png'))!==count($frames)) scanFail('RealityScan did not export a matching AI mask for every frame');
    if (!is_dir($dir.'/masks') && !mkdir($dir.'/masks',0700,true)) scanFail('Cannot save AI masks');
    $images=[];
    foreach($frames as $frame) {
        $info=scanImageInfo($frame);$mask=$native.'/masks/'.basename($frame).'.mask.png';
        $maskInfo=scanImageInfo($mask);
        if ($maskInfo['mime']!=='image/png' || $maskInfo['width']!==$info['width'] || $maskInfo['height']!==$info['height']) scanFail('Native mask dimensions do not match the video frame');
        $id=bin2hex(random_bytes(12));$file=$id.'.png';$maskFile=$id.'-'.bin2hex(random_bytes(6)).'.png';
        if (!copy($frame,$dir.'/images/'.$file) || !copy($mask,$dir.'/masks/'.$maskFile)) scanFail('Cannot save imported frames and masks');
        $images[]=array_merge($info,['id'=>$id,'file'=>$file,'name'=>basename($frame),'hash'=>hash_file('sha256',$frame),'maskFile'=>$maskFile,'maskHash'=>hash_file('sha256',$mask),'maskReviewed'=>false]);
    }
    $db->prepare("UPDATE scan_jobs SET images=?,state='uploading',operation='reconstruct',stage='Review every AI mask, then start reconstruction',heartbeat_at=NOW(),completed_at=NULL WHERE id=? AND state='processing'")->execute([json_encode($images,JSON_THROW_ON_ERROR),$job['id']]);
}
function scanNativeReconstruct(PDO $db,array $job,string $dir,array $images,callable $heartbeat): array {
    foreach($images as $index=>$image) {
        $file=sprintf('capture-%06d.', $index).pathinfo($image['file'],PATHINFO_EXTENSION);
        if (!copy($dir.'/input-masks/'.sprintf('capture-%06d.png',$index),$dir.'/input-images/'.$file.'.mask.png')) scanFail('Cannot stage reviewed native masks');
    }
    if (!is_dir($dir.'/crashes')) mkdir($dir.'/crashes',0700,true);
    $db->prepare("UPDATE scan_jobs SET stage='Matching video frames with RealityScan' WHERE id=?")->execute([$job['id']]);
    foreach (['coverage.csv','aligned.rsproj'] as $file) if (is_file($dir.'/'.$file) && !unlink($dir.'/'.$file)) scanFail('Cannot clear prior alignment output');
    scanNativeRun($dir,'align',['-newScene','-addFolder',$dir.'/input-images','-selectAllImages','-editInputSelection','inpMaskOpts=2','-align','-selectMaximalComponent','-exportReport',$dir.'/coverage.csv',str_replace('\\','/',__DIR__).'/realityscan-coverage.txt','false','-save',$dir.'/aligned.rsproj'],$heartbeat,1800);
    $coverage=scanNativeCoverage($dir.'/coverage.csv',count($images),(int)($job['alignment_min_percent'] ?? 80));
    if (!is_file($dir.'/aligned.rsproj')) scanFail('RealityScan did not save camera alignment');
    $db->prepare("UPDATE scan_jobs SET stage='Reconstructing and texturing the masked shoe' WHERE id=?")->execute([$job['id']]);
    scanNativeRun($dir,'model',['-load',$dir.'/aligned.rsproj','-selectMaximalComponent','-setReconstructionRegionAuto','-calculateNormalModel','-simplify','49900','-set','unwrapStyle=MaxTexturesCount','-set','unwrapMaximalTexCount=1','-set','unwrapMaxTexResolution=2048','-calculateTexture','-exportSelectedModel',$dir.'/output/model.obj',str_replace('\\','/',__DIR__).'/realityscan-model.xml','-save',$dir.'/model.rsproj'],$heartbeat,1800);
    if (!is_file($dir.'/output/model.obj')) scanFail('RealityScan produced no exported surface; inspect the local worker log');
    return $coverage;
}

function scanImportAiMasks(array $images,array $paths,string $dir): array {
    $prepared=[];
    foreach (scanUnreviewedImages($images) as $image) {
        $path=$paths[$image['id']] ?? null;
        if (!$path || !is_file($path)) scanFail('AI did not return a mask for every requested photo');
        $info=scanImageInfo($path);
        if ($info['mime']!=='image/png' || $info['width']!==$image['width'] || $info['height']!==$image['height']) scanFail('AI mask dimensions do not match the original photo');
        $prepared[$image['id']]=['path'=>$path,'hash'=>hash_file('sha256',$path)];
    }
    if (!is_dir($dir.'/masks') && !mkdir($dir.'/masks',0700,true)) scanFail('Cannot save AI masks');
    foreach ($images as &$image) if (isset($prepared[$image['id']])) {
        $mask=$prepared[$image['id']];$file=$image['id'].'-'.$mask['hash'].'.png';
        if (!is_file($dir.'/masks/'.$file) && !copy($mask['path'],$dir.'/masks/'.$file)) scanFail('Cannot save AI mask');
        $image['maskFile']=$file;$image['maskHash']=$mask['hash'];$image['maskReviewed']=false;
    }
    unset($image);return $images;
}
function scanNativeMaskPhotos(PDO $db,array $job,array $images,string $dir,callable $heartbeat): void {
    $pending=scanUnreviewedImages($images);
    if (!$pending) scanFail('No unreviewed photos to mask');
    $native=$dir.'/ai-masks-'.bin2hex(random_bytes(6));$paths=[];
    foreach (['images','masks','crashes'] as $folder) if (!mkdir($native.'/'.$folder,0700,true)) scanFail('Cannot prepare AI mask folders');
    foreach ($pending as $image) {
        $name=$image['id'].'.'.pathinfo($image['file'],PATHINFO_EXTENSION);
        if (!copy($dir.'/images/'.$image['file'],$native.'/images/'.$name)) scanFail('Cannot prepare photo for AI masking');
        $paths[$image['id']]=$native.'/masks/'.$name.'.mask.png';
    }
    $db->prepare("UPDATE scan_jobs SET stage=? WHERE id=?")->execute(['Generating AI object masks for '.count($pending).' photos',$job['id']]);
    scanNativeRun($native,'photo-masks',['-newScene','-addFolder',$native.'/images','-selectAllImages','-generateAIMasks','-exportMasks',$native.'/masks',str_replace('\\','/',__DIR__).'/realityscan-mask.xml','-save',$native.'/masked.rsproj'],$heartbeat,1200);
    // Commit mask metadata only after every requested output validates; keep old masks on failure.
    $images=scanImportAiMasks($images,$paths,$dir);
    $db->prepare("UPDATE scan_jobs SET images=?,state='uploading',operation='reconstruct',stage='AI masks ready. Review the overlays before reconstruction.',error_message=NULL,heartbeat_at=NOW(),completed_at=NULL WHERE id=? AND state='processing'")->execute([json_encode($images,JSON_THROW_ON_ERROR),$job['id']]);
}
