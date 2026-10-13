<?php
function scanCharmSettings($raw): array {
 if($raw===null)return ['size'=>1,'rotation'=>[0,0,0]];
 $value=is_string($raw)?json_decode($raw,true):$raw;
 if(!is_array($value)||!isset($value['size'],$value['rotation'])||!is_int($value['size'])&&!is_float($value['size'])||!is_finite((float)$value['size'])||$value['size']<0.2||$value['size']>3||!is_array($value['rotation'])||!array_is_list($value['rotation'])||count($value['rotation'])!==3)scanFail('Charm size must be 20–300% with three rotation angles.');
 foreach($value['rotation'] as $angle)if((!is_int($angle)&&!is_float($angle))||!is_finite((float)$angle)||abs($angle)>180)scanFail('Charm rotation must be between -180 and 180 degrees.');
 return ['size'=>(float)$value['size'],'rotation'=>array_map('floatval',$value['rotation'])];
}
function scanFitCharm(array $gltf,array $point,array $settings): array {
 [$x,$y,$z]=array_map(fn($angle)=>deg2rad($angle)/2,$settings['rotation']);
 [$a,$b,$c,$d]=[sin($x)*cos($y)*cos($z)+cos($x)*sin($y)*sin($z),cos($x)*sin($y)*cos($z)-sin($x)*cos($y)*sin($z),cos($x)*cos($y)*sin($z)+sin($x)*sin($y)*cos($z),cos($x)*cos($y)*cos($z)-sin($x)*sin($y)*sin($z)];
 foreach($gltf['nodes'] as &$node)if(($node['name']??'')==='CharmRoot'){
  [$e,$f,$g,$h]=$node['rotation']??[0,0,0,1];
  unset($node['matrix']);$node['translation']=$point;
  $node['rotation']=[$a*$h+$d*$e+$b*$g-$c*$f,$b*$h+$d*$f+$c*$e-$a*$g,$c*$h+$d*$g+$a*$f-$b*$e,$d*$h-$a*$e-$b*$f-$c*$g];
  $node['scale']=array_map(fn($v)=>$v*$settings['size'],$node['scale']??[1,1,1]);
  return $gltf;
 }
 scanFail('Local charm attachment metadata unavailable',503);
}
function scanCharmAssets(?array $point,array $settings,string $name): array {
 $asset=['charmsEnabled'=>$point!==null,'charmOffset'=>null,'charmScale'=>'1 1 1','charmDir'=>null];
 if($point===null)return $asset;
 if(!preg_match('/^[a-zA-Z0-9-]+$/D',$name))scanFail('Invalid charm asset name');
 $project=dirname(__DIR__,2).'/public';$asset['charmDir']='/models/uploads/'.$name.'-charms/';$directory=$project.$asset['charmDir'];
 if(!is_dir($directory)&&!mkdir($directory,0755,true))scanFail('Cannot save fitted charms',503);
 // Fitted directories are immutable revisions, so existing orders and templates keep their assets.
 foreach(['star','lightning','k-tag'] as $slug){
  $bytes=file_get_contents($project.'/models/charms/'.$slug.'-charm.glb');$length=unpack('V',substr($bytes,12,4))[1];
  $gltf=scanFitCharm(json_decode(substr($bytes,20,$length),true),$point,$settings);
  $json=json_encode($gltf,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);$json.=str_repeat(' ',(4-strlen($json)%4)%4);$tail=substr($bytes,20+$length);
  $output='glTF'.pack('V4',2,20+strlen($json)+strlen($tail),strlen($json),0x4e4f534a).$json.$tail;
  if(file_put_contents($directory.$slug.'-charm.glb',$output)!==strlen($output))scanFail('Cannot save fitted charm',503);
 }
 if(file_put_contents($directory.'placement.json',json_encode(['point'=>$point,'settings'=>$settings]))===false)scanFail('Cannot save charm settings',503);
 return $asset;
}
function scanSavedCharm(array $row): array {
 $result=['charmPoint'=>null,'charmSettings'=>scanCharmSettings(null)];
 if(!$row['charms_enabled'])return $result;
 $directory=$row['charm_dir']??'';
 if(preg_match('~^/models/uploads/[a-zA-Z0-9-]+-charms/$~D',$directory)){
  $saved=json_decode((string)@file_get_contents(dirname(__DIR__,2).'/public'.$directory.'placement.json'),true);
  if(!is_array($saved)||count($saved['point']??[])!==3)scanFail('Saved charm settings unavailable',503);
  return ['charmPoint'=>$saved['point'],'charmSettings'=>scanCharmSettings($saved['settings'])];
 }
 if($row['charm_offset']){
  $offset=array_map('floatval',preg_split('/\s+/',trim($row['charm_offset'])));$origin=array_map('floatval',explode(' ',scanCharmOffset([0,0,0])));
  $result['charmPoint']=array_map(fn($axis)=>$offset[$axis]-$origin[$axis],[0,1,2]);
 }
 return $result;
}
