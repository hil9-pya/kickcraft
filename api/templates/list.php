<?php
require_once __DIR__.'/common.php';
$admin=($_GET['review']??'')==='1';
sellerRequest('GET',function($user)use($admin){
 $stmt=getDb()->prepare('SELECT id FROM shoe_templates ORDER BY created_at DESC');$stmt->execute();$templates=[];
 foreach($stmt->fetchAll() as $entry){$row=sharedTemplate($entry['id']);if($admin || (int)$row['creator_user_id']===(int)$user['id'] || templateAvailable($row))$templates[]=templatePublic($row);}
 jsonResponse(['templates'=>$templates]);
},$admin?'admin':'seller');
