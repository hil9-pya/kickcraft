<?php
require_once __DIR__.'/common.php';
sellerRequest('GET',function(){
 $id=sellerText($_GET,'id',1,100);$job=scanPublic(templateScan($id));$base='/api/templates/scan-asset.php?id='.rawurlencode($id);
 $job['previewUrl']=null;foreach($job['images'] as &$image){$image['previewUrl']=$base.'&image='.$image['id'];unset($image['maskUrl']);}unset($image);unset($job['draft']);jsonResponse(['job'=>$job]);
},'admin');
