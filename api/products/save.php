<?php
require_once __DIR__.'/common.php';
sellerRequest('POST',function($user){
 $body=scanJson();foreach(['glbPath','thumbnailPath','sellerUserId','publicationState','sourceScanId','sourceTemplateId','charmDir','charmOffset','charmsEnabled'] as $key)if(array_key_exists($key,$body))scanFail('Model, ownership and publication fields cannot be supplied here');
 $db=getDb();$db->beginTransaction();$row=productRow(sellerText($body,'id',1,100),(int)$user['id'],true);
 if(array_key_exists('expectedStock',$body) && (!is_int($body['expectedStock']) || $body['expectedStock']!==(int)$row['stock']))scanFail('Stock changed while this editor was open. Refresh the product before saving.',409);
 $name=sellerText($body,'name',2,160);$description=sellerText($body,'description',0,3000);
 $price=$body['price']??null;$stock=filter_var($body['stock']??null,FILTER_VALIDATE_INT);
 if(!is_numeric($price) || !is_finite((float)$price) || (float)$price<=0 || (float)$price>1000000 || $stock===false || $stock<0 || $stock>100000)scanFail('Set a valid price and whole-number stock');
 $sizes=$body['sizes']??[];if(!is_array($sizes) || !array_is_list($sizes) || !$sizes || count($sizes)>11)scanFail('Choose sizes 5–15');
 foreach($sizes as $size)if(!is_int($size) || $size<5 || $size>15)scanFail('Choose sizes 5–15');$sizes=array_values(array_unique($sizes));sort($sizes);
 $parts=json_decode($row['parts'],true);
 if(isset($body['parts'])){
  if(!is_array($body['parts']) || count($body['parts'])!==count($parts))scanFail('Keep the model parts intact');
  $labels=[];foreach($body['parts'] as $part){if(!is_array($part))scanFail('Invalid part label');$labels[$part['id']??'']=sellerText($part,'label',1,80);}
  foreach($parts as &$part){if(!isset($labels[$part['id']]))scanFail('Unknown model part');$part['label']=$labels[$part['id']];}unset($part);
 }
 $colors=$body['colors']??json_decode($row['colors'],true);if(!is_array($colors) || !array_is_list($colors) || !$colors || count($colors)>32)scanFail('Choose 1–32 palette colors');
 $palette=[];foreach($colors as $color){if(!is_array($color) || !preg_match('/^#[0-9a-fA-F]{6}$/D',$color['value']??''))scanFail('Use six-digit color values');$palette[]=['name'=>sellerText($color,'name',1,40),'value'=>strtolower($color['value'])];}
 $db->prepare("UPDATE shoes SET name=?,description=?,price=?,stock=?,status=?,sizes=?,parts=?,colors=?,publication_state='draft',review_note='',reviewer_id=NULL,reviewed_at=NULL WHERE id=? AND seller_user_id=?")->execute([$name,$description,round((float)$price,2),$stock,$stock>0?'available':'out_of_stock',json_encode($sizes),json_encode($parts),json_encode($palette),$row['id'],$user['id']]);
 $db->commit();jsonResponse(['success'=>true,'shoe'=>formatShoeRow(productRow($row['id'],(int)$user['id']))]);
});
