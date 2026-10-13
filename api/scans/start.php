<?php
require_once __DIR__.'/common.php';
scanRequest('POST', function(int $owner) {
    $body=scanJson();$id=scanId($body['id'] ?? null);$minimum=scanRetryMinimum($body);
    $db=getDb();$db->beginTransaction();$job=scanJob($db,$id,$owner,true);
    if($job['engine']==='tripo') {
        tripoConsent($body);
        if(($job['operation']??'reconstruct')==='mask' && in_array($job['state'],['queued','processing'],true))scanFail('Wait for background removal and review cutouts before generation',409);
        $useMasks=tripoMaskChoice($job,$body);
    }
    if (in_array($job['state'],['queued','processing','ready'],true)) {
        if ((int)($job['alignment_min_percent'] ?? 80)!==$minimum) scanFail('This scan already started with a different alignment threshold',409);
        $db->commit();jsonResponse(['success'=>true,'job'=>scanPublic($job)]);
    }
    if($job['engine']==='tripo') {
        tripoKey();tripoViews($job['images']);
        if($job['state']!=='uploading' && !tripoCanResume($job))scanFail('This Tripo job cannot be regenerated. Create a new capture only if another charge is intended.',409);
        if(!is_file(scanJobDir($id).'/tripo-attempt.json'))tripoWrite(scanJobDir($id).'/tripo-options.json',['useMasks'=>$useMasks]);
        $db->prepare("UPDATE scan_jobs SET state='queued',operation='reconstruct',stage='Waiting for local Tripo worker',alignment_min_percent=80,error_message=NULL,started_at=NULL,heartbeat_at=NULL,completed_at=NULL WHERE id=?")->execute([$id]);
        $db->commit();jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
    }
    $retry=scanRetryable($job);
    scanCanStart($retry?'uploading':$job['state'],count($job['images']));
    scanCheckMasks($job['images'],scanJobDir($id).'/masks');
    if ($minimum===65 && (!$retry || !scanExperimentalEligible(scanFailedAlignment($job)))) scanFail('Experimental retry requires a failed reconstruction with at least 30 aligned views and 65% to below 80% alignment');
    foreach ([$job['engine']==='realityscan'?'REALITYSCAN_EXE':'MESHROOM_BATCH','BLENDER_EXE'] as $tool) if (!is_file((string)configValue($tool))) scanFail('Local reconstruction tools are not installed/configured. Ask the owner to finish scanner setup.',503);
    $stage=$minimum===65?'Waiting for experimental reconstruction (65% alignment)':'Waiting for local reconstruction worker';
    $db->prepare("UPDATE scan_jobs SET state='queued',operation='reconstruct',stage=?,alignment_min_percent=?,error_message=NULL,output_glb=NULL,started_at=NULL,heartbeat_at=NULL,completed_at=NULL WHERE id=?")->execute([$stage,$minimum,$id]);
    $db->commit();jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});
