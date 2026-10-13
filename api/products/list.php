<?php
require_once __DIR__.'/common.php';
$admin=($_GET['review']??'')==='1';$includeArchived=!$admin&&($_GET['include_archived']??'')==='1';
sellerRequest('GET',function($user)use($admin,$includeArchived){
 $stmt=getDb()->prepare('SELECT id FROM shoes WHERE seller_user_id IS NOT NULL AND permanently_deleted=0'.($includeArchived?'':' AND deleted_at IS NULL').($admin?'':' AND seller_user_id=?').' ORDER BY created_at DESC');$stmt->execute($admin?[]:[$user['id']]);
 jsonResponse(['shoes'=>array_map(fn($r)=>formatShoeRow(productRow($r['id'],$admin?null:(int)$user['id'],false,$includeArchived)),$stmt->fetchAll())]);
},$admin?'admin':'seller');
