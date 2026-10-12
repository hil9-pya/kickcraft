<?php
require_once __DIR__.'/common.php';
scanRequest('GET', function(int $owner) {
    $db=getDb(); $id=scanId($_GET['id'] ?? null);
    $db->prepare("UPDATE scan_jobs SET state='failed',stage='Processing interrupted',error_message='Local worker stopped responding. Start a new scan after checking the worker.' WHERE id=? AND owner_id=? AND state='processing' AND heartbeat_at < DATE_SUB(NOW(),INTERVAL 5 MINUTE)")->execute([$id,$owner]);
    jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))]);
});

