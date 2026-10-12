<?php
require_once __DIR__.'/../sellers/common.php';
sellerRequest('POST',function(){
 $body=scanJson();$name=sellerText($body,'name',2,160);$email=strtolower(sellerText($body,'email',3,254));
 if(!filter_var($email,FILTER_VALIDATE_EMAIL))scanFail('Enter a valid email address');
 $password=$body['password']??null;
 if(!is_string($password) || strlen($password)<10 || strlen($password)>72)scanFail('Password must contain 10–72 bytes');
 if(($body['confirmPassword']??null)!==$password)scanFail('Passwords do not match');
 $profile=sellerProfileInput($body);$db=getDb();$db->beginTransaction();
 $check=$db->prepare('SELECT id FROM users WHERE LOWER(email)=?');$check->execute([$email]);if($check->fetch())scanFail('An account with this email already exists',409);
 try{$db->prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'seller')")->execute([$name,$email,password_hash($password,PASSWORD_BCRYPT)]);}catch(PDOException $e){if($e->getCode()==='23000')scanFail('An account with this email already exists',409);throw $e;}
 $id=(int)$db->lastInsertId();$db->prepare('INSERT INTO seller_profiles(user_id,store_name,description,pickup_address,contact) VALUES(?,?,?,?,?)')->execute(array_merge([$id],$profile));$db->commit();
 jsonResponse(['success'=>true,'user'=>['id'=>$id,'name'=>$name,'email'=>$email,'role'=>'seller'],'seller'=>sellerProfile($id)],201);
},'public');
