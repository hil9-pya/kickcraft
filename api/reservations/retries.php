<?php
function reservationRetry(PDO $db,string $requestId,string $requestHash): ?array {
 $stmt=$db->prepare('SELECT * FROM reservations WHERE checkout_request_id=? LIMIT 1');$stmt->execute([$requestId]);$row=$stmt->fetch();
 if(!$row)return null;
 if(!hash_equals((string)$row['checkout_request_hash'],$requestHash)){
  if($db->inTransaction())$db->rollBack();jsonError('This checkout request already belongs to different reservation details.',409);
 }
 if($row['deleted_at']!==null || (int)$row['permanently_deleted']!==0){
  if($db->inTransaction())$db->rollBack();jsonError('This checkout was already saved and its reservation was removed. Start a new reservation.',409);
 }
 return $row;
}
