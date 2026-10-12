<?php
require_once __DIR__.'/common.php';
scanRequest('POST', function(int $owner) {
    $body = scanJson(); $id = scanId($body['id'] ?? null);
    $db=getDb(); $db->beginTransaction(); $job=scanJob($db,$id,$owner,true);
    if (in_array($job['state'],['queued','processing','ready'],true)) { $db->commit(); jsonResponse(['success'=>true,'job'=>scanPublic($job)]); }
    scanCanStart($job['state'],count($job['images']));
    scanCheckMasks($job['images'],scanJobDir($id).'/masks');
    foreach (['MESHROOM_BATCH','BLENDER_EXE'] as $tool) if (!is_file((string)configValue($tool))) scanFail('Local reconstruction tools are not installed/configured. Ask the owner to finish scanner setup.',503);
    $db->prepare("UPDATE scan_jobs SET state='queued',stage='Waiting for local reconstruction worker' WHERE id=?")->execute([$id]);
    $db->commit(); jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});

