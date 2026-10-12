<?php
require_once __DIR__.'/common.php';
sellerRequest('GET',function(){
 $rows=getDb()->query("SELECT user_id FROM seller_profiles sp JOIN users u ON u.id=sp.user_id WHERE u.deleted_at IS NULL AND u.permanently_deleted=0 ORDER BY sp.created_at DESC")->fetchAll();
 jsonResponse(['sellers'=>array_map(fn($r)=>sellerProfile((int)$r['user_id']),$rows)]);
},'admin');
