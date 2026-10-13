<?php
require_once __DIR__.'/common.php';
scanRequest('POST', function(int $owner) {
    $engine=scanJson()['engine'] ?? 'meshroom';
    if (!in_array($engine,['meshroom','realityscan','tripo'],true)) scanFail('Unknown scan engine',400);
    if ($engine==='realityscan' && !is_file((string)configValue('REALITYSCAN_EXE'))) scanFail('Local RealityScan is not configured',503);
    if($engine==='tripo' && !tripoConfigured())scanFail('AI provider is not configured on the local worker',503);
    $db = getDb();
    $db->beginTransaction();
    $db->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE')->execute([$owner]);
    $count = $db->prepare("SELECT COUNT(*) FROM scan_jobs WHERE owner_id = ? AND state IN ('uploading','queued','processing','ready')");
    $count->execute([$owner]);
    if ($count->fetchColumn() >= 10) scanFail('Finish existing scans before creating more', 429);
    $hex = bin2hex(random_bytes(16));
    $id = substr($hex,0,8).'-'.substr($hex,8,4).'-4'.substr($hex,13,3).'-8'.substr($hex,17,3).'-'.substr($hex,20);
    $dir = scanJobDir($id);
    if (!@mkdir($dir.'/images',0700,true)) scanFail('Cannot create private scan folder',503);
    $db->prepare("INSERT INTO scan_jobs (id,owner_id,images,engine) VALUES (?,?,'[]',?)")->execute([$id,$owner,$engine]);
    $db->commit();
    jsonResponse(['success'=>true,'job'=>scanPublic(scanJob($db,$id,$owner))],201);
});

