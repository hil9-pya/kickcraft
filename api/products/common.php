<?php
require_once __DIR__.'/../sellers/common.php';
function productRow(string $id,?int $seller=null,bool $lock=false): array {
 $sql='SELECT s.*,sp.store_name AS seller_store_name,sp.pickup_address,sp.contact AS seller_contact FROM shoes s LEFT JOIN seller_profiles sp ON sp.user_id=s.seller_user_id WHERE s.id=? AND s.deleted_at IS NULL AND s.permanently_deleted=0';$params=[$id];
 if($seller!==null){$sql.=' AND s.seller_user_id=?';$params[]=$seller;}
 $stmt=getDb()->prepare($sql.($lock?' FOR UPDATE':''));$stmt->execute($params);$row=$stmt->fetch();if(!$row)scanFail('Product not found',404);return $row;
}
function productParts(): array {
 $names=['upper'=>['Upper','UpperMaterial'],'toe-cap'=>['Toe cap','ToeCapMaterial'],'tongue'=>['Tongue','TongueMaterial'],'laces'=>['Laces','LacesMaterial'],'heel-panel'=>['Heel panel','HeelPanelMaterial'],'side-accents'=>['Side accents','SideAccentsMaterial'],'midsole'=>['Midsole','MidsoleMaterial'],'outsole'=>['Outsole','OutsoleMaterial']];
 $parts=[];foreach($names as $id=>[$label,$material])$parts[]=['id'=>$id,'label'=>$label,'material'=>$material];return $parts;
}
function productTemplate(): array {
 return ['glbPath'=>'/models/shoe-soleview-final.glb','thumbnailPath'=>'/images/kickcraft-one-card.png','parts'=>productParts(),'colors'=>[['name'=>'White','value'=>'#ffffff'],['name'=>'Graphite','value'=>'#292b2d'],['name'=>'Rust','value'=>'#b94d27']],'charmsEnabled'=>true,'charmOffset'=>null,'charmScale'=>'1 1 1'];
}
function productInsert(int $owner,array $asset,?string $scan=null): array {
 $id='seller-'.bin2hex(random_bytes(12));
 getDb()->prepare("INSERT INTO shoes(id,name,description,price,stock,status,glb_path,thumbnail_path,charms_enabled,charm_offset,charm_scale,categories,parts,colors,seller_user_id,publication_state,source_scan_id,sizes) VALUES(?,'Untitled shoe','',1,0,'out_of_stock',?,?,?,?,?,'[\"marketplace\",\"sneakers\"]',?,?,?,'draft',?,'[7,8,9,10,11]')")->execute([$id,$asset['glbPath'],$asset['thumbnailPath'],(int)$asset['charmsEnabled'],$asset['charmOffset']??null,$asset['charmScale']??'1 1 1',json_encode($asset['parts']),json_encode($asset['colors']),$owner,$scan]);
 return formatShoeRow(productRow($id,$owner));
}
function productMaterialNames(string $path): array {
 $info=scanGlbInfo($path,false,false);
 $bytes=file_get_contents($path);$gltf=json_decode(substr($bytes,20,unpack('V',substr($bytes,12,4))[1]),true);
 $stack=$gltf['scenes'][$gltf['scene']??0]['nodes']??[];$seen=[];$materials=[];
 if(!$stack || count($gltf['nodes']??[])>2000)scanFail('GLB needs a valid visible scene');
 while($stack){
  $id=array_pop($stack);if(!is_int($id) || isset($seen[$id]) || !isset($gltf['nodes'][$id]))scanFail('Invalid GLB scene graph');$seen[$id]=true;$node=$gltf['nodes'][$id];
  foreach($node['children']??[] as $child)$stack[]=$child;
  if(isset($node['mesh']))foreach($gltf['meshes'][$node['mesh']]['primitives']??[] as $primitive){$name=$gltf['materials'][$primitive['material']??-1]['name']??'';if($name!=='')$materials[$name]=true;}
 }
 if(count($materials)<2 || count($materials)>16)scanFail('Upload a GLB with 2–16 independently named material regions, or scan photos and paint parts');
 return array_keys($materials);
}
function productCheck(array $row): void {
 if(trim($row['name'])==='' || $row['name']==='Untitled shoe' || trim($row['description'])==='')scanFail('Add a product name and description');
 if((float)$row['price']<=0 || (int)$row['stock']<1)scanFail('Set a price and at least one available pair');
 $sizes=json_decode($row['sizes']??'[]',true);if(!$sizes)scanFail('Choose available sizes');
 $path=dirname(__DIR__,2).'/public'.$row['glb_path'];if(!is_file($path))scanFail('Product model is missing',503);
 $names=productMaterialNames($path);$parts=json_decode($row['parts'],true)?:[];
 if(count($parts)<2)scanFail('Product needs at least two customizable parts');
 foreach($parts as $part)if(!in_array($part['material']??'',$names,true))scanFail('Product part is not present in the model');
 if(!is_file(dirname(__DIR__,2).'/public'.$row['thumbnail_path']))scanFail('Add a product thumbnail');
}

function productScanJob(string $product): array {
 $row=productRow($product);if(!$row['seller_user_id'] || !$row['source_scan_id'])scanFail('Product has no source capture',404);
 return scanJob(getDb(),scanId($row['source_scan_id']),(int)$row['seller_user_id']);
}
