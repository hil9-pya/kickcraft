<?php
require_once __DIR__.'/common.php';

function scanVideoChunkBounds(int $offset,int $total,int $bytes,string $key): void {
    if ($offset<0 || $total<1 || $total>300*1024*1024 || $bytes<1 || $bytes>8*1024*1024 || $offset>$total-$bytes || !preg_match('/^[a-f0-9]{64}$/D',$key)) scanFail('Invalid video chunk or video exceeds 300 MB',422);
}
function scanVideoBoxes(string $data): array {
    $boxes=[];$at=0;$end=strlen($data);
    while ($at<$end) {
        if ($end-$at<8 || count($boxes)>4096) scanFail('Damaged video container');
        $size=unpack('N',substr($data,$at,4))[1];$header=8;
        if ($size===1) {
            if ($end-$at<16) scanFail('Damaged video container');
            $large=unpack('Nhigh/Nlow',substr($data,$at+8,8));
            if ($large['high']!==0) scanFail('Video metadata is too large');
            $size=$large['low'];$header=16;
        }
        if ($size===0) $size=$end-$at;
        if ($size<$header || $size>$end-$at) scanFail('Damaged video container');
        $boxes[]=['type'=>substr($data,$at+4,4),'data'=>substr($data,$at+$header,$size-$header)];$at+=$size;
    }
    return $boxes;
}
function scanVideoInfo(string $path): array {
    $bytes=is_file($path)?filesize($path):0;
    if ($bytes<16 || $bytes>300*1024*1024) scanFail('Video must be at most 300 MB',413);
    if (!in_array((new finfo(FILEINFO_MIME_TYPE))->file($path),['video/mp4','video/quicktime'],true)) scanFail('Choose an MP4 or MOV video',415);
    $stream=fopen($path,'rb');$at=0;$metadata=null;$media=false;$count=0;
    try {
        while ($at<$bytes) {
            if ($bytes-$at<8 || ++$count>4096) scanFail('Damaged video container');
            fseek($stream,$at);$head=fread($stream,8);$size=unpack('N',substr($head,0,4))[1];$header=8;
            if ($size===1) {
                if ($bytes-$at<16) scanFail('Damaged video container');
                $large=unpack('Nhigh/Nlow',fread($stream,8));
                if ($large['high']!==0) scanFail('Video is too large');
                $size=$large['low'];$header=16;
            }
            if ($size===0) $size=$bytes-$at;
            if ($size<$header || $size>$bytes-$at) scanFail('Damaged video container');
            $type=substr($head,4,4);
            if ($type==='moov') {
                if ($metadata!==null || $size<=$header || $size>8*1024*1024) scanFail('Unsupported video metadata');
                $metadata=fread($stream,$size-$header);
            }
            if ($type==='mdat' && $size>$header) $media=true;
            $at+=$size;
        }
    } finally {fclose($stream);}
    if ($metadata===null || !$media) scanFail('Video is incomplete');
    $tracks=[];
    foreach (scanVideoBoxes($metadata) as $box) {
        if ($box['type']!=='trak') continue;
        $tkhd=null;$mdhd=null;$video=false;
        foreach (scanVideoBoxes($box['data']) as $child) {
            if ($child['type']==='tkhd') $tkhd=$child['data'];
            if ($child['type']==='mdia') foreach(scanVideoBoxes($child['data']) as $mediaBox) {
                if ($mediaBox['type']==='mdhd') $mdhd=$mediaBox['data'];
                if ($mediaBox['type']==='hdlr' && strlen($mediaBox['data'])>=12 && substr($mediaBox['data'],8,4)==='vide') $video=true;
            }
        }
        if (!$video) continue;
        if (!$tkhd || strlen($tkhd)<84 || !$mdhd || strlen($mdhd)<24) scanFail('Video track metadata is incomplete');
        $dimensions=unpack('Nwidth/Nheight',substr($tkhd,-8));
        $width=(int)round($dimensions['width']/65536);$height=(int)round($dimensions['height']/65536);
        $version=ord($mdhd[0]);
        if ($version>1 || ($version===1 && strlen($mdhd)<32)) scanFail('Unsupported video timing');
        $scale=unpack('N',substr($mdhd,$version?20:12,4))[1];
        if ($version) {$parts=unpack('Nhigh/Nlow',substr($mdhd,24,8));$duration=$parts['high']*4294967296.0+$parts['low'];}
        else $duration=unpack('N',substr($mdhd,16,4))[1];
        $duration=$scale>0?$duration/$scale:0;
        if ($duration<15 || $duration>180 || $width<640 || $height<640 || $width*$height>12000000) scanFail('Use a 15–180 second video, at least 640 pixels on each side and at most 12 megapixels');
        $tracks[]=['width'=>$width,'height'=>$height,'duration'=>$duration];
    }
    if (count($tracks)!==1) scanFail('Use a video with one camera track');
    return $tracks[0];
}
function scanAppendVideoChunk(string $path,string $chunk,int $offset,int $received): int {
    $data=file_get_contents($chunk);
    if ($data===false) scanFail('Upload chunk is unavailable',503);
    $bytes=strlen($data);
    if ($offset>$received) scanFail('Video upload has a gap; resume from saved progress',409);
    $stream=fopen($path,'c+b');
    if (!$stream) scanFail('Private video storage is unavailable',503);
    try {
        $stored=fstat($stream)['size'];
        if ($stored<$received) scanFail('Saved video is incomplete; start a new capture',409);
        if ($offset<$received) {
            if ($offset+$bytes>$received) scanFail('Video chunk overlaps saved progress',409);
            fseek($stream,$offset);
            if (!hash_equals(hash('sha256',$data),hash('sha256',fread($stream,$bytes)))) scanFail('Video differs from saved upload; start a new capture',409);
            return $received;
        }
        // File writes can survive a rolled-back database update; truncate that uncommitted tail on retry.
        if (!ftruncate($stream,$received) || fseek($stream,$received)!==0 || fwrite($stream,$data)!==$bytes || !fflush($stream)) scanFail('Could not save video chunk',503);
        return $received+$bytes;
    } finally {fclose($stream);}
}
