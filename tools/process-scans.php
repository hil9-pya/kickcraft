<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__.'/../api/scans/common.php';
if (session_status()===PHP_SESSION_ACTIVE) session_write_close();

function scanStopProcess($process, int $pid): void {
    if (PHP_OS_FAMILY==='Windows' && $pid>0) {
        $kill=proc_open(['C:/Windows/System32/taskkill.exe','/PID',(string)$pid,'/T','/F'],[['pipe','r'],['file','NUL','a'],['file','NUL','a']],$pipes,null,null,['bypass_shell'=>true]);
        if (is_resource($kill)) { fclose($pipes[0]); proc_close($kill); }
    } else proc_terminate($process,9);
}
function scanProcess(array $command, string $log, callable $heartbeat, int $timeout=3600, ?array $environment=null): void {
    if (!is_file($command[0])) throw new RuntimeException('Reconstruction tool is not installed');
    $process=proc_open($command,[['pipe','r'],['file',$log,'a'],['file',$log,'a']],$pipes,null,$environment,['bypass_shell'=>true,'create_process_group'=>true]);
    if (!is_resource($process)) throw new RuntimeException('Cannot start reconstruction tool');
    fclose($pipes[0]); $started=microtime(true); $lastBeat=0; $status=proc_get_status($process);
    try {
        while ($status['running']) {
            if (microtime(true)-$started>$timeout) throw new RuntimeException('Reconstruction exceeded its time limit. Reduce photo resolution and recapture with better coverage.');
            if (microtime(true)-$lastBeat>5) { $heartbeat(); $lastBeat=microtime(true); }
            usleep(200000); $status=proc_get_status($process);
        }
        if ($status['exitcode']!==0) throw new RuntimeException('Reconstruction tool exited with code '.$status['exitcode']);
    } finally {
        if ($status['running']) scanStopProcess($process,$status['pid']);
        proc_close($process);
    }
}
function scanToolCommand(array $command,string $dir,string $name): array {
    if (!is_file($command[0])) throw new RuntimeException('Reconstruction tool is not installed');
    if (PHP_OS_FAMILY!=='Windows') return $command;
    $argumentsFile=$dir.'/'.$name.'-arguments.json';
    if (file_put_contents($argumentsFile,json_encode(array_slice($command,1),JSON_THROW_ON_ERROR))===false) throw new RuntimeException('Cannot save tool arguments');
    return [getenv('SystemRoot').'/System32/WindowsPowerShell/v1.0/powershell.exe','-NoProfile','-NonInteractive','-File',__DIR__.'/run-scan-tool.ps1','-Executable',$command[0],'-ArgumentsFile',$argumentsFile,'-LogPrefix',$dir.'/'.$name,'-WorkerPid',(string)getmypid()];
}
function scanStageCapture(array $images,string $dir): void {
 foreach(['input-images','input-masks'] as $folder)if(!is_dir($dir.'/'.$folder)&&!mkdir($dir.'/'.$folder,0700,true))throw new RuntimeException('Cannot stage reconstruction inputs');
 foreach($images as $index=>$image){
  $name=sprintf('capture-%06d',$index);$extension=pathinfo($image['file'],PATHINFO_EXTENSION);
  if(!copy($dir.'/images/'.$image['file'],$dir.'/input-images/'.$name.'.'.$extension) || !copy($dir.'/masks/'.$image['maskFile'],$dir.'/input-masks/'.$name.'.png'))throw new RuntimeException('Cannot stage a capture and matching mask');
 }
}
function scanMaskedPipeline(string $meshroom,string $dir): string {
    $template=dirname($meshroom).'/aliceVision/share/meshroom/photogrammetry.mg';
    if (!is_file($template)) throw new RuntimeException('Install the complete Meshroom 2025.1 photogrammetry runtime');
    $pipeline=json_decode(file_get_contents($template),true,512,JSON_THROW_ON_ERROR);
    foreach (['CameraInit_1','PrepareDenseScene_1','Texturing_1','MeshFiltering_1'] as $node) if (!isset($pipeline['graph'][$node])) throw new RuntimeException('Unsupported Meshroom photogrammetry pipeline');
    // Stable capture IDs keep random storage filenames from changing camera-matching order.
    $pipeline['graph']['CameraInit_1']['inputs']['viewIdMethod']='filename';
    $pipeline['graph']['CameraInit_1']['inputs']['viewIdRegex']='capture-([0-9]+)';
    // Keep stationary background features for camera calibration; mask only dense geometry.
    $pipeline['graph']['PrepareDenseScene_1']['inputs']['masksFolders']=[$dir.'/input-masks'];
    $pipeline['header']['nodesVersions']['MeshMasking']='1.1';
    $pipeline['graph']['MeshMasking_1']=['nodeType'=>'MeshMasking','position'=>[1900,0],'inputs'=>[
        'input'=>'{Meshing_1.output}','inputMesh'=>'{MeshFiltering_1.outputMesh}',
        'masksFolders'=>[$dir.'/input-masks'],'undistortMasks'=>true,'threshold'=>2]];
    $pipeline['graph']['Texturing_1']['inputs']['inputMesh']='{MeshMasking_1.outputMesh}';
    foreach ($pipeline['graph'] as &$node) if (empty($node['inputs'])) $node['inputs']=(object)[];
    unset($node);
    $path=$dir.'/masked-photogrammetry.mg';
    if (file_put_contents($path,json_encode($pipeline,JSON_THROW_ON_ERROR))===false) throw new RuntimeException('Cannot save masked reconstruction pipeline');
    return $path;
}
function scanCameraCoverage(string $path,int $total): array {
    $cameras=json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
    $poses=array_fill_keys(array_column($cameras['poses'] ?? [],'poseId'),true);
    $intrinsics=array_fill_keys(array_column($cameras['intrinsics'] ?? [],'intrinsicId'),true);
    $aligned=[];
    foreach ($cameras['views'] ?? [] as $view) if (isset($poses[$view['poseId'] ?? ''],$intrinsics[$view['intrinsicId'] ?? ''])) $aligned[$view['viewId']]=true;
    $count=count($aligned);
    if ($count<30 || $count<$total*.8) scanFail('Only '.$count.' of '.$total.' photos aligned. Recapture sharp overlapping views from all sides; at least 30 and 80% must align.');
    return ['aligned'=>$count,'total'=>$total];
}
function scanWorkerOnce(PDO $db): bool {
    $lock='kickcraft-scan-'.substr(hash('sha256',(string)configValue('DB_NAME')),0,32);
    $stmt=$db->prepare('SELECT GET_LOCK(?,0)'); $stmt->execute([$lock]);
    if ((int)$stmt->fetchColumn()!==1) return false;
    $job=null;
    try {
        $db->exec("UPDATE scan_jobs SET state='failed',stage='Processing interrupted',error_message='Worker stopped responding; inspect its local log and create a new scan.' WHERE state='processing' AND heartbeat_at<DATE_SUB(NOW(),INTERVAL 5 MINUTE)");
        $db->beginTransaction();
        $job=$db->query("SELECT * FROM scan_jobs WHERE state='queued' ORDER BY created_at LIMIT 1 FOR UPDATE")->fetch();
        if (!$job) { $db->commit(); return false; }
        $db->prepare("UPDATE scan_jobs SET state='processing',stage='Matching photographs and reconstructing surfaces',started_at=NOW(),heartbeat_at=NOW(),error_message=NULL WHERE id=?")->execute([$job['id']]);
        $db->commit();
        $dir=scanJobDir($job['id']); $started=microtime(true);
        $images=json_decode($job['images'],true,512,JSON_THROW_ON_ERROR);
        scanCheckMasks($images,$dir.'/masks');
        scanStageCapture($images,$dir);
        foreach (['cache','output'] as $folder) if (!is_dir($dir.'/'.$folder)) mkdir($dir.'/'.$folder,0700,true);
        $heartbeat=function() use($db,$job) {
            $stmt=$db->prepare("UPDATE scan_jobs SET heartbeat_at=NOW() WHERE id=? AND state='processing'"); $stmt->execute([$job['id']]);
            if (!$stmt->rowCount()) {
                $state=$db->prepare('SELECT state FROM scan_jobs WHERE id=?'); $state->execute([$job['id']]);
                if ($state->fetchColumn()!=='processing') throw new RuntimeException('Scan is no longer processing');
            }
        };
        $meshroom = (string)configValue('MESHROOM_BATCH');
        $toolRoot = dirname($meshroom);
        $environment = getenv();
        // Meshroom 2025 ignores --cache; TEMP/TMP isolate its actual MeshroomCache folder.
        $environment['TEMP'] = $environment['TMP'] = $dir.'/cache';
        $command=[$meshroom,'-i',$dir.'/input-images','-p',scanMaskedPipeline($meshroom,$dir),'-o',$dir.'/output','-s',$dir.'/project.mg','--cache',$dir.'/cache','--paramOverrides','ImageMatching:method=Exhaustive','Texturing:textureSide=2048'];
        if (PHP_OS_FAMILY==='Windows') {
            if (str_contains($toolRoot,' ')) throw new RuntimeException('Install Meshroom at a path without spaces, or configure a space-free directory junction.');
        }
        $command=scanToolCommand($command,$dir,'meshroom');
        scanProcess($command,$dir.'/worker.log',$heartbeat,3600,$environment);
        $cameraFiles=glob($dir.'/cache/MeshroomCache/StructureFromMotion/*/cameras.sfm');
        if (count($cameraFiles)!==1) throw new RuntimeException('Reconstruction did not produce an unambiguous camera alignment report');
        $coverage=scanCameraCoverage($cameraFiles[0],count($images));
        $objects=glob($dir.'/output/*.obj');
        if (!$objects) throw new RuntimeException('Reconstruction produced no surface. Check the worker log and capture coverage before trying again.');
        $db->prepare("UPDATE scan_jobs SET stage='Preparing textured 3D preview',heartbeat_at=NOW() WHERE id=?")->execute([$job['id']]);
        $remaining=max(1,3600-(int)(microtime(true)-$started));
        scanProcess(scanToolCommand([(string)configValue('BLENDER_EXE'),'--background','--python',__DIR__.'/blender/prepare_scan.py','--',$objects[0],$dir.'/preview.glb'],$dir,'blender'), $dir.'/worker.log', $heartbeat,$remaining);
        if (!is_file($dir.'/preview.glb')) throw new RuntimeException('No prepared model was produced');
        scanSurfaceQuality(scanGlbInfo($dir.'/preview.glb'));
        $db->prepare("UPDATE scan_jobs SET state='ready',stage=?,output_glb='preview.glb',heartbeat_at=NOW(),completed_at=NOW() WHERE id=? AND state='processing'")->execute([$coverage['aligned'].' of '.$coverage['total'].' photos aligned. Compare shape and details with your photographs.',$job['id']]);
        return true;
    } catch(Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        if ($job) {
            error_log('Scan worker '.$job['id'].': '.$e->getMessage());
            $message=$e instanceof PDOException ? 'Database operation failed during reconstruction' : $e->getMessage();
            $db->prepare("UPDATE scan_jobs SET state='failed',stage='Reconstruction failed',error_message=?,completed_at=NOW() WHERE id=?")->execute([mb_substr($message,0,500),$job['id']]);
        } else throw $e;
        return true;
    } finally { $db->prepare('SELECT RELEASE_LOCK(?)')->execute([$lock]); }
}
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '')===__FILE__) {
    $once=in_array('--once',$argv,true);
    do { $worked=scanWorkerOnce(getDb()); if (!$worked && !$once) sleep(2); } while (!$once);
}



