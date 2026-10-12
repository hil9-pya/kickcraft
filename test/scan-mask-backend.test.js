import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {mkdtempSync,writeFileSync,readFileSync,rmSync,mkdirSync,copyFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {encodeMaskPng} from '../src/scan-masks.js'
const root=path.resolve(import.meta.dirname,'..').replaceAll('\\','/')
function php(code,worker=false){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',`require ${JSON.stringify(root+(worker?'/tools/process-scans.php':'/api/scans/common.php'))};try{${code}}catch(Throwable $e){echo json_encode(['error'=>$e->getMessage(),'code'=>$e->getCode()]);}`],{encoding:'utf8'}))}

test('API validates actual mask pixels and dimensions, rejecting empty foreground or background',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-mask-api-')),file=path.join(dir,'mask.png')
 try{
  writeFileSync(file,Buffer.from(await (await encodeMaskPng(new Uint8Array([0,255,255,0]),2,2)).arrayBuffer()))
  assert.equal(php(`echo json_encode(scanMaskInfo(${JSON.stringify(file)},2,2));`).foreground,2)
  assert.equal(php(`echo json_encode(scanMaskInfo(${JSON.stringify(file)},3,2));`).code,422)
  for(const values of [[255,255,255,255],[0,0,0,0],[0,255,128,0]]){
   writeFileSync(file,Buffer.from(await (await encodeMaskPng(new Uint8Array(values),2,2)).arrayBuffer()))
   assert.equal(php(`echo json_encode(scanMaskInfo(${JSON.stringify(file)},2,2));`).code,422)
  }
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('queue cannot accept missing or changed masks even when image count is sufficient',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-mask-queue-')).replaceAll('\\','/'),file=dir+'/mask.png'
 try{
  assert.equal(php(`scanCheckMasks([['id'=>'a']],${JSON.stringify(dir)});echo 'true';`).code,422)
  assert.equal(php(`scanCheckMasks([['maskReviewed'=>false,'maskFile'=>'mask.png']],${JSON.stringify(dir)});echo 'true';`).code,422)
  const data=Buffer.from(await (await encodeMaskPng(new Uint8Array([0,255]),2,1)).arrayBuffer());writeFileSync(file,data)
  assert.equal(php(`scanCheckMasks([['maskReviewed'=>true,'maskFile'=>'mask.png','maskHash'=>hash_file('sha256',${JSON.stringify(file)})]],${JSON.stringify(dir)});echo 'true';`),true)
  assert.equal(php(`scanCheckMasks([['maskReviewed'=>true,'maskFile'=>'mask.png','maskHash'=>'stale']],${JSON.stringify(dir)});echo 'true';`).code,422)
 }finally{rmSync(dir,{recursive:true,force:true})}
})
test('worker masks dense reconstruction and removes background before texturing and simplification',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-mask-graph-')).replaceAll('\\','/')
 try{
  const share=dir+'/tool/aliceVision/share/meshroom';mkdirSync(share,{recursive:true})
  const template={header:{nodesVersions:{}},graph:{CameraInit_1:{inputs:{}},PrepareDenseScene_1:{inputs:{}},FeatureExtraction_1:{inputs:{}},Texturing_1:{inputs:{inputMesh:'{MeshFiltering_1.outputMesh}'}},MeshFiltering_1:{inputs:{}}}}
  writeFileSync(share+'/photogrammetry.mg',JSON.stringify(template))
  const pipeline=php(`echo json_encode(scanMaskedPipeline(${JSON.stringify(dir+'/tool/meshroom_batch.exe')},${JSON.stringify(dir)}));`,true)
  assert.equal(typeof pipeline,'string',JSON.stringify(pipeline))
  const {graph}=JSON.parse(readFileSync(pipeline,'utf8'))
  assert.equal(Array.isArray(graph.FeatureExtraction_1.inputs),false,'Meshroom requires empty attribute dictionaries to remain objects')
  assert.equal(graph.CameraInit_1.inputs.viewIdMethod,'filename')
  assert.equal(graph.CameraInit_1.inputs.viewIdRegex,'capture-([0-9]+)')
  assert.deepEqual(graph.PrepareDenseScene_1.inputs.masksFolders,[dir+'/input-masks'])
  assert.equal(graph.Texturing_1.inputs.inputMesh,'{MeshMasking_1.outputMesh}')
  assert.equal(graph.MeshMasking_1.inputs.inputMesh,'{MeshFiltering_1.outputMesh}')
  assert.equal(graph.MeshMasking_1.inputs.undistortMasks,true)
  assert.equal(graph.FeatureExtraction_1.inputs.masksFolder,undefined,'stationary capture must retain background camera-matching features')
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('partial camera alignment fails quality screening instead of producing a usable preview',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-camera-coverage-')),file=path.join(dir,'cameras.sfm').replaceAll('\\','/')
 const views=Array.from({length:40},(_,i)=>({viewId:String(i),poseId:String(i),intrinsicId:'camera'}))
 try{
  writeFileSync(file,JSON.stringify({views,poses:views.slice(0,20).map(view=>({poseId:view.poseId})),intrinsics:[{intrinsicId:'camera'}]}))
  assert.equal(php(`echo json_encode(scanCameraCoverage(${JSON.stringify(file)},40));`,true).code,422)
  writeFileSync(file,JSON.stringify({views,poses:views.slice(0,32).map(view=>({poseId:view.poseId})),intrinsics:[{intrinsicId:'camera'}]}))
  assert.deepEqual(php(`echo json_encode(scanCameraCoverage(${JSON.stringify(file)},40));`,true),{aligned:32,total:40})
  writeFileSync(file,JSON.stringify({views,poses:views.map(view=>({poseId:view.poseId})),intrinsics:[]}))
  assert.equal(php(`echo json_encode(scanCameraCoverage(${JSON.stringify(file)},40));`,true).code,422)
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('JPEG orientation remains available for masks without rotating or rewriting original photos',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-photo-orientation-')),file=path.join(dir,'phone.jpg')
 try{
  const original=readFileSync(path.join(root,'public/images/stride-pro.jpg'))
  const exif=Buffer.from('45786966000049492a0008000000010012010300010000000600000000000000','hex')
  const marker=Buffer.alloc(4);marker.writeUInt16BE(0xffe1);marker.writeUInt16BE(exif.length+2,2)
  writeFileSync(file,Buffer.concat([original.subarray(0,2),marker,exif,original.subarray(2)]))
  const plain=php(`echo json_encode(scanImageInfo(${JSON.stringify(path.join(root,'public/images/stride-pro.jpg').replaceAll('\\','/'))}));`)
  const phone=php(`echo json_encode(scanImageInfo(${JSON.stringify(file.replaceAll('\\','/'))}));`)
  assert.equal(phone.orientation,6);assert.equal(phone.width,plain.width);assert.equal(phone.height,plain.height)
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('worker rejects a mostly missing surface even when camera coverage passes',()=>{
 assert.equal(php(`echo json_encode(scanSurfaceQuality(['triangles'=>140]));`,true).code,422)
 assert.deepEqual(php(`echo json_encode(scanSurfaceQuality(['triangles'=>12632]));`,true),{triangles:12632})
})
test('reconstruction inputs retain capture order with matching masks',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-input-order-')).replaceAll('\\','/')
 try {
  mkdirSync(dir+'/images');mkdirSync(dir+'/masks')
  writeFileSync(dir+'/images/random-a.png','first');writeFileSync(dir+'/images/random-b.jpg','second')
  writeFileSync(dir+'/masks/a.png','mask-first');writeFileSync(dir+'/masks/b.png','mask-second')
  php(`scanStageCapture([['file'=>'random-a.png','maskFile'=>'a.png'],['file'=>'random-b.jpg','maskFile'=>'b.png']],${JSON.stringify(dir)});echo json_encode(true);`,true)
  assert.equal(readFileSync(dir+'/input-images/capture-000000.png','utf8'),'first')
  assert.equal(readFileSync(dir+'/input-images/capture-000001.jpg','utf8'),'second')
  assert.equal(readFileSync(dir+'/input-masks/capture-000001.png','utf8'),'mask-second')
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('phone focal calibration metadata is retained without rewriting photos',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-focal-exif-')),file=path.join(dir,'calibrated.jpg')
 try {
  const source=readFileSync(path.join(root,'public/images/stride-pro.jpg'))
  const tiff=Buffer.alloc(44);tiff.write('II');tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);tiff.writeUInt16LE(1,8)
  tiff.writeUInt16LE(0x8769,10);tiff.writeUInt16LE(4,12);tiff.writeUInt32LE(1,14);tiff.writeUInt32LE(26,18)
  tiff.writeUInt16LE(1,26);tiff.writeUInt16LE(0xa405,28);tiff.writeUInt16LE(3,30);tiff.writeUInt32LE(1,32);tiff.writeUInt16LE(43,36)
  const exif=Buffer.concat([Buffer.from('Exif\0\0'),tiff]),marker=Buffer.alloc(4);marker.writeUInt16BE(0xffe1);marker.writeUInt16BE(exif.length+2,2)
  writeFileSync(file,Buffer.concat([source.subarray(0,2),marker,exif,source.subarray(2)]))
  assert.equal(php(`echo json_encode(scanImageInfo(${JSON.stringify(file.replaceAll('\\','/'))}));`).cameraMetadata,true)
 }finally{rmSync(dir,{recursive:true,force:true})}
})


test('missing prepared surface returns a clean storage error without PHP warnings',()=>{
 const absent=path.join(tmpdir(),'kc-absent-'+Date.now()+'.glb').replaceAll('\\','/')
 assert.equal(php(`echo json_encode(scanGlbInfo(${JSON.stringify(absent)}));`).code,503)
})
