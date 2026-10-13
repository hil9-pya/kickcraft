<?php
require_once __DIR__.'/common.php';
scanRequest('POST',function(int $owner){
 $body=scanJson();$id=scanId($body['id']??null);$db=getDb();$db->beginTransaction();$job=scanJob($db,$id,$owner,true);
 tripoCaptureEngine($job['engine']);tripoConsent($body);
 if(($job['operation']??'reconstruct')==='mask' && in_array($job['state'],['queued','processing'],true))scanFail('Wait for background removal and review cutouts before generation',409);
 $useMasks=tripoMaskChoice($job,$body);
 if(in_array($job['state'],['queued','processing','ready'],true)){$db->commit();jsonResponse(['success'=>true,'job'=>scanPublic($job)]);}
 tripoKey();tripoViews($job['images']);
 if($job['state']!=='uploading' && !tripoCanResume($job))scanFail('This AI provider job cannot be regenerated. Create a new capture only if another charge is intended.',409);
 if(!is_file(scanJobDir($id).'/tripo-attempt.json'))tripoWrite(scanJobDir($id).'/tripo-options.json',['useMasks'=>$useMasks]);
 $db->prepare("UPDATE scan_jobs SET state='queued',operation='reconstruct',stage='Waiting for photo generation worker',alignment_min_percent=80,error_message=NULL,started_at=NULL,heartbeat_at=NULL,completed_at=NULL WHERE id=?")->execute([$id]);
 $db->commit();jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});
