<?php
require_once __DIR__.'/common.php';
scanRequest('POST', function(int $owner) {
    $id=scanId(scanJson()['id'] ?? null);
    $db=getDb(); $db->beginTransaction();
    $job=scanJob($db,$id,$owner,true);
    if (in_array($job['state'],['queued','processing'],true)) scanFail('Wait for reconstruction to finish before starting a new capture',409);
    if (in_array($job['state'],['uploading','ready'],true)) {
        $db->prepare("UPDATE scan_jobs SET state='failed',stage='Capture discarded',error_message='Capture discarded. Start a new capture.',completed_at=NOW() WHERE id=?")->execute([$id]);
    }
    $db->commit();
    jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});
