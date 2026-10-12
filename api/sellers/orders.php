<?php
require_once __DIR__.'/common.php';
sellerRequest('GET',function($user){
 $stmt=getDb()->prepare('SELECT * FROM reservations WHERE seller_user_id=? AND deleted_at IS NULL AND permanently_deleted=0 ORDER BY created_at DESC');$stmt->execute([$user['id']]);jsonResponse(['reservations'=>array_map('formatReservationRow',$stmt->fetchAll())]);
});
