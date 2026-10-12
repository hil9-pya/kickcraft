<?php
require_once __DIR__.'/common.php';
sellerRequest('GET',function(){
 $job=productScanJob(sellerText($_GET,'id',1,100));$path=null;$mime=null;
 if(isset($_GET['preview'])&&in_array($job['state'],['ready','finalized'],true)){$path=scanJobDir($job['id']).'/preview.glb';$mime='model/gltf-binary';}
 else foreach($job['images'] as $image)if($image['id']===($_GET['image']??'')){$path=scanJobDir($job['id']).'/images/'.$image['file'];$mime=$image['mime'];break;}
 if(!$path||!is_file($path))scanFail('Capture asset not found',404);
 session_write_close();header('Content-Type: '.$mime);header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');header('Content-Length: '.filesize($path));readfile($path);
},'admin');
