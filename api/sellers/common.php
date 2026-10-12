<?php
require_once __DIR__.'/../scans/common.php';
function sellerRequest(string $method,callable $action,string $access='seller'): never {
 requireMethod($method);
 $user=null;
 if($access==='admin'){requireAdmin();$user=currentSessionUser();}
 elseif($access==='seller')$user=requireApprovedSeller();
 elseif($access==='account'){requireAuth();$user=currentSessionUser();if($user['role']!=='seller')jsonError('Seller account required',403);}
 try {
  if($method==='POST'){
   $allowed=array_map('trim',explode(',',configValue('CORS_ORIGINS')?:'http://localhost:5173,http://127.0.0.1:5173'));
   if(($_SERVER['HTTP_X_REQUESTED_WITH']??'')!=='KickCraft' || (!empty($_SERVER['HTTP_ORIGIN']) && !in_array($_SERVER['HTTP_ORIGIN'],$allowed,true)))scanFail('Untrusted request',403);
  }
  $action($user);
 }catch(Throwable $e){
  if(getDb()->inTransaction())getDb()->rollBack();
  $code=$e instanceof RuntimeException && $e->getCode()>=400 && $e->getCode()<600?$e->getCode():500;
  error_log('Seller request: '.$e->getMessage());jsonError($code===500?'Operation failed. Check local database and storage services.':$e->getMessage(),$code);
 }
 exit;
}
function sellerText(array $body,string $key,int $min,int $max): string {
 $value=$body[$key]??'';
 if(!is_string($value))scanFail('Invalid '.$key);
 $value=trim($value);
 if(mb_strlen($value)<$min || mb_strlen($value)>$max)scanFail($key.' must contain '.$min.'–'.$max.' characters');
 return $value;
}
function sellerProfileInput(array $body): array {
 return [sellerText($body,'storeName',2,160),sellerText($body,'description',0,3000),sellerText($body,'pickupAddress',5,500),sellerText($body,'contact',0,160)];
}
function sellerProfile(int $id): array {
 $stmt=getDb()->prepare('SELECT sp.*,u.name,u.email FROM seller_profiles sp JOIN users u ON u.id=sp.user_id WHERE sp.user_id=? AND u.deleted_at IS NULL AND u.permanently_deleted=0');$stmt->execute([$id]);
 $row=$stmt->fetch();if(!$row)scanFail('Seller not found',404);
 return ['id'=>(int)$row['user_id'],'name'=>$row['name'],'email'=>$row['email'],'storeName'=>$row['store_name'],'description'=>$row['description'],'pickupAddress'=>$row['pickup_address'],'contact'=>$row['contact'],'status'=>$row['status'],'reviewNote'=>$row['review_note'],'tutorialStep'=>(int)$row['tutorial_step'],'createdAt'=>$row['created_at']];
}
