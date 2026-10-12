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
 let removed=false,cleared=false
 const bindings={job,busy,error,accepted,progress,maskImageId:{value:null},likenessChecks:{value:[]},referenceId:{value:null},timer:null,clearTimeout(){},clearFiles(){cleared=true},discardScan:async id=>{assert.equal(id,'saved-scan');throw new Error('Reconstruction still active')},localStorage:{removeItem(){removed=true}},storageKey:'scan'}
 await componentFunction('PhotoScanner.vue','newCapture','async function complete(',bindings)()
 assert.equal(job.value.id,'saved-scan');assert.equal(removed,false);assert.equal(cleared,false);assert.equal(error.value,'Reconstruction still active');assert.equal(busy.value,false)
 bindings.discardScan=async()=>({state:'failed'})
 await componentFunction('PhotoScanner.vue','newCapture','async function complete(',bindings)()
 assert.equal(job.value,null);assert.equal(removed,true);assert.equal(cleared,true);assert.equal(accepted.value,false)
})

test('likeness acceptance requires all three photo comparisons',()=>{
 const accepted={value:false},likenessChecks={value:['front','sides']}
 const accept=componentFunction('PhotoScanner.vue','acceptLikeness','async function start(',{accepted,likenessChecks})
 accept();assert.equal(accepted.value,false)
 likenessChecks.value.push('details');accept();assert.equal(accepted.value,true)
})


test('video frames append without replacing selected photos and cannot exceed saved capture capacity',()=>{
 const original={file:{name:'original.jpg'},url:'existing'},files={value:[original]},job={value:{imageCount:117}},error={value:''},progress={value:''}
 let created=0
 const bindings={closed:false,files,job,error,progress,URL:{createObjectURL(){return 'frame-'+(++created)}}}
 const append=componentFunction('PhotoScanner.vue','addVideoFrames','function remove(',bindings)
 append([{name:'view-1.jpg'},{name:'view-2.jpg'}])
 assert.equal(files.value.length,3);assert.equal(files.value[0],original);assert.equal(created,2)
 append([{name:'extra.jpg'}])
 assert.equal(files.value.length,3);assert.equal(created,2);assert.match(error.value,/120/)
 bindings.closed=true
 componentFunction('PhotoScanner.vue','addVideoFrames','function remove(',bindings)([{name:'late.jpg'}])
 assert.equal(files.value.length,3);assert.equal(created,2)
})
