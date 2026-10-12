<?php
require_once __DIR__.'/common.php';
scanRequest('GET', function(int $owner) {
    $id=scanId($_GET['id'] ?? null); $job=scanJob(getDb(),$id,$owner); $path=null; $mime=null;
    if (isset($_GET['preview']) && in_array($job['state'],['ready','finalized'],true)) {
        $path=scanJobDir($id).'/preview.glb'; $mime='model/gltf-binary';
    } else foreach ($job['images'] as $image) {
        if ($image['id']===($_GET['mask'] ?? '') && !empty($image['maskFile'])) { $path=scanJobDir($id).'/masks/'.$image['maskFile']; $mime='image/png'; break; }
        if ($image['id']===($_GET['image'] ?? '')) { $path=scanJobDir($id).'/images/'.$image['file']; $mime=$image['mime']; break; }
    }
    if (!$path || !is_file($path)) scanFail('Asset not found',404);
    header('Content-Type: '.$mime); header('X-Content-Type-Options: nosniff'); header('Cache-Control: private, no-store'); header('Content-Length: '.filesize($path)); readfile($path);
});

