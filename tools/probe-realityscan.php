<?php
// Experimental comparison only: never queues, finalizes, or publishes a catalog scan.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/process-scans.php';

function realityScanProbeCommands(string $exe,string $video,string $dir,float $interval): array {
    $base=[$exe,'-headless','-silent',$dir.'/crashes','-disableOnlineCommunication','-stdConsole','-set','appQuitOnError=true','-set','suppressErrors=true'];
    $progress=['-writeProgress',$dir.'/progress.txt','5'];
    return [
        'import'=>array_merge($base,$progress,['-newScene','-importVideo',$video,$dir.'/frames',(string)$interval,'-save',$dir.'/imported.rsproj','-quit']),
        'mask'=>array_merge($base,$progress,['-load',$dir.'/imported.rsproj','-selectAllImages','-generateAIMasks','-exportMasks', $dir.'/masks',str_replace('\\','/',__DIR__).'/realityscan-mask.xml','-save',$dir.'/masked.rsproj','-quit']),
        'export'=>array_merge($base,$progress,['-load',$dir.'/masked.rsproj','-exportMasks',$dir.'/masks',str_replace('\\','/',__DIR__).'/realityscan-mask.xml','-quit']),
        'align'=>array_merge($base,$progress,['-load',$dir.'/masked.rsproj','-selectAllImages','-editInputSelection','inpMaskOpts=2','-align','-selectMaximalComponent','-exportReport',$dir.'/coverage.csv',str_replace('\\','/',__DIR__).'/realityscan-coverage.txt','false','-save',$dir.'/aligned.rsproj','-quit']),
        'model'=>array_merge($base,$progress,['-load',$dir.'/aligned.rsproj','-selectMaximalComponent','-setReconstructionRegionAuto','-calculateNormalModel','-simplify','49900','-calculateTexture','-exportSelectedModel',$dir.'/model.obj',str_replace('\\','/',__DIR__).'/realityscan-model.xml','-save',$dir.'/model.rsproj','-quit'])
    ];
}
function realityScanProbeCoverage(int $aligned,int $total): void {
    if ($aligned<30 || $aligned<$total*.8 || $aligned>$total) throw new RuntimeException("Only $aligned of $total frames aligned; require at least 30 and 80%.");
}
function realityScanProbeInputs(int $images,int $masks): void {
    if ($images<30 || $images>120) throw new RuntimeException("Imported $images frames; existing scanner requires 30–120. Inspect native extraction before adjusting interval.");
    if ($masks!==$images) throw new RuntimeException("Exported $masks masks for $images frames; inspect native AI mask exports.");
}
function realityScanProbeMain(array $options): void {
    $exe=$options['exe'] ?? 'C:/Program Files/Epic Games/RealityScan_2.2/RealityScan.exe';
    $video=realpath($options['video'] ?? '');
    if (!$video || !is_file($video) || !is_readable($video)) throw new RuntimeException('Choose a readable local video with --video=ABSOLUTE_PATH.');
    if (filesize($video)<1 || filesize($video)>300*1024*1024) throw new RuntimeException('Video must be at most 300 MB.');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($video);
    if (!in_array($mime,['video/mp4','video/quicktime','video/mpeg','video/x-msvideo','video/x-ms-asf','video/x-ms-wmv'],true)) throw new RuntimeException('Choose a video container supported by native RealityScan import.');
    $trial=$options['trial'] ?? 'trial-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(3));
    if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/D',$trial)) throw new RuntimeException('Use a plain trial name without paths.');
    $interval=filter_var($options['interval'] ?? 1,FILTER_VALIDATE_FLOAT);
    if ($interval===false || !is_finite($interval) || $interval<.1 || $interval>10) throw new RuntimeException('Interval must be 0.1–10 seconds.');
    $stage=$options['stage'] ?? 'import';
    if (!in_array($stage,['import','mask','export','align','model'],true)) throw new RuntimeException('Stage must be import, mask, align, or model.');
    $dir=str_replace('\\','/',scanRoot()).'/realityscan-comparisons/'.$trial;
    $commands=realityScanProbeCommands($exe,str_replace('\\','/',$video),$dir,$interval);
    $manifest=['experimental'=>true,'stage'=>$stage,'trial'=>$trial,'sourceSha256'=>hash_file('sha256',$video),'intervalSeconds'=>$interval,'output'=>$dir];
    if (!isset($options['run'])) {echo json_encode($manifest+['executed'=>false,'installed'=>is_file($exe),'command'=>$commands[$stage]],JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES).PHP_EOL;return;}
    if (!is_file($exe) || strcasecmp(basename($exe),'RealityScan.exe')!==0) throw new RuntimeException('RealityScan.exe is not installed at --exe; install and finish first launch in Epic Games Launcher.');
    $lock='kickcraft-scan-'.substr(hash('sha256',(string)configValue('DB_NAME')),0,32);
    $db=getDb();$stmt=$db->prepare('SELECT GET_LOCK(?,0)');$stmt->execute([$lock]);
    if ((int)$stmt->fetchColumn()!==1) throw new RuntimeException('Existing local scanner worker is busy; retry after it finishes.');
    $started=microtime(true);$prepared=false;
    try {
        if ($stage==='import' && is_dir($dir)) throw new RuntimeException('Trial already exists; use a new --trial name.');
        if ($stage!=='import') {
            $previous=['mask'=>'imported','export'=>'masked','align'=>'masked','model'=>'aligned'][$stage];
            if (!is_file($dir.'/'.$previous.'.rsproj')) throw new RuntimeException('Run the previous stage first, using the same --trial and original video.');
            $previousStage=['mask'=>'import','export'=>'import','align'=>'export','model'=>'align'][$stage];
            $priorFile=$dir.'/'.$previousStage.'.json';
            if (!is_file($priorFile)) throw new RuntimeException('Previous stage has no successful result record.');
            $prior=json_decode(file_get_contents($priorFile),true,512,JSON_THROW_ON_ERROR);
            if (($prior['ok'] ?? false)!==true) throw new RuntimeException('Previous stage failed; inspect its result and use a new trial.');
            if (($prior['sourceSha256'] ?? '')!==$manifest['sourceSha256'] || ($prior['intervalSeconds'] ?? null)!=$interval) throw new RuntimeException('Trial video or interval changed; use the original values or a new trial.');
        }
        if (is_file($dir.'/'.$stage.'.json')) throw new RuntimeException('Stage already recorded; preserve it and use a new trial for another run.');
        foreach (['','/frames','/masks','/crashes'] as $folder) if (!is_dir($dir.$folder) && !mkdir($dir.$folder,0700,true)) throw new RuntimeException('Cannot create private trial directory.');
        $prepared=true;
        $frames=glob($dir.'/frames/*_frame*.png');$masks=glob($dir.'/masks/*.png');
        if ($stage==='mask') realityScanProbeInputs(count($frames),count($frames));
        if (in_array($stage,['align','model'],true)) realityScanProbeInputs(count($frames),count($masks));
        if ($stage==='model') scanNativeCoverage($dir.'/coverage.csv',count($frames));
        scanProcess(scanToolCommand($commands[$stage],$dir,'realityscan-'.$stage),$dir.'/worker.log',function(){},['import'=>300,'mask'=>900,'export'=>120,'align'=>1800,'model'=>3600][$stage]);
        $project=['import'=>'imported','mask'=>'masked','export'=>'masked','align'=>'aligned','model'=>'model'][$stage];
        if (!is_file($dir.'/'.$project.'.rsproj')) throw new RuntimeException('RealityScan exited without the expected project; inspect local logs.');
        $frames=glob($dir.'/frames/*_frame*.png');$masks=glob($dir.'/masks/*.png');
        foreach ($frames as $frame) scanImageInfo($frame);
        $manifest['frames']=count($frames);$manifest['masks']=count($masks);
        if ($stage==='import') realityScanProbeInputs(count($frames),count($frames));
        else realityScanProbeInputs(count($frames),count($masks));
        if (in_array($stage,['align','model'],true)) { $coverage=scanNativeCoverage($dir.'/coverage.csv',count($frames));$manifest['aligned']=$coverage['aligned']; }
        if ($stage==='model') {
            if (!is_file($dir.'/model.obj')) throw new RuntimeException('RealityScan produced no exported surface.');
            scanProcess(scanToolCommand([(string)configValue('BLENDER_EXE'),'--background','--python',__DIR__.'/blender/prepare_scan.py','--',$dir.'/model.obj',$dir.'/preview.glb'],$dir,'blender'),$dir.'/worker.log',function(){},600);
            $manifest['surface']=scanGlbInfo($dir.'/preview.glb');scanSurfaceQuality($manifest['surface']);
        }
        $manifest['ok']=true;
    } catch (Throwable $e) { $manifest['ok']=false;$manifest['error']=$e->getMessage();throw $e; }
    finally {
        $manifest['seconds']=round(microtime(true)-$started,2);
        if ($prepared) file_put_contents($dir.'/'.$stage.'.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
        $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]);
    }
    echo json_encode($manifest,JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR).PHP_EOL;
}
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '')===__FILE__) {
    try {realityScanProbeMain(getopt('',['exe:','video:','trial:','stage:','interval:','run']));}
    catch (Throwable $e) {fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}
}
