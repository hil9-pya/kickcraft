import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
function php(code){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',`require ${JSON.stringify(root+'/tools/realityscan.php')}; ${code}`],{encoding:'utf8'}))}

test('AI masking targets unreviewed photos without replacing reviewed masks',()=>{
 const result=php(`$images=[['id'=>'draft','maskReviewed'=>false],['id'=>'reviewed','maskReviewed'=>true],['id'=>'new']]; echo json_encode(scanUnreviewedImages($images));`)
 assert.deepEqual(result.map(image=>image.id),['draft','new'])
})

test('AI draft import preserves reviewed masks and rejects missing or mismatched outputs',()=>{
 const result=php(`
 $dir=sys_get_temp_dir().'/kickcraft-ai-'.bin2hex(random_bytes(5));mkdir($dir);mkdir($dir.'/masks');
 $photo=$dir.'/photo.png';file_put_contents($photo,base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGP4DwABAQEAsTj2FAAAAABJRU5ErkJggg=='));
 $images=[['id'=>'kept','width'=>1,'height'=>1,'maskReviewed'=>true,'maskHash'=>'old'],['id'=>'draft','width'=>1,'height'=>1,'maskReviewed'=>false]];
 $paths=['draft'=>$photo];$saved=scanImportAiMasks($images,$paths,$dir);$errors=[];
 foreach([[],['draft'=>$photo]] as $index=>$bad){try{$changed=$images;if($index)$changed[1]['width']=2;scanImportAiMasks($changed,$bad,$dir);}catch(RuntimeException $e){$errors[]=$e->getMessage();}}
 foreach(glob($dir.'/masks/*') as $file)unlink($file);rmdir($dir.'/masks');unlink($photo);rmdir($dir);
 echo json_encode(['images'=>$saved,'errors'=>$errors]);`)
 assert.equal(result.images[0].maskHash,'old');assert.equal(result.images[0].maskReviewed,true)
 assert.equal(result.images[1].maskReviewed,false);assert.match(result.images[1].maskHash,/^[a-f0-9]{64}$/)
 assert.equal(result.errors.length,2)
})
