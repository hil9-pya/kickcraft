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

test('native video uploads bounded chunks and preserves resume identity',async()=>{
 const {uploadScanVideo}=await import('../src/scan-capture.js')
 const savedFetch=globalThis.fetch,file=new File([new Uint8Array(9*1024*1024)],'original.mp4',{type:'video/mp4',lastModified:123})
 let saved={id:'native-one',engine:'realityscan',state:'uploading'},chunks=[],created=0
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('create.php')){assert.equal(JSON.parse(options.body).engine,'realityscan');created++;return Response.json({job:saved})}
  if(url.includes('status.php'))return Response.json({job:saved})
  const body=options.body,offset=Number(body.get('offset')),bytes=body.get('file').size
  assert.ok(bytes<=8*1024*1024);assert.equal(Number(body.get('total')),file.size);chunks.push(offset)
  saved={...saved,video:{key:body.get('key'),received:offset+bytes,total:file.size},state:offset+bytes===file.size?'queued':'uploading'}
  return Response.json({job:saved})
 }
 try{
  assert.equal((await uploadScanVideo(file,()=>{})).state,'queued');assert.deepEqual(chunks,[0,8*1024*1024]);assert.equal(created,1)
  assert.equal((await uploadScanVideo(file,()=>{},saved.id)).state,'queued');assert.equal(chunks.length,2)
  await assert.rejects(uploadScanVideo(new File(['different'],'other.mp4',{type:'video/mp4'}),()=>{},saved.id),/same video/)
 }finally{globalThis.fetch=savedFetch}
})

test('native upload recovers a lost final response by observing the queued job',async()=>{
 const {uploadScanVideo}=await import('../src/scan-capture.js'),savedFetch=globalThis.fetch
 const file=new File(['small video'],'capture.mp4',{type:'video/mp4'})
 let job={id:'lost-final',engine:'realityscan',state:'uploading'}
 globalThis.fetch=async(url,options)=>{
  if(url.endsWith('create.php') || url.includes('status.php'))return Response.json({job})
  job={...job,state:'queued',video:{key:options.body.get('key'),received:file.size,total:file.size}}
  throw new Error('Response lost')
 }
 try{assert.equal((await uploadScanVideo(file,()=>{})).state,'queued')}finally{globalThis.fetch=savedFetch}
})


test('reconstruction client keeps default mode and sends explicit experimental retry',async()=>{
 const {startScan}=await import('../src/scan-capture.js'),savedFetch=globalThis.fetch
 const modes=[]
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/scans/start.php');const body=JSON.parse(options.body);assert.equal(body.id,'saved-scan');modes.push(body.experimental);return Response.json({job:{id:'saved-scan'}})}
 try {await startScan('saved-scan');await startScan('saved-scan',true);assert.deepEqual(modes,[false,true])}finally{globalThis.fetch=savedFetch}
})
