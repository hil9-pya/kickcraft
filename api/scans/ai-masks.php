<?php
require_once __DIR__.'/common.php';
scanRequest('POST',function(int $owner) {
    $id=scanId(scanJson()['id'] ?? null);$db=getDb();$db->beginTransaction();$job=scanJob($db,$id,$owner,true);
    if (in_array($job['state'],['queued','processing'],true) && $job['operation']==='mask') {$db->commit();jsonResponse(['job'=>scanPublic($job)]);}
    if ($job['state']!=='uploading') scanFail('AI masks can only be generated before reconstruction',409);
    if (!scanUnreviewedImages($job['images'])) scanFail('All masks are already reviewed. Existing reviewed masks are kept.');
    if (!is_file((string)configValue('REALITYSCAN_EXE'))) scanFail('Local AI background removal is not configured',503);
    $db->prepare("UPDATE scan_jobs SET state='queued',operation='mask',stage='Waiting for AI background removal',error_message=NULL WHERE id=?")->execute([$id]);
    $db->commit();jsonResponse(['job'=>scanPublic(scanJob($db,$id,$owner))]);
});
