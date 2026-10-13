import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../src/components/SellerModeration.vue',import.meta.url),'utf8').replaceAll('\r\n','\n')
const start=source.indexOf('async function load()'),end=source.indexOf('async function loaded()',start)
function reviewState(current,incoming){
 const refs={rows:{value:[]},selected:{value:current},ready:{value:true},source:{value:{old:true}},reference:{value:{old:true}},original:new Map(),part:{value:'OldMaterial'},photoReviewed:{value:true},testedParts:{value:['OldMaterial','OtherMaterial']},notes:{[current.id]:'Unsaved review note'},error:{value:''},loading:{value:false},busy:{value:false},reviewPanel:{value:null}}
 const calls=[]
 const bindings={...refs,props:{mode:'products'},reviewArea:()=> 'products',nextTick:async()=>{},api:async endpoint=>{calls.push(endpoint);return endpoint.includes('/list.php')?{shoes:incoming}:{job:{images:[{id:'photo',name:'original.png'}]}}}}
 const methods=new Function(...Object.keys(bindings),'let selection=0,loadRequest=0,closed=false;'+source.slice(start,end)+';return {load,inspect,version:()=>selection}')(...Object.values(bindings))
 return {...refs,...methods,calls}
}
const draft={id:'shoe',publicationState:'draft',glbPath:'/old.glb',sourceScanId:'capture',parts:[{id:'upper',material:'UpperMaterial'}]}

test('refresh replaces the inspected draft with the resubmitted product and resets old model checks',async()=>{
 const pending={...draft,publicationState:'pending',glbPath:'/revised.glb',parts:[{id:'upper',material:'NewUpper'},{id:'sole',material:'NewSole'}]}
 const state=reviewState(draft,[pending]);await state.load()
 assert.equal(state.selected.value.publicationState,'pending');assert.equal(state.selected.value.glbPath,'/revised.glb')
 assert.equal(state.ready.value,false);assert.equal(state.photoReviewed.value,false);assert.deepEqual(state.testedParts.value,[])
 assert.equal(state.part.value,'NewUpper');assert.equal(state.source.value.images[0].id,'photo');assert.equal(state.version(),1)
 assert.equal(state.notes.shoe,'Unsaved review note')
})

test('unchanged queue refresh keeps ongoing part tests, photo checks and notes',async()=>{
 const pending={...draft,publicationState:'pending'}
 const state=reviewState(pending,[{...pending,stock:4}]);await state.load()
 assert.equal(state.selected.value.stock,4);assert.equal(state.ready.value,true);assert.equal(state.photoReviewed.value,true)
 assert.deepEqual(state.testedParts.value,['OldMaterial','OtherMaterial']);assert.equal(state.version(),0)
 assert.equal(state.notes.shoe,'Unsaved review note');assert.equal(state.calls.length,1)
})

test('refresh closes an inspection removed from the queue',async()=>{
 const state=reviewState(draft,[]);await state.load()
 assert.equal(state.selected.value,null);assert.equal(state.source.value,null);assert.equal(state.ready.value,false)
})

test('a failed refresh preserves the inspection and its unsaved note',async()=>{
 const bindings={props:{mode:'products'},reviewArea:()=> 'products',rows:{value:[]},selected:{value:draft},error:{value:''},loading:{value:false},api:async()=>{throw Error('Connection unavailable')}}
 const load=new Function(...Object.keys(bindings),'let loadRequest=0,closed=false;'+source.slice(start,source.indexOf('async function inspect(',start))+';return load')(...Object.values(bindings))
 await load();assert.equal(bindings.selected.value,draft);assert.equal(bindings.error.value,'Connection unavailable');assert.equal(bindings.loading.value,false)
})

test('new part boundaries on the same model URL require fresh checks',async()=>{
 const pending={...draft,publicationState:'pending'}
 const state=reviewState(pending,[{...pending,parts:[{id:'sole',material:'RevisedSole'}]}]);await state.load()
 assert.equal(state.part.value,'RevisedSole');assert.equal(state.photoReviewed.value,false);assert.deepEqual(state.testedParts.value,[])
 assert.equal(state.version(),1)
})

test('background refresh skips hidden, busy, loading and closed inspections',()=>{
 const start=source.indexOf('function refreshSelected()'),end=source.indexOf('\n}',start)
 assert.ok(start>=0&&end>start)
 for(const overrides of [{},{document:{hidden:true}},{busy:{value:true}},{loading:{value:true}},{selected:{value:null}}]){
  let reads=0
  const values={selected:{value:draft},busy:{value:false},loading:{value:false},document:{hidden:false},load(){reads++},...overrides}
  new Function(...Object.keys(values),'return '+source.slice(start,end+2))(...Object.values(values))()
  assert.equal(reads,Object.keys(overrides).length?0:1)
 }
})
