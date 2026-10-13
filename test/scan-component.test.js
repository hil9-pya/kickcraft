import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
function componentFunction(file,name,end,bindings) {
 const source=readFileSync(new URL('../src/components/'+file,import.meta.url),'utf8')
 const start=source.indexOf('function '+name+'('),stop=source.indexOf(end,start)
 assert.ok(start>=0 && stop>start)
 return new Function(...Object.keys(bindings),source.slice(source.slice(Math.max(0,start-6),start)==='async '?start-6:start,stop)+';return '+name)(...Object.values(bindings))
}
test('scanner finalization retains recoverable draft until catalog save',async()=>{
 const job={value:{id:'saved-scan',state:'ready'}},busy={value:false},error={value:''},draft={glbPath:'/models/uploads/scan-saved-scan.glb'}
 let pointer='saved-scan',emitted
 const complete=componentFunction('PhotoScanner.vue','complete','onMounted(',{job,busy,error,finalizeScan:async()=>draft,remember:value=>{job.value=value;pointer=value.id},emit:(_,value)=>{emitted=value},localStorage:{removeItem:()=>{pointer=null}},storageKey:'scan'})
 await complete({payload:{},charmPoint:null})
 assert.equal(pointer,'saved-scan');assert.equal(job.value.state,'finalized');assert.equal(job.value.draft,draft);assert.equal(emitted,draft);assert.equal(busy.value,false)
})
test('accepting scan clears stale model and thumbnail uploads',()=>{
 const form={value:{}},selectedModelFile={value:{}},selectedThumbnailFile={value:{}},detectedModelFileName={value:''},showPhotoScanner={value:true},editorModelReady={value:true}
 const accept=componentFunction('AdminPanel.vue','acceptPhotoScan','const newColorName',{form,selectedModelFile,selectedThumbnailFile,detectedModelFileName,showPhotoScanner,editorModelReady})
 accept({glbPath:'/models/uploads/scan.glb',thumbnailPath:'/images/scan.png'})
 assert.equal(selectedModelFile.value,null);assert.equal(selectedThumbnailFile.value,null);assert.equal(form.value.thumbnailPath,'/images/scan.png')
})

test('recapture retains the saved job when retirement fails',async()=>{
 const job={value:{id:'saved-scan'}},busy={value:false},error={value:''},accepted={value:true},progress={value:'Saved'}
 let removed=false
 const bindings={job,busy,error,accepted,progress,maskImageId:{value:null},likenessChecks:{value:[]},referenceId:{value:null},timer:null,clearTimeout(){},discardScan:async id=>{assert.equal(id,'saved-scan');throw new Error('Reconstruction still active')},localStorage:{removeItem(){removed=true}},storageKey:'scan'}
 await componentFunction('PhotoScanner.vue','newCapture','async function complete(',bindings)()
 assert.equal(job.value.id,'saved-scan');assert.equal(removed,false);assert.equal(error.value,'Reconstruction still active');assert.equal(busy.value,false)
 bindings.discardScan=async()=>({state:'failed'})
 await componentFunction('PhotoScanner.vue','newCapture','async function complete(',bindings)()
 assert.equal(job.value,null);assert.equal(removed,true);assert.equal(accepted.value,false)
})

test('likeness acceptance requires all three photo comparisons',()=>{
 const accepted={value:false},likenessChecks={value:['front','sides']}
 const accept=componentFunction('PhotoScanner.vue','acceptLikeness','async function observe(',{accepted,likenessChecks})
 accept();assert.equal(accepted.value,false)
 likenessChecks.value.push('details');accept();assert.equal(accepted.value,true)
})


test('batch mask review saves only selected drafts and retains completed saves on failure',async()=>{
 const images=[{id:'good',maskUrl:'/good',maskReviewed:false},{id:'bad',maskUrl:'/bad',maskReviewed:false},{id:'done',maskUrl:'/done',maskReviewed:true},{id:'missing',maskReviewed:false}]
 const job={value:{id:'capture',state:'uploading',images,maskCount:1}},busy={value:false},error={value:''},progress={value:''},saved=[]
 const bindings={job,busy,error,progress,closed:false,savedPhotoMaskPng:async image=>image.id,remember:value=>{job.value=value},saveScanMask:async(id,imageId,png)=>{
  assert.equal(id,'capture');assert.equal(png,imageId)
  if(imageId==='bad')throw new Error('Connection lost')
  saved.push(imageId)
  return {...job.value,maskCount:2,images:job.value.images.map(image=>image.id===imageId?{...image,maskReviewed:true}:image)}
 }}
 await componentFunction('PhotoScanner.vue','saveReviewedMasks','async function batchMasks(',bindings)(['good','bad','done','missing'])
 assert.deepEqual(saved,['good']);assert.equal(job.value.maskCount,2);assert.equal(error.value,'Connection lost');assert.equal(busy.value,false)
 assert.equal(job.value.images.find(image=>image.id==='bad').maskReviewed,false)
 saved.length=0;error.value=''
 await componentFunction('PhotoScanner.vue','saveReviewedMasks','async function batchMasks(',bindings)(['good','missing'])
 assert.deepEqual(saved,[]);assert.equal(error.value,'')
 busy.value=true
 await componentFunction('PhotoScanner.vue','saveReviewedMasks','async function batchMasks(',bindings)(['bad'])
 assert.equal(error.value,'');assert.equal(busy.value,true)
})

test('batch mask selection excludes unloaded, failed, absent, and already reviewed masks',()=>{
 const props={saving:false},visible={value:[{id:'good',maskUrl:'/good'},{id:'loading',maskUrl:'/loading'},{id:'failed',maskUrl:'/failed'},{id:'reviewed',maskUrl:'/reviewed',maskReviewed:true},{id:'missing'}]}
 const ready={value:{good:true,reviewed:true,missing:true}},selected={value:[]}
 const select=componentFunction('ScanMaskReview.vue','selectVisible','async function loadPreviews(',{props,visible,ready,selected})
 select();assert.deepEqual(selected.value,['good'])
 props.saving=true;selected.value=[];select();assert.deepEqual(selected.value,[])
})


test('AI mask queue uses current capture and preserves masks when API fails',async()=>{
 const job={value:{id:'photos',state:'uploading',images:[{id:'draft'}]}},busy={value:false},error={value:''},maskImageId={value:'draft'}
 let observed=0,calls=0
 const bindings={job,busy,error,maskImageId,closed:false,generateScanMasks:async id=>{calls++;assert.equal(id,'photos');return {...job.value,state:'queued'}},remember:value=>{job.value=value},observe:async()=>{observed++}}
 await componentFunction('PhotoScanner.vue','generateAiMasks','async function saveMask(',bindings)()
 assert.equal(job.value.state,'queued');assert.equal(maskImageId.value,null);assert.equal(observed,1);assert.equal(busy.value,false)
 job.value.state='uploading';maskImageId.value='draft';bindings.generateScanMasks=async()=>{throw new Error('AI unavailable')}
 await componentFunction('PhotoScanner.vue','generateAiMasks','async function saveMask(',bindings)()
 assert.equal(job.value.images[0].id,'draft');assert.equal(maskImageId.value,'draft');assert.equal(error.value,'AI unavailable');assert.equal(busy.value,false)
 busy.value=true;await componentFunction('PhotoScanner.vue','generateAiMasks','async function saveMask(',bindings)();assert.equal(calls,1)
})


test('retired capture cannot replace active Tripo state or its saved pointer',()=>{
 const job={value:{id:'current',engine:'tripo'}},localStorage={setItem(){throw new Error('Retired capture must not be remembered')}}
 const remember=componentFunction('PhotoScanner.vue','remember','async function tripoQueued(',{job,localStorage,storageKey:'saved'})
 assert.throws(()=>remember({id:'old',engine:'meshroom'}),/retired/);assert.equal(job.value.id,'current')
})

test('startup ignores saved local capture without deleting it and offers only saved Tripo generations',async()=>{
 const source=readFileSync(new URL('../src/components/PhotoScanner.vue',import.meta.url),'utf8').replaceAll('\r\n','\n'),start=source.indexOf('onMounted(async()=>{')+'onMounted(async()=>{'.length,end=source.indexOf('\n})\nonBeforeUnmount',start)
 assert.ok(end>start)
 const legacy={id:'legacy',engine:'meshroom',state:'ready'},tripo={id:'tripo',engine:'tripo',state:'uploading'},job={value:null},recoverable={value:[]},removed=[]
 const bindings={job,recoverable,maskAvailable:{value:false},tripoAvailable:{value:false},error:{value:''},storageKey:'saved',localStorage:{getItem:()=>legacy.id,removeItem:key=>removed.push(key)},fetchScanJob:async id=>{assert.equal(id,legacy.id);return legacy},api:async endpoint=>endpoint.includes('capabilities')?{aiMasks:true,tripo:true}:{jobs:[legacy,tripo]},remember(){throw new Error('Must not restore retired engine')},observe(){throw new Error('Must not restart retired engine')}}
 await new Function(...Object.keys(bindings),'return(async()=>{'+source.slice(start,end)+'})()')(...Object.values(bindings))
 assert.equal(job.value,null);assert.deepEqual(removed,['saved']);assert.deepEqual(recoverable.value,[tripo]);assert.equal(legacy.state,'ready')
})

test('region save captures only kept original-texture geometry and releases it on failure',async()=>{
 const {Mesh,BufferGeometry}=await import('three')
 const geometry=new BufferGeometry();geometry.dispose=function(){this.disposed=true}
 const original={name:'original'},mesh={material:[original],localToWorld(point){return point}}
 const payload={},busy={value:false},error={value:''},charm={value:null}
 let emitted,refreshes=0
 const bindings={busy,props:{saving:false},fills:{value:[]},error,up(){},exportScanRegions:async()=>payload,mesh,state:{},buildRegionGroups:()=>({geometry}),THREE:{Mesh},charm,refresh(){refreshes++},emit:(_,value)=>{emitted=value},captureShoeThumbnail:async shoe=>{
  assert.equal(shoe.geometry,geometry);assert.equal(shoe.material,original)
  return 'transparent-auto-fit-png'
 }}
 await componentFunction('ScanRegionEditor.vue','finish','onMounted(',bindings)()
 assert.equal(emitted.payload.thumbnail,'transparent-auto-fit-png')
 assert.equal(geometry.disposed,true);assert.equal(busy.value,false);assert.equal(refreshes,1)
 geometry.disposed=false;emitted=null
 bindings.captureShoeThumbnail=async()=>{throw new Error('WebGL capture failed')}
 await componentFunction('ScanRegionEditor.vue','finish','onMounted(',bindings)()
 assert.equal(emitted,null);assert.equal(error.value,'WebGL capture failed');assert.equal(geometry.disposed,true);assert.equal(busy.value,false)
})

test('dragging scan preview color reuses geometry/materials and skips painting refresh',async()=>{
 const THREE=await import('three'),state={},scene={objects:[],add(object){this.objects.push(object)}},mode={value:'paint'},busy={value:false}
 let builds=0,switches=0
 const texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture})
 const bindings={THREE,state,scene,mode,busy,mesh:{material:[material]},fills:{value:[]},error:{value:''},previewColors:{},previewMesh:null,previewParts:[],neutralMap:new THREE.Texture(),neutralPreparing:null,disposed:false,region:{value:'laces'},testColor:{value:'#112233'},buildRegionGroups(){builds++;return {geometry:new THREE.BufferGeometry(),parts:[{id:'laces'}]}},setMode(value){switches++;mode.value=value}}
 const preview=componentFunction('ScanRegionEditor.vue','previewColor','async function finish()',bindings)
 await preview();bindings.testColor.value='#445566';await preview();bindings.testColor.value='#778899';await preview()
 assert.equal(builds,1);assert.equal(scene.objects.length,1);assert.equal(switches,1)
 assert.equal(scene.objects[0].material[1].color.getHexString(),'778899')
})
