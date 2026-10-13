import test from 'node:test'
import assert from 'node:assert/strict'
import {validateCaptureFile} from '../src/scan-capture.js'
test('capture validates content type, byte and pixel limits before upload',()=>{
 const file={type:'image/jpeg',size:10*1024*1024}
 assert.equal(validateCaptureFile(file,{width:6000,height:4000}),null)
 assert.ok(validateCaptureFile(file,{width:6001,height:4000}))
 assert.ok(validateCaptureFile({...file,size:file.size+1},{width:1,height:1}))
 assert.ok(validateCaptureFile({...file,type:'image/svg+xml'},{width:1,height:1}))
})
test('finalize sends photographed thumbnail alongside model and replacement detail texture',async()=>{
 const {finalizeScan}=await import('../src/scan-capture.js')
 const savedFetch=globalThis.fetch
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.body.get('thumbnail').type,'image/png')
  assert.equal(await options.body.get('thumbnail').text(),'scan-view')
  return new Response(JSON.stringify({draft:{thumbnailPath:'/images/uploads/scan-thumb.png'}}))
 }
 try {assert.equal((await finalizeScan('job-one',{glb:new ArrayBuffer(1),neutralTexture:new Blob(['texture'],{type:'image/png'}),thumbnail:new Blob(['scan-view'],{type:'image/png'}),parts:[]},null)).thumbnailPath,'/images/uploads/scan-thumb.png')}
 finally {globalThis.fetch=savedFetch}
})

test('saving a photo mask sends owner job, photo identity, and lossless PNG',async()=>{
 const {saveScanMask}=await import('../src/scan-capture.js')
 const savedFetch=globalThis.fetch
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'/api/scans/mask.php');assert.equal(options.headers['X-Requested-With'],'KickCraftScan')
  assert.equal(options.body.get('id'),'job-one');assert.equal(options.body.get('image'),'photo-one')
  assert.equal(options.body.get('file').type,'image/png')
  return new Response(JSON.stringify({job:{id:'job-one',maskCount:1}}))
 }
 try{assert.equal((await saveScanMask('job-one','photo-one',new Blob(['mask'],{type:'image/png'}))).maskCount,1)}
 finally{globalThis.fetch=savedFetch}
})

test('finalize sends explicit charm fitting settings for server-side local assets',async()=>{
 const {finalizeScan}=await import('../src/scan-capture.js'),savedFetch=globalThis.fetch
 globalThis.fetch=async(url,options)=>{
  assert.deepEqual(JSON.parse(options.body.get('charmSettings')),{size:.75,rotation:[10,-20,30]})
  assert.deepEqual(JSON.parse(options.body.get('charmPoint')),[.1,.2,.3])
  return new Response(JSON.stringify({draft:{charmsEnabled:true}}))
 }
 try{assert.equal((await finalizeScan('job-one',{glb:new ArrayBuffer(1),neutralTexture:new Blob(),thumbnail:new Blob(),parts:[]},[.1,.2,.3],{size:.75,rotation:[10,-20,30]})).charmsEnabled,true)}finally{globalThis.fetch=savedFetch}
})
