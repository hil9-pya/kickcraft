<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../helpers.php';

function scanFail(string $message, int $status = 422): never { throw new RuntimeException($message, $status); }
function scanId($id): string {
    if (!is_string($id) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/D', $id)) scanFail('Invalid scan ID', 400);
    return $id;
}
function scanRoot(): string {
    $root = rtrim((string)configValue('SCAN_STORAGE'), '/\\');
    if ($root === '' || !preg_match('~^(?:[A-Za-z]:[/\\\\]|/)~', $root)) scanFail('Configure private SCAN_STORAGE before scanning', 503);
    if (!is_dir($root) && !@mkdir($root, 0700, true)) scanFail('Private scan storage is unavailable', 503);
    $real = realpath($root);
    $project = realpath(__DIR__ . '/../..');
    $web = realpath($_SERVER['DOCUMENT_ROOT'] ?? __DIR__ . '/../../public');
    foreach ([$project, $web] as $publicRoot) {
        if ($publicRoot && str_starts_with(strtolower(str_replace('\\', '/', $real)) . '/', strtolower(str_replace('\\', '/', $publicRoot)) . '/')) scanFail('SCAN_STORAGE must be outside the web project', 503);
    }
    return $real;
}
function scanJobDir(string $id): string { return scanRoot() . DIRECTORY_SEPARATOR . scanId($id); }
function scanImageInfo(string $path): array {
    $bytes = is_file($path) ? filesize($path) : 0;
    if ($bytes > 10 * 1024 * 1024) scanFail('Each photo must be at most 10 MB', 413);
    $info = $bytes > 0 ? @getimagesize($path) : false;
    $mime = $info['mime'] ?? '';
    if (!$info || !in_array($mime, ['image/jpeg', 'image/png'], true) || (new finfo(FILEINFO_MIME_TYPE))->file($path) !== $mime) scanFail('Use a valid JPG or PNG photo', 415);
    if ($info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > 24000000) scanFail('Photo must be at most 24 megapixels');
    $data = file_get_contents($path);
    if ($mime === 'image/jpeg' && !str_ends_with(rtrim($data,"\0\r\n\t "), "\xff\xd9")) scanFail('Photo is damaged or incomplete');
    if ($mime === 'image/png') {
        $offset = 8; $ended = false;
        while ($offset + 12 <= $bytes) {
            $length = unpack('N',substr($data,$offset,4))[1];
            if ($length > $bytes-$offset-12) scanFail('Photo is damaged or incomplete');
            $chunk = substr($data,$offset+4,$length+4);
            if (hash('crc32b',$chunk,true) !== substr($data,$offset+8+$length,4)) scanFail('Photo is damaged or incomplete');
            $offset += $length+12;
            if (substr($chunk,0,4)==='IEND') { $ended=true; break; }
        }
        if (!$ended || $offset !== $bytes) scanFail('Photo is damaged or incomplete');
    }
    $orientation=1;$cameraMetadata=false;
    if ($mime==='image/jpeg' && function_exists('exif_read_data')) {
        $exif=@exif_read_data($path,null,true);
        $orientation=(int)($exif['IFD0']['Orientation'] ?? 1);
        $cameraMetadata=isset($exif['EXIF']['FocalLength']) || isset($exif['EXIF']['FocalLengthIn35mmFilm']);
        if ($orientation<1 || $orientation>8) $orientation=1;
    }
    return ['width'=>$info[0], 'height'=>$info[1], 'bytes'=>$bytes, 'mime'=>$mime, 'orientation'=>$orientation,'cameraMetadata'=>$cameraMetadata];
}
function scanMaskInfo(string $path,int $width,int $height): array {
    $info=scanImageInfo($path);
    if ($info['mime']!=='image/png' || $info['width']!==$width || $info['height']!==$height) scanFail('Mask must match the original photo dimensions');
    $bytes=file_get_contents($path);
    // Browser encoder writes 8-bit grayscale, no interlace, and unfiltered rows.
    if (substr($bytes,24,5)!=="\x08\x00\x00\x00\x00") scanFail('Use a mask saved by the photo editor');
    $at=8; $compressed='';
    while ($at<strlen($bytes)) {
        $length=unpack('N',substr($bytes,$at,4))[1];
        if (substr($bytes,$at+4,4)==='IDAT') $compressed.=substr($bytes,$at+8,$length);
        $at+=$length+12;
    }
    $expected=($width+1)*$height;
    $pixels=@gzuncompress($compressed,$expected+1);
    if ($pixels===false || strlen($pixels)!==$expected) scanFail('Mask pixels are damaged');
    $foreground=0;
    for ($y=0;$y<$height;$y++) {
        $at=$y*($width+1);
        if ($pixels[$at]!=="\0") scanFail('Use a mask saved by the photo editor');
        $row=substr($pixels,$at+1,$width);
        if (strspn($row,"\0\xff")!==$width) scanFail('Mask must contain only shoe and background pixels');
        $foreground+=substr_count($row,"\xff");
    }
    if ($foreground===0 || $foreground===$width*$height) scanFail('Mask must keep the shoe and remove some background');
    return ['foreground'=>$foreground];
}
function scanCheckMasks(array $images,string $folder): void {
    foreach ($images as $image) {
        $file=$image['maskFile'] ?? '';
        if (empty($image['maskReviewed']) || !$file || basename($file)!==$file || !is_file($folder.'/'.$file) || hash_file('sha256',$folder.'/'.$file)!==($image['maskHash'] ?? '')) scanFail('Review and save a background mask for every photo before reconstruction');
    }
}
function scanCanStart(string $state, int $count): void {
    if ($state !== 'uploading') scanFail('This scan has already started', 409);
    if ($count < 30 || $count > 120) scanFail('Submit 30–120 overlapping photos');
}
function scanRetryMinimum(array $body): int {
    if (array_key_exists('experimental',$body) && !is_bool($body['experimental'])) scanFail('Experimental retry must be an explicit boolean',400);
    return ($body['experimental'] ?? false) ? 65 : 80;
}
function scanRetryable(array $job): bool {
    if(($job['engine']??'meshroom')==='tripo')return tripoCanResume($job);
    return $job['state']==='failed' && $job['stage']==='Reconstruction failed' && ($job['operation'] ?? 'reconstruct')==='reconstruct';
}
function scanRequireAlignment(array $coverage,int $minimum=80): array {
    if (!in_array($minimum,[65,80],true)) scanFail('Unsupported alignment threshold');
    ['aligned'=>$aligned,'total'=>$total]=$coverage;
    if ($total<1 || $aligned<0 || $aligned>$total) scanFail('Invalid camera alignment report');
    if ($aligned<30 || $aligned*100<$total*$minimum) scanFail("Only $aligned of $total photos aligned. Recapture sharp overlapping views from all sides; at least 30 and $minimum% must align.");
    return $coverage;
}
function scanReadNativeAlignment(string $path,int $total): array {
    $report=is_file($path)?trim(file_get_contents($path)):'';
    if (!preg_match('/^(\d+),(\d+)$/D',$report,$match) || (int)$match[2]!==$total || (int)$match[1]>$total) scanFail('RealityScan produced no valid camera alignment report');
    return ['aligned'=>(int)$match[1],'total'=>$total];
}
function scanReadCameraAlignment(string $path,int $total): array {
    if (!is_file($path)) scanFail('Camera alignment report is unavailable');
    $cameras=json_decode(file_get_contents($path),true,512,JSON_THROW_ON_ERROR);
    if (!is_array($cameras) || count($cameras['views'] ?? [])!==$total) scanFail('Camera alignment report does not match saved photos');
    $poses=array_fill_keys(array_column($cameras['poses'] ?? [],'poseId'),true);
    $intrinsics=array_fill_keys(array_column($cameras['intrinsics'] ?? [],'intrinsicId'),true);
    $aligned=[];
    foreach ($cameras['views'] ?? [] as $view) if (isset($view['viewId'],$poses[$view['poseId'] ?? ''],$intrinsics[$view['intrinsicId'] ?? ''])) $aligned[$view['viewId']]=true;
    return ['aligned'=>count($aligned),'total'=>$total];
}
function scanFailedAlignment(array $job): ?array {
    if(($job['engine']??'meshroom')==='tripo')return null;
    if (!scanRetryable($job)) return null;
    try {
        $dir=scanJobDir($job['id']);$total=count($job['images']);
        if (($job['engine'] ?? 'meshroom')==='realityscan') return scanReadNativeAlignment($dir.'/coverage.csv',$total);
        $reports=glob($dir.'/cache/MeshroomCache/StructureFromMotion/*/cameras.sfm');
        return count($reports)===1 ? scanReadCameraAlignment($reports[0],$total) : null;
    } catch (Throwable $e) {return null;}
}
function scanExperimentalEligible(?array $coverage): bool {
    return $coverage && $coverage['aligned']>=30 && $coverage['aligned']*100>=$coverage['total']*65 && $coverage['aligned']*100<$coverage['total']*80;
}
function scanJob(PDO $db, string $id, int $owner, bool $lock = false): array {
    $stmt = $db->prepare('SELECT * FROM scan_jobs WHERE id = ? AND owner_id = ?' . ($lock ? ' FOR UPDATE' : ''));
    $stmt->execute([scanId($id), $owner]);
    $job = $stmt->fetch();
    if (!$job) scanFail('Scan not found', 404);
    $job['images'] = json_decode($job['images'], true, 512, JSON_THROW_ON_ERROR);
    return $job;
}
function scanPublic(array $job): array {
    $id = $job['id'];
    $public = ['operation'=>$job['operation']??'reconstruct','engine'=>$job['engine'] ?? 'meshroom','id'=>$id, 'state'=>$job['state'], 'stage'=>$job['stage'], 'error'=>$job['error_message'],
        'imageCount'=>count($job['images']), 'createdAt'=>$job['created_at'], 'updatedAt'=>$job['updated_at'],
        'previewUrl'=>in_array($job['state'], ['ready','finalized'], true) ? '/api/scans/asset.php?id='.$id.'&preview=1' : null,
        'maskCount'=>count(array_filter($job['images'],fn($image)=>!empty($image['maskFile']) && !empty($image['maskReviewed']))),
        'images'=>array_map(fn($image)=>array_merge(array_intersect_key($image, array_flip(['id','name','width','height','bytes','orientation','maskReviewed','cameraMetadata','view'])), ['previewUrl'=>'/api/scans/asset.php?id='.$id.'&image='.$image['id'], 'maskUrl'=>empty($image['maskFile']) ? null : '/api/scans/asset.php?id='.$id.'&mask='.$image['id'].'&v='.$image['maskHash']]), $job['images'])];
    $public['alignmentMinPercent']=(int)($job['alignment_min_percent'] ?? 80);
    $public['canRetry']=false;
    if(($job['engine']??'meshroom')==='tripo'){$public['canRetry']=tripoCanResume($job);$public['generationCredits']=TRIPO_SCAN_CREDITS;try{$public['tripoTaskSaved']=isset(tripoRecord(scanJobDir($id).'/tripo-task.json')['task_id']);$public['tripoUseMasks']=tripoRecord(scanJobDir($id).'/tripo-options.json')['useMasks']??null;}catch(Throwable $e){$public['tripoTaskSaved']=false;}}
    $public['alignment']=scanFailedAlignment($job);
    $public['canExperimentalRetry']=false;
    $video=json_decode($job['input_video'] ?? 'null',true);
    if ($video) $public['video']=array_intersect_key($video,array_flip(['key','name','received','total','width','height','duration']));
    if ($job['state']==='finalized') $public['draft']=json_decode($job['finalized_payload'],true)['draft'] ?? null;
    return $public;
}
function scanRequest(string $method, callable $action): never {
    requireMethod($method);
    $owner = (int)requireScanAccess()['id'];
    session_write_close();
    try {
        if ($method === 'POST') {
            $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
            $allowed = array_map('trim', explode(',', configValue('CORS_ORIGINS') ?: 'http://localhost:5173,http://127.0.0.1:5173'));
            if (($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'KickCraftScan' || ($origin !== '' && !in_array($origin, $allowed, true))) scanFail('Untrusted scan request', 403);
        }
        $action($owner);
    } catch (Throwable $e) {
        $db = getDb();
        if ($db->inTransaction()) $db->rollBack();
        $status = $e instanceof RuntimeException && is_int($e->getCode()) && $e->getCode() >= 400 && $e->getCode() < 600 ? $e->getCode() : 500;
        error_log('Scan request: ' . $e->getMessage());
        jsonError($status === 500 ? 'Scan operation failed. Check local storage and database services.' : $e->getMessage(), $status);
    }
    exit;
}
function scanJson(): array {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '{}', true);
    if (!is_array($body) || json_last_error() !== JSON_ERROR_NONE) scanFail('Invalid JSON body', 400);
    return $body;
}
function scanCharmOffset(?array $point): ?string {
    if ($point===null) return null;
    // Existing charm GLBs contain the original shoe's baked anchor translation.
    $bytes=@file_get_contents(dirname(__DIR__,2).'/public/models/charms/star-charm.glb');
    if (!$bytes || strlen($bytes)<20) scanFail('Local charm placement metadata is unavailable',503);
    $json=json_decode(substr($bytes,20,unpack('V',substr($bytes,12,4))[1]),true);
    foreach ($json['nodes'] ?? [] as $node) {
        if (($node['name'] ?? '')!=='CharmRoot') continue;
        $origin=$node['translation'] ?? null;
        if (is_array($origin) && count($origin)===3) return implode(' ',array_map(fn($axis)=>(float)$point[$axis]-(float)$origin[$axis],[0,1,2]));
    }
    scanFail('Local charm placement metadata is unavailable',503);
}
function scanUploadFile(string $key): string {
    $file = $_FILES[$key] ?? null;
    if (!$file) scanFail('Choose a file', 400);
    if (in_array($file['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) scanFail('Upload exceeds server size limit', 413);
    if ($file['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) scanFail('Upload did not finish', 400);
    return $file['tmp_name'];
}
function scanGlbInfo(string $path, bool $requireRegions = false, bool $requireTexture = true): array {
    if (!is_file($path) || !is_readable($path)) scanFail('Prepared model is unavailable; check private storage or recapture.',503);
    $bytes = filesize($path);
    if ($bytes < 20 || $bytes > 20 * 1024 * 1024) scanFail('GLB must be valid and at most 20 MB');
    $data = file_get_contents($path);
    $header = unpack('a4magic/Vversion/Vlength/VjsonLength/VjsonType', substr($data, 0, 20));
    if ($header['magic'] !== 'glTF' || $header['version'] !== 2 || $header['length'] !== $bytes || $header['jsonType'] !== 0x4e4f534a || $header['jsonLength'] > $bytes - 20) scanFail('Invalid GLB header');
    $json = json_decode(substr($data, 20, $header['jsonLength']), true);
    if (!is_array($json) || ($json['asset']['version'] ?? '') !== '2.0' || !empty($json['extensionsRequired']) || !empty($json['animations']) || !empty($json['skins'])) scanFail('Use a static uncompressed GLB');
    foreach (array_merge($json['buffers'] ?? [], $json['images'] ?? []) as $resource) if (isset($resource['uri'])) scanFail('Scan GLB resources must be embedded');
    $offset = 20 + $header['jsonLength'];
    if ($offset + 8 > $bytes) scanFail('Missing GLB geometry');
    $bin = unpack('Vlength/Vtype', substr($data,$offset,8));
    if ($bin['type'] !== 0x004e4942 || $offset + 8 + $bin['length'] !== $bytes || count($json['buffers'] ?? []) !== 1 || ($json['buffers'][0]['byteLength'] ?? PHP_INT_MAX) > $bin['length']) scanFail('Invalid GLB buffer');
    foreach ($json['bufferViews'] ?? [] as $view) {
        if (($view['buffer'] ?? 0) !== 0 || ($view['byteOffset'] ?? 0) < 0 || ($view['byteLength'] ?? 0) <= 0 || ($view['byteOffset'] ?? 0) + $view['byteLength'] > $bin['length']) scanFail('Invalid geometry range');
    }
    $componentBytes = [5121=>1,5123=>2,5125=>4,5126=>4];
    $typeSizes = ['SCALAR'=>1,'VEC2'=>2,'VEC3'=>3,'VEC4'=>4];
    foreach ($json['accessors'] ?? [] as $accessor) {
        $view = $json['bufferViews'][$accessor['bufferView'] ?? -1] ?? null;
        $width = ($componentBytes[$accessor['componentType'] ?? 0] ?? 0) * ($typeSizes[$accessor['type'] ?? ''] ?? 0);
        $stride = $view['byteStride'] ?? $width;
        $count = $accessor['count'] ?? 0;
        if (!$view || !$width || isset($accessor['sparse']) || !is_int($count) || $count<1 || $count>150000 || ($accessor['byteOffset'] ?? 0)<0 || $stride<$width || ($accessor['byteOffset'] ?? 0)+($count-1)*$stride+$width>$view['byteLength']) scanFail('Invalid geometry accessor');
    }
    foreach ($json['images'] ?? [] as $image) {
        $view = $json['bufferViews'][$image['bufferView'] ?? -1] ?? null;
        $imageBytes = $view ? substr($data,$offset+8+($view['byteOffset'] ?? 0),$view['byteLength']) : '';
        $dimensions = @getimagesizefromstring($imageBytes);
        if (!$dimensions || !in_array($dimensions['mime'],['image/png','image/jpeg'],true) || $dimensions[0]*$dimensions[1]>24000000) scanFail('Invalid embedded scan texture');
    }
    if ($requireTexture && empty($json['images'])) scanFail('Scan must preserve its photographed texture');
    $triangles = 0; $used = [];
    foreach ($json['meshes'] ?? [] as $mesh) foreach ($mesh['primitives'] ?? [] as $primitive) {
        if (($primitive['mode'] ?? 4) !== 4) scanFail('Use triangle geometry');
        $position = $json['accessors'][$primitive['attributes']['POSITION'] ?? -1] ?? null;
        $count = isset($primitive['indices']) ? ($json['accessors'][$primitive['indices']]['count'] ?? 0) : ($position['count'] ?? 0);
        if (!$position || $count <= 0 || $count % 3 !== 0 || !isset($primitive['attributes']['TEXCOORD_0']) || !isset($primitive['attributes']['NORMAL'])) scanFail('Geometry needs normals and UV coordinates');
        if ($position['componentType']!==5126 || $position['type']!=='VEC3') scanFail('Invalid vertex positions');
        foreach (['NORMAL'=>'VEC3','TEXCOORD_0'=>'VEC2'] as $attribute=>$type) {
            $accessor=$json['accessors'][$primitive['attributes'][$attribute]] ?? null;
            if (!$accessor || $accessor['componentType']!==5126 || $accessor['type']!==$type || $accessor['count']!==$position['count']) scanFail('Invalid scan normals or UV coordinates');
        }
        $material=$json['materials'][$primitive['material'] ?? -1] ?? null;
        $texture=$json['textures'][$material['pbrMetallicRoughness']['baseColorTexture']['index'] ?? -1] ?? null;
        if ($requireTexture && (!$texture || !isset($json['images'][$texture['source'] ?? -1]))) scanFail('Every scan region must retain its photographed texture');
        $view=$json['bufferViews'][$position['bufferView']];
        $start=$offset+8+($view['byteOffset'] ?? 0)+($position['byteOffset'] ?? 0);
        for ($i=0;$i<$position['count'];$i++) foreach (unpack('g3',substr($data,$start+$i*($view['byteStride'] ?? 12),12)) as $coordinate) if (!is_finite($coordinate) || abs($coordinate)>100) scanFail('Invalid scan coordinates');
        if (isset($primitive['indices'])) {
            $indices=$json['accessors'][$primitive['indices']];
            $format=[5121=>'C',5123=>'v',5125=>'V'][$indices['componentType']] ?? null;
            if (!$format || $indices['type']!=='SCALAR') scanFail('Invalid triangle indices');
            $view=$json['bufferViews'][$indices['bufferView']]; $width=$componentBytes[$indices['componentType']];
            $start=$offset+8+($view['byteOffset'] ?? 0)+($indices['byteOffset'] ?? 0);
            for ($i=0;$i<$indices['count'];$i++) if (unpack($format,substr($data,$start+$i*($view['byteStride'] ?? $width),$width))[1]>=$position['count']) scanFail('Triangle references missing vertex');
        }
        $triangles += $count / 3;
        $name = $json['materials'][$primitive['material'] ?? -1]['name'] ?? '';
        if ($name !== '') $used[$name] = ($used[$name] ?? 0) + $count / 3;
    }
    if ($triangles < 2 || $triangles > 50000) scanFail('Scan needs 2–50,000 triangles');
    $canonical = ['upper'=>['Upper','UpperMaterial'],'toe-cap'=>['Toe cap','ToeCapMaterial'],'tongue'=>['Tongue','TongueMaterial'],'laces'=>['Laces','LacesMaterial'],'heel-panel'=>['Heel panel','HeelPanelMaterial'],'side-accents'=>['Side accents','SideAccentsMaterial'],'midsole'=>['Midsole','MidsoleMaterial'],'outsole'=>['Outsole','OutsoleMaterial']];
    $parts = [];
    foreach ($canonical as $id=>[$label,$suffix]) if (isset($used['KCScan_'.$suffix])) $parts[] = ['id'=>$id, 'label'=>$label, 'material'=>'KCScan_'.$suffix, 'customizable'=>true];
    if ($requireRegions && count($parts) < 2) scanFail('Mark at least two nonempty customizable regions');
    return ['triangles'=>$triangles, 'bytes'=>$bytes, 'parts'=>$parts, 'materialNames'=>array_keys($used)];
}




function scanSurfaceQuality(array $info): array {
 // Reject obvious reconstruction fragments; photo comparison still decides actual likeness.
 if(($info['triangles']??0)<1000)scanFail('Too little shoe surface reconstructed. Use original camera photos, sharper overlap, fixed zoom and complete masks, then recapture.');
 return $info;
}

function scanUnreviewedImages(array $images): array {
    return array_values(array_filter($images,fn($image)=>empty($image['maskReviewed'])));
}

require_once __DIR__.'/tripo-common.php';
