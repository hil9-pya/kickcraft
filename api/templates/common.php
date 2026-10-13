<?php
require_once __DIR__.'/../products/common.php';
function sharedTemplate(string $id,bool $lock=false): array {
 $stmt=getDb()->prepare('SELECT t.*,sp.store_name,sp.status AS creator_status,u.deleted_at AS creator_deleted,u.permanently_deleted AS creator_removed FROM shoe_templates t JOIN seller_profiles sp ON sp.user_id=t.creator_user_id JOIN users u ON u.id=t.creator_user_id WHERE t.id=?'.($lock?' FOR UPDATE':''));$stmt->execute([$id]);$row=$stmt->fetch();if(!$row)scanFail('Template not found',404);return $row;
}
function templatePublic(array $row): array {
 return array_merge(json_decode($row['asset'],true),['id'=>$row['id'],'name'=>$row['name'],'description'=>$row['description'],'storeName'=>$row['store_name'],'creatorUserId'=>(int)$row['creator_user_id'],'publicationState'=>$row['status'],'reviewNote'=>$row['review_note'],'sourceScanId'=>$row['source_scan_id'],'canReuse'=>templateAvailable($row)]);
}
function templateAvailable(array $row): bool {return $row['status']==='approved' && $row['creator_status']==='approved' && !$row['creator_deleted'] && !$row['creator_removed'];}
function templateFile(string $path,string $extension): string {
 $root=realpath(dirname(__DIR__,2).'/public');$file=realpath($root.$path);
 if(!str_starts_with($path,'/') || !$file || !str_starts_with(strtolower(str_replace('\\','/',$file)),strtolower(str_replace('\\','/',$root)).'/') || strtolower(pathinfo($file,PATHINFO_EXTENSION))!==$extension)scanFail('Template asset missing or invalid',503);
 return $file;
}
function templateSnapshot(array $product,string $id): array {
 $parts=json_decode($product['parts'],true);$model=templateFile($product['glb_path'],'glb');$names=productMaterialNames($model);
 if(count($parts)<2 || count(array_unique(array_column($parts,'material')))!==count($parts))scanFail('Template needs two independently recolorable parts');
 foreach($parts as $part)if(!in_array($part['material']??'',$names,true))scanFail('Template part missing from model');
 $asset=['glbPath'=>$product['glb_path'],'thumbnailPath'=>$product['thumbnail_path'],'parts'=>$parts,'colors'=>json_decode($product['colors'],true),'charmsEnabled'=>(bool)$product['charms_enabled'],'charmOffset'=>$product['charm_offset'],'charmScale'=>$product['charm_scale']];
 $root=dirname(__DIR__,2).'/public';$copies=[];
 $copy=function(string $source,string $kind,string $suffix,string $ext)use($id,$root,&$copies):string {
  $file=templateFile($source,$ext);$directory=$root.'/'.$kind.'/uploads';if(!is_dir($directory) && !mkdir($directory,0755,true))scanFail('Template storage unavailable',503);
  $path='/'.$kind.'/uploads/'.$id.$suffix.'.'.$ext;if(!copy($file,$root.$path))scanFail('Could not save template snapshot',503);$copies[]=$root.$path;return $path;
 };
 try {
  $asset['glbPath']=$copy($asset['glbPath'],'models','','glb');$asset['thumbnailPath']=$copy($asset['thumbnailPath'],'images','-thumb','png');
  $textures=[];foreach($asset['parts'] as &$part)if(isset($part['recolorTexturePath'])){$source=$part['recolorTexturePath'];if(!isset($textures[$source]))$textures[$source]=$copy($source,'images','-neutral-'.count($textures),'png');$part['recolorTexturePath']=$textures[$source];}unset($part);
  return $asset;
 }catch(Throwable $e){foreach($copies as $file)@unlink($file);throw $e;}
}
function templateScan(string $id): array {$row=sharedTemplate($id);return scanJob(getDb(),$row['source_scan_id'],(int)$row['creator_user_id']);}
