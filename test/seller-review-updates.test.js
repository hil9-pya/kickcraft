import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=readFileSync(new URL('../src/components/SellerDashboard.vue',import.meta.url),'utf8')
test('quiet refresh fetches product approvals and leaves unsaved editor values intact',async()=>{
 const start=source.indexOf('async function refresh('),end=source.indexOf('async function create(',start)
 const pending={id:'shoe',name:'Saved shoe',publicationState:'pending'},editing={value:{...pending,name:'Unsaved edit'}}
 const bindings={closed:false,refreshing:false,profile:{value:{status:'approved'}},products:{value:[pending]},orders:{value:[]},editing,store:{storeName:'Unsaved store'},loading:{value:false},error:{value:''},scanning:{value:false},uploading:{value:false},reviewNotices:{value:[]},emit(){},api:async path=>{
  if(path==='sellers/profile.php')return {seller:{status:'approved',storeName:'Saved store'}}
  if(path==='products/list.php?include_archived=1')return {shoes:[{...pending,publicationState:'approved',reviewNote:'Looks good'}]}
  if(path==='sellers/orders.php')return {reservations:[]}
  throw Error('Unexpected API')
 }}
 const refresh=new Function(...Object.keys(bindings),source.slice(start,end)+';return refresh')(...Object.values(bindings))
 await refresh(true)
 assert.equal(bindings.products.value[0].publicationState,'approved')
 assert.equal(editing.value.name,'Unsaved edit');assert.equal(editing.value.publicationState,'approved')
 assert.equal(bindings.store.storeName,'Unsaved store')
 assert.match(bindings.reviewNotices.value[0],/approved/i)
 bindings.api=async path=>path==='sellers/profile.php'?{seller:{status:'approved'}}:path==='products/list.php?include_archived=1'?{shoes:[{...pending,publicationState:'draft'}]}:{reservations:[]}
 const nextRefresh=new Function(...Object.keys(bindings),source.slice(start,end)+';return refresh')(...Object.values(bindings))
 await nextRefresh(true);assert.deepEqual(bindings.reviewNotices.value,[],'withdrawn draft clears stale approval notice')
})
