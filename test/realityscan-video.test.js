import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
function php(code){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',`require ${JSON.stringify(root+'/api/scans/video-common.php')}; ${code}`],{encoding:'utf8'}))}
function atom(type,data){const header=Buffer.alloc(8);header.writeUInt32BE(data.length+8);header.write(type,4);return Buffer.concat([header,data])}
function clip({duration=48,width=768,height=768,version=0}={}){
 const tkhd=Buffer.alloc(84);tkhd.writeUInt32BE(width*65536,76);tkhd.writeUInt32BE(height*65536,80)
 const mdhd=Buffer.alloc(version?32:24);mdhd[0]=version
 mdhd.writeUInt32BE(1000,version?20:12)
 if(version)mdhd.writeBigUInt64BE(BigInt(duration*1000),24);else mdhd.writeUInt32BE(duration*1000,16)
 const hdlr=Buffer.alloc(24);hdlr.write('vide',8)
 return Buffer.concat([atom('ftyp',Buffer.from('mp42\0\0\0\0mp42isom')),atom('moov',atom('trak',Buffer.concat([atom('tkhd',tkhd),atom('mdia',Buffer.concat([atom('mdhd',mdhd),atom('hdlr',hdlr)]))]))),atom('mdat',Buffer.alloc(20))])
}
test('server validates video track duration and dimensions instead of trusting browser',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-native-video-'))
 try{
  for(const [index,options] of [{},{version:1},{duration:14},{duration:181},{width:639},{width:5000,height:3000}].entries()){
   const file=path.join(dir,`${index}.mp4`).replaceAll('\\','/');writeFileSync(file,clip(options))
   const result=php(`try{echo json_encode(scanVideoInfo(${JSON.stringify(file)}));}catch(Throwable $e){echo json_encode(['error'=>$e->getMessage()]);}`)
   if(index<2){assert.equal(result.duration,48);assert.equal(result.width,768)}else assert.ok(result.error)
  }
  const malformed=path.join(dir,'bad.mp4').replaceAll('\\','/');writeFileSync(malformed,Buffer.from('00000018667479706d703432000000006d70343269736f6d','hex'))
  assert.ok(php(`try{scanVideoInfo(${JSON.stringify(malformed)});echo '{}';}catch(Throwable $e){echo json_encode(['error'=>$e->getMessage()]);}`).error)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('video chunk bounds reject gaps, excessive sizes, and invalid identities',()=>{
 const results=php(`$out=[];foreach([[0,100,50,str_repeat('a',64)],[50,100,50,str_repeat('a',64)],[0,314572801,50,str_repeat('a',64)],[-1,100,50,str_repeat('a',64)],[0,100,0,str_repeat('a',64)],[0,100,50,'../escape'],[90,100,50,str_repeat('a',64)]] as $args){try{scanVideoChunkBounds(...$args);$out[]=true;}catch(Throwable $e){$out[]=false;}}echo json_encode($out);`)
 assert.deepEqual(results,[true,true,false,false,false,false,false])
})

test('chunk retries preserve committed bytes and remove crash leftovers',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-video-chunk-')).replaceAll('\\','/')
 try{
  const result=php(`$path=${JSON.stringify(dir+'/source.mp4')};$chunk=${JSON.stringify(dir+'/chunk')};file_put_contents($chunk,'first');$first=scanAppendVideoChunk($path,$chunk,0,0);$retry=scanAppendVideoChunk($path,$chunk,0,$first);file_put_contents($path,'uncommitted',FILE_APPEND);file_put_contents($chunk,'last');$last=scanAppendVideoChunk($path,$chunk,5,$first);$errors=[];foreach([[0,'wrong'],[20,'gap']] as [$offset,$value]){file_put_contents($chunk,$value);try{scanAppendVideoChunk($path,$chunk,$offset,$last);$errors[]=false;}catch(Throwable $e){$errors[]=true;}}echo json_encode([$first,$retry,$last,file_get_contents($path),$errors]);`)
  assert.deepEqual(result,[5,5,9,'firstlast',[true,true]])
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('native coverage report must match this job and meet both thresholds',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-native-coverage-')).replaceAll('\\','/')
 try{
  const values=['6,49','30,40','32,40','41,40','40,49','32,40\n32,40','']
  for(const [index,value] of values.entries()){
   writeFileSync(dir+'/coverage.csv',value)
   const result=php(`require ${JSON.stringify(root+'/tools/realityscan.php')};try{echo json_encode(scanNativeCoverage(${JSON.stringify(dir+'/coverage.csv')},40));}catch(Throwable $e){echo json_encode(['error'=>$e->getMessage()]);}`)
   if(index===2)assert.equal(result.aligned,32);else assert.ok(result.error)
  }
 }finally{rmSync(dir,{recursive:true,force:true})}
})
