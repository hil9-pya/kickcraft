<?php
// Original KickCraft fixtures only; no cloud calls or paid generation.
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require_once __DIR__.'/../api/products/common.php';session_write_close();
if(configValue('DB_NAME')!=='kickcraft_photo_scan_dev')throw new RuntimeException('Isolated database required');
$keepReview=isset(getopt('',['keep-review'])['keep-review']);
$db=getDb();$checks=0;$users=[];$products=[];$jobs=[];$template=null;
function verifyTemplate($ok,string $message): void {global $checks;if(!$ok)throw new RuntimeException($message);$checks++;}
function templateHttp(string $path,string $cookie='', $body=null): array {
 $h=curl_init('http://localhost:5174/api/'.$path);$headers=['X-Requested-With: KickCraft'];if($body!==null&&!is_array($body))$headers[]='Content-Type: application/json';
 curl_setopt_array($h,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_HEADER=>true,CURLOPT_TIMEOUT=>30,CURLOPT_COOKIE=>$cookie,CURLOPT_HTTPHEADER=>$headers]);
 if($body!==null){curl_setopt($h,CURLOPT_POST,true);curl_setopt($h,CURLOPT_POSTFIELDS,$body);}
 $raw=curl_exec($h);if($raw===false)throw new RuntimeException('Local request failed');$size=curl_getinfo($h,CURLINFO_HEADER_SIZE);preg_match_all('/^Set-Cookie:\s*([^;\r\n]+)/mi',substr($raw,0,$size),$cookies);
 return ['status'=>curl_getinfo($h,CURLINFO_RESPONSE_CODE),'data'=>json_decode(substr($raw,$size),true),'cookie'=>end($cookies[1])?:''];
}
function templatePost(string $path,string $cookie,array $body): array{return templateHttp($path,$cookie,json_encode($body));}
function templateUuid(): string {$hex=bin2hex(random_bytes(16));return substr($hex,0,8).'-'.substr($hex,8,4).'-4'.substr($hex,13,3).'-8'.substr($hex,17,3).'-'.substr($hex,20);}
try {
 $r=templatePost('auth/login.php','',['email'=>configValue('KICKCRAFT_OWNER_EMAIL'),'password'=>configValue('KICKCRAFT_OWNER_PASSWORD')]);verifyTemplate($r['status']===200,'Owner login failed');$admin=$r['cookie'];
 $accounts=[];$password=bin2hex(random_bytes(16));
 foreach([1,2] as $n){
  $email='template-check-'.bin2hex(random_bytes(6)).'@example.com';$r=templatePost('auth/register.php','',['name'=>'Template Check','email'=>$email,'password'=>$password,'confirmPassword'=>$password,'storeName'=>'Original Template Verification '.$n,'description'=>'Original KickCraft test assets only','pickupAddress'=>'Verification Street 12']);
  verifyTemplate($r['status']===201,'Registration failed');$user=(int)$r['data']['user']['id'];$users[]=$user;
  $login=templatePost('auth/login.php','',['email'=>$email,'password'=>$password]);verifyTemplate($login['status']===200,'Seller login failed');$accounts[]=['id'=>$user,'cookie'=>$login['cookie']];
  verifyTemplate(templateHttp('templates/list.php',$login['cookie'])['status']===403,'Pending seller used library');
  verifyTemplate(templatePost('sellers/review.php',$admin,['id'=>$user,'status'=>'approved'])['status']===200,'Approval failed');
 }
 [$a,$b]=$accounts;
 verifyTemplate(templateHttp('templates/list.php')['status']===401,'Guest accessed library');
 $asset=array_merge(productTemplate(),scanCharmAssets([0.02,0.08,0.01],['size'=>0.75,'rotation'=>[20,-30,45]],'template-fit-'.bin2hex(random_bytes(8))));foreach($asset['parts'] as &$part)$part['recolorTexturePath']='/images/kickcraft-one-card.png';unset($part);$job=templateUuid();$jobs[]=$job;$dir=scanJobDir($job);mkdir($dir.'/images',0700,true);
 copy(__DIR__.'/../public/images/kickcraft-one-card.png',$dir.'/images/original.png');$info=scanImageInfo($dir.'/images/original.png');
 $image=array_merge($info,['id'=>'original','file'=>'original.png','name'=>'Original KickCraft fixture']);
 $db->prepare("INSERT INTO scan_jobs(id,owner_id,state,engine,images,finalized_path,finalized_payload) VALUES(?,?,'finalized','template',?,?,?)")->execute([$job,$a['id'],json_encode([$image]),$asset['glbPath'],json_encode(['draft'=>$asset])]);
 $product=productInsert($a['id'],$asset,$job);$products[]=$product['id'];$body=['productId'=>$product['id'],'name'=>'Original reusable KickCraft check','description'=>'Synthetic local workflow verification; not a photographed reconstruction.','allowReuse'=>true];
 verifyTemplate(templatePost('templates/submit.php',$b['cookie'],$body)['status']===404,'Foreign model shared');
 verifyTemplate(templatePost('templates/submit.php',$a['cookie'],array_merge($body,['allowReuse'=>false]))['status']===422,'Sharing allowed without creator permission');
 $r=templatePost('templates/submit.php',$a['cookie'],$body);verifyTemplate($r['status']===201,'Template submission failed: '.json_encode($r['data']));$template=$r['data']['template']['id'];$snapshot=$r['data']['template'];
 verifyTemplate($snapshot['charmDir']===$asset['charmDir'],'Snapshot lost fitted charms');
 verifyTemplate($snapshot['publicationState']==='pending','Template auto-approved');
 verifyTemplate(templatePost('templates/submit.php',$a['cookie'],$body)['data']['template']['id']===$template,'Submission retry duplicated template');
 verifyTemplate($snapshot['glbPath']!==$asset['glbPath'] && hash_file('sha256',__DIR__.'/../public'.$snapshot['glbPath'])===hash_file('sha256',__DIR__.'/../public'.$asset['glbPath']),'Snapshot not independent');
 verifyTemplate(!in_array($template,array_column(templateHttp('templates/list.php',$b['cookie'])['data']['templates'],'id'),true),'Pending template public to other seller');
 verifyTemplate(count(array_unique(array_column($snapshot['parts'],'recolorTexturePath')))===1&&$snapshot['parts'][0]['recolorTexturePath']!==$asset['parts'][0]['recolorTexturePath'],'Neutral texture not snapshotted and shared across regions');
 $request=templateUuid();$jobs[]=$request;$photo=__DIR__.'/../public/images/kickcraft-one-card.png';
 $use=['id'=>$template,'requestId'=>$request,'matches'=>'1','file'=>new CURLFile(realpath($photo),'image/png','my-original-shoe.png')];
 verifyTemplate(templateHttp('templates/use.php',$b['cookie'],$use)['status']===409,'Unapproved template reused');
 verifyTemplate(templatePost('templates/review.php',$a['cookie'],['id'=>$template,'status'=>'approved'])['status']===403,'Creator self-approved');
 verifyTemplate(templatePost('templates/review.php',$admin,['id'=>$template,'status'=>'approved'])['status']===422,'Photo/parts checks bypassed');
 $materials=array_column($snapshot['parts'],'material');
 verifyTemplate(templatePost('templates/review.php',$admin,['id'=>$template,'status'=>'approved','photoReviewed'=>true,'testedParts'=>[$materials[0],$materials[0]]])['status']===422,'Duplicate part counted twice');
 verifyTemplate(templatePost('templates/review.php',$admin,['id'=>$template,'status'=>'approved','photoReviewed'=>true,'testedParts'=>array_slice($materials,0,2)])['status']===200,'Admin template approval failed');
 verifyTemplate(in_array($template,array_column(templateHttp('templates/list.php',$b['cookie'])['data']['templates'],'id'),true),'Approved template missing');
 verifyTemplate(templateHttp('templates/scan.php?id='.$template,$b['cookie'])['status']===403,'Other seller accessed creator photos');
 $review=templateHttp('templates/scan.php?id='.$template,$admin);verifyTemplate($review['status']===200&&count($review['data']['job']['images'])===1,'Admin original comparison missing');
 verifyTemplate(templateHttp('templates/scan-asset.php?id='.$template.'&image=original',$admin)['status']===200,'Admin original photo inaccessible');
 $invalid=$use;$invalid['matches']='0';verifyTemplate(templateHttp('templates/use.php',$b['cookie'],$invalid)['status']===422,'No match confirmation accepted');
 $invalid=$use;unset($invalid['file']);verifyTemplate(templateHttp('templates/use.php',$b['cookie'],$invalid)['status']===400,'Own reference photo not required');
 $r=templateHttp('templates/use.php',$b['cookie'],$use);verifyTemplate($r['status']===201,'Reuse failed: '.json_encode($r['data']));$copy=$r['data']['shoe'];$products[]=$copy['id'];
 verifyTemplate($copy['sellerUserId']===$b['id']&&$copy['publicationState']==='draft'&&$copy['stock']===0&&$copy['sourceTemplateId']===$template,'Reuse copied owner/stock/approval or lost provenance');
 verifyTemplate($copy['charmDir']===$snapshot['charmDir']&&is_file(__DIR__.'/../public'.$copy['charmDir'].'star-charm.glb'),'Template reuse lost fitted charm assets');
 $fit=scanSavedCharm(productRow($copy['id']));verifyTemplate($fit['charmSettings']['size']===0.75&&$fit['charmPoint']===[0.02,0.08,0.01],'Reused charm settings could not reopen');
 verifyTemplate($copy['glbPath']===$snapshot['glbPath']&&$copy['parts']===$snapshot['parts'],'Reuse lost material regions');
 verifyTemplate(templateHttp('templates/use.php',$b['cookie'],$use)['data']['shoe']['id']===$copy['id'],'Retry created duplicate draft');
 verifyTemplate(templateHttp('templates/use.php',$a['cookie'],$use)['status']===409,'Request ID stolen by another account');
 $other=$use;$other['id']='shared-different';verifyTemplate(templateHttp('templates/use.php',$b['cookie'],$other)['status']===409,'Retry changed target template');
 verifyTemplate(!in_array($request,array_column(templateHttp('scans/list.php',$b['cookie'])['data']['jobs'],'id'),true),'Template reference offered as a reconstruction job');
 $own=templateHttp('products/scan.php?id='.$copy['id'],$admin);verifyTemplate($own['status']===200&&$own['data']['job']['images'][0]['name']==='Seller matching-shoe reference','Reused product has no own reference photo');
 verifyTemplate(templateHttp('products/scan-asset.php?id='.$copy['id'].'&image=reference',$a['cookie'])['status']===403,'Creator accessed recipient private photo');
 verifyTemplate(templatePost('templates/submit.php',$b['cookie'],array_merge($body,['productId'=>$copy['id']]))['status']===422,'Derivative re-shared as original');
 verifyTemplate(templatePost('products/save.php',$b['cookie'],['id'=>$copy['id'],'name'=>'Own matched template listing','description'=>'Original KickCraft fixture only.','price'=>1234,'stock'=>1,'sizes'=>[9]])['status']===200,'Reused draft not editable');
 verifyTemplate(templatePost('products/submit.php',$b['cookie'],['id'=>$copy['id']])['status']===200,'Reused draft submission failed');
 verifyTemplate(templatePost('products/review.php',$admin,['id'=>$copy['id'],'status'=>'approved'])['status']===422,'Reused listing bypassed photo comparison');
 verifyTemplate(templatePost('products/review.php',$admin,['id'=>$copy['id'],'status'=>'approved','photoReviewed'=>true])['status']===200,'Normal admin review blocked');
 $db->prepare('UPDATE shoes SET parts=?,deleted_at=NOW() WHERE id=?')->execute(['[]',$product['id']]);
 verifyTemplate(templateHttp('templates/list.php',$b['cookie'])['status']===200&&count(templateHttp('templates/list.php',$b['cookie'])['data']['templates'][0]['parts'])>=2,'Source edit/delete broke immutable template');
 verifyTemplate(templatePost('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'suspended','note'=>'Template suspension check'])['status']===200,'Suspend creator failed');
 verifyTemplate(!in_array($template,array_column(templateHttp('templates/list.php',$b['cookie'])['data']['templates'],'id'),true),'Suspended creator template offered');
 verifyTemplate(templatePost('sellers/review.php',$admin,['id'=>$a['id'],'status'=>'approved'])['status']===200,'Restore creator failed');
 verifyTemplate(templatePost('templates/review.php',$admin,['id'=>$template,'status'=>'rejected','note'=>'Withdraw verification template'])['status']===200,'Withdrawal failed');
 $fresh=$use;$fresh['requestId']=templateUuid();verifyTemplate(templateHttp('templates/use.php',$b['cookie'],$fresh)['status']===409,'Withdrawn template reused');
 verifyTemplate(productRow($copy['id'])['publication_state']==='approved','Withdrawal mutated existing seller listing');
 echo "PASS: $checks shared-template workflow checks\n";
} finally {
 if($db->inTransaction())$db->rollBack();
 if($template&&!$keepReview){
  $db->prepare('DELETE FROM shoe_templates WHERE id=? AND creator_user_id=?')->execute([$template,$a['id']]);
  $paths=[$snapshot['glbPath'],$snapshot['thumbnailPath'],...array_column($snapshot['parts'],'recolorTexturePath')];
  foreach(array_unique($paths) as $path)if(preg_match('~^/(models|images)/uploads/'.preg_quote($template,'~').'[-a-z0-9]*\\.(glb|png)$~D',$path))@unlink(__DIR__.'/../public'.$path);
 }

 foreach($products as $id)$db->prepare('UPDATE shoes SET deleted_at=NOW() WHERE id=?')->execute([$id]);
 foreach($users as $id)$db->prepare('UPDATE users SET deleted_at=NOW() WHERE id=?')->execute([$id]);
 foreach($jobs as $id)$db->prepare("UPDATE scan_jobs SET state='failed',stage='Retired verification' WHERE id=?")->execute([$id]);
 if($keepReview&&$template){
  $db->prepare("UPDATE shoe_templates SET status='pending',review_note='' WHERE id=?")->execute([$template]);
  $db->prepare('UPDATE users SET deleted_at=NULL WHERE id=?')->execute([$a['id']]);
  $db->prepare("UPDATE scan_jobs SET state='finalized' WHERE id=?")->execute([$job]);
  file_put_contents(__DIR__.'/../.local-tools/template-review-fixture.json',json_encode(['template'=>$template,'creator'=>$a['id'],'scan'=>$job]));
 }

}
