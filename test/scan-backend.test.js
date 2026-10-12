import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'..')
const php=process.env.PHP_BINARY || 'C:/xampp/php/php.exe'
function run(code) {
 return JSON.parse(execFileSync(php,['-r',`require ${JSON.stringify(root+'/api/scans/common.php')}; try { ${code} } catch (Throwable $e) { echo json_encode(['error'=>$e->getMessage(),'code'=>$e->getCode()]); }`],{encoding:'utf8'}))
}
test('scan IDs reject traversal and malformed IDs before filesystem access',()=>{
 assert.equal(run(`echo json_encode(scanId('../outside'));`).code,400)
 assert.equal(run(`echo json_encode(scanId('a'.str_repeat('0',35)));`).code,400)
 assert.equal(run(`echo json_encode(scanId('12345678-1234-4234-8234-123456789abc'));`),'12345678-1234-4234-8234-123456789abc')
})
test('scan image validation examines content and rejects oversized content',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-scan-test-'))
 try {
  const image=path.join(dir,'photo.png')
  writeFileSync(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'))
  const info=run(`echo json_encode(scanImageInfo(${JSON.stringify(image)}));`)
  assert.equal(info.width,1)
  assert.equal(info.mime,'image/png')
  writeFileSync(image,'<?php echo 1;?>')
  assert.equal(run(`echo json_encode(scanImageInfo(${JSON.stringify(image)}));`).code,415)
  writeFileSync(image,Buffer.alloc(10*1024*1024+1))
  assert.equal(run(`echo json_encode(scanImageInfo(${JSON.stringify(image)}));`).code,413)
 } finally {rmSync(dir,{recursive:true,force:true})}
})
test('scan submission requires 30 through 120 photos and a mutable uploading job',()=>{
 for(const count of [0,29,121]) assert.equal(run(`scanCanStart('uploading',${count}); echo 'true';`).code,422)
 assert.equal(run(`scanCanStart('uploading',30); echo 'true';`),true)
 assert.equal(run(`scanCanStart('uploading',120); echo 'true';`),true)
 assert.equal(run(`scanCanStart('processing',30); echo 'true';`).code,409)
})
test('every scan endpoint rejects unauthenticated requests',()=>{
 for(const endpoint of ['create','upload','mask','start','status','asset','finalize','discard','list']) {
  const method=['status','asset','list'].includes(endpoint)?'GET':'POST'
  const output=execFileSync(php,['-r',`$_SERVER['REQUEST_METHOD']='${method}'; register_shutdown_function(function(){echo '\n'.http_response_code();}); require ${JSON.stringify(root+'/api/scans/'+endpoint+'.php')};`],{encoding:'utf8'})
  assert.match(output,/Authentication required/)
  assert.match(output,/401$/)
 }
})


function glbFile(dir,edit=()=>{}) {
 const geometry=Buffer.alloc(96)
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')
 const bin=Buffer.concat([geometry,png,Buffer.alloc((4-png.length%4)%4)])
 const data={asset:{version:'2.0'},buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36},{buffer:0,byteOffset:72,byteLength:24},{buffer:0,byteOffset:96,byteLength:png.length}],accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:3},{bufferView:1,componentType:5126,type:'VEC3',count:3},{bufferView:2,componentType:5126,type:'VEC2',count:3}],images:[{bufferView:3,mimeType:'image/png'}],textures:[{source:0}],materials:[{name:'KCScan_UpperMaterial',pbrMetallicRoughness:{baseColorTexture:{index:0}}},{name:'KCScan_OutsoleMaterial',pbrMetallicRoughness:{baseColorTexture:{index:0}}}],meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},material:0},{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},material:1}]}]}
 edit(data)
 const text=Buffer.from(JSON.stringify(data));const json=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)])
 const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16)
 const chunk=Buffer.alloc(8);chunk.writeUInt32LE(bin.length);chunk.writeUInt32LE(0x004e4942,4)
 const file=path.join(dir,'model.glb');writeFileSync(file,Buffer.concat([header,json,chunk,bin]));return file
}
test('final GLB validation derives actual regions and rejects external resources and invalid accessors',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-glb-test-'))
 try {
  let file=glbFile(dir)
  assert.deepEqual(run(`echo json_encode(scanGlbInfo(${JSON.stringify(file)},true));`).parts.map(part=>part.id),['upper','outsole'])
  file=glbFile(dir,json=>{json.images[0].uri='https://outside/private'})
  assert.equal(run(`echo json_encode(scanGlbInfo(${JSON.stringify(file)},true));`).code,422)
  file=glbFile(dir,json=>{json.meshes[0].primitives.pop()})
  assert.equal(run(`echo json_encode(scanGlbInfo(${JSON.stringify(file)},true));`).code,422)
  file=glbFile(dir,json=>{json.accessors[0].byteOffset=999999})
  assert.equal(run(`echo json_encode(scanGlbInfo(${JSON.stringify(file)},true));`).code,422)
  for(const edit of [json=>{json.meshes[0].primitives[0].attributes.NORMAL=99},json=>{json.accessors[1].count=1},json=>{json.meshes[0].primitives[0].attributes.TEXCOORD_0=0},json=>{json.textures[0].source=99}]) {
   file=glbFile(dir,edit)
   assert.equal(run(`echo json_encode(scanGlbInfo(${JSON.stringify(file)},true));`).code,422)
  }
 } finally {rmSync(dir,{recursive:true,force:true})}
})

test('finalized scans expose their saved draft for recovery without repainting',()=>{
 const job={id:'12345678-1234-4234-8234-123456789abc',state:'finalized',stage:'Saved',error_message:null,images:[],created_at:'now',updated_at:'now',finalized_payload:JSON.stringify({hash:'saved',draft:{glbPath:'/models/uploads/scan-example.glb',parts:[{id:'upper'},{id:'toe-cap'}]}})}
 const result=run(`echo json_encode(scanPublic(json_decode(${JSON.stringify(JSON.stringify(job))},true)));`)
 assert.equal(result.draft.glbPath,'/models/uploads/scan-example.glb')
 assert.equal(result.draft.parts.length,2)
})

test('picked scan charm point compensates the existing charms baked anchor',()=>{
 const point=[0.01,0.02,0.03]
 const result=run(`echo json_encode(scanCharmOffset([0.01,0.02,0.03]));`)
 assert.equal(typeof result,'string')
 const offset=result.split(' ').map(Number)
 for(const slug of ['star','lightning','k-tag']) {
  const bytes=readFileSync(path.join(root,'public/models/charms/'+slug+'-charm.glb'))
  const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())
  const anchor=json.nodes.find(node=>node.name==='CharmRoot').translation
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(anchor[axis]+offset[axis]-point[axis])<1e-9)
 }
 assert.equal(run(`echo json_encode(scanCharmOffset(null));`),null)
})
