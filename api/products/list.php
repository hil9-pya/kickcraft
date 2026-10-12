<?php
require_once __DIR__.'/common.php';
$admin=($_GET['review']??'')==='1';
sellerRequest('GET',function($user)use($admin){
 $stmt=getDb()->prepare('SELECT id FROM shoes WHERE seller_user_id IS NOT NULL AND deleted_at IS NULL AND permanently_deleted=0'.($admin?'':' AND seller_user_id=?').' ORDER BY created_at DESC');$stmt->execute($admin?[]:[$user['id']]);
 jsonResponse(['shoes'=>array_map(fn($r)=>formatShoeRow(productRow($r['id'])),$stmt->fetchAll())]);
},$admin?'admin':'seller');
