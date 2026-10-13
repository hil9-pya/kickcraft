<?php
require_once __DIR__.'/common.php';
sellerRequest('GET',function(){
 $job=templateScan(sellerText($_GET,'id',1,100));$path=null;$mime=null;
 foreach($job['images'] as $image)if($image['id']===($_GET['image']??'')){$path=scanJobDir($job['id']).'/images/'.$image['file'];$mime=$image['mime'];break;}
 if(!$path||!is_file($path))scanFail('Source photograph not found',404);
 session_write_close();header('Content-Type: '.$mime);header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');header('Content-Length: '.filesize($path));readfile($path);
},'admin');
