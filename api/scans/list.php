<?php
require_once __DIR__.'/common.php';
scanRequest('GET',function(int $owner){
 $stmt=getDb()->prepare("SELECT id FROM scan_jobs j WHERE owner_id=? AND (state IN ('uploading','queued','processing','ready') OR (state='finalized' AND NOT EXISTS (SELECT 1 FROM shoes s WHERE s.glb_path=j.finalized_path AND s.deleted_at IS NULL AND s.permanently_deleted=0))) ORDER BY created_at DESC LIMIT 10");$stmt->execute([$owner]);
 jsonResponse(['jobs'=>array_map(fn($row)=>scanPublic(scanJob(getDb(),$row['id'],$owner)),$stmt->fetchAll())]);
});
