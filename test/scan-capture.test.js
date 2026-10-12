import test from 'node:test'
import assert from 'node:assert/strict'
import {validateCaptureFile,uploadCapture} from '../src/scan-capture.js'
test('capture validates content type, byte and pixel limits before upload',()=>{
 const file={type:'image/jpeg',size:10*1024*1024}
 assert.equal(validateCaptureFile(file,{width:6000,height:4000}),null)
 assert.ok(validateCaptureFile(file,{width:6001,height:4000}))
 assert.ok(validateCaptureFile({...file,size:file.size+1},{width:1,height:1}))
 assert.ok(validateCaptureFile({...file,type:'image/svg+xml'},{width:1,height:1}))
})
test('upload errors retain the created job ID for observation/reselection',async()=>{
 const savedFetch=globalThis.fetch
 let calls=0; const seen=[]
 globalThis.fetch=async(url,options)=>{
  seen.push([url,options.headers['X-Requested-With']]); calls++
  return calls===1?new Response(JSON.stringify({job:{id:'job-one'}})):new Response(JSON.stringify({error:'Disk full'}),{status:503})
 }
 try {
  await assert.rejects(uploadCapture([new File(['photo'],'photo.jpg',{type:'image/jpeg'})],()=>{}),error=>error.message==='Disk full' && error.jobId==='job-one')
  assert.equal(calls,2)
  assert.deepEqual(seen.map(item=>item[1]),['KickCraftScan','KickCraftScan'])
 } finally {globalThis.fetch=savedFetch}
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
