import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {checkoutRequestId,forgetCheckoutRequest} from '../src/checkout-request.js'
const body={customerName:'Guest Check',email:'guest-check@example.test',pickupDate:'2026-12-01',shoeId:'shoe-one',size:9,charmId:'none',partColors:{upper:{name:'Custom',value:'#13ABCD'},laces:{value:'#ffffff'}}}
test('same checkout retains one request across retries, reload and concurrent calls without storing guest details',async()=>{
 const previous=globalThis.localStorage,store=new Map()
 globalThis.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)}
 try{
  const id=await checkoutRequestId(body)
  assert.deepEqual(await Promise.all([checkoutRequestId(body),checkoutRequestId({...body,email:body.email.toUpperCase(),partColors:{laces:{value:'#FFFFFF'},upper:{name:'Renamed',value:'#13abcd'}}})]),[id,id])
  const reloaded=await import('../src/checkout-request.js?reload')
  assert.equal(await reloaded.checkoutRequestId(body),id)
  assert.ok(![...store.values()][0].includes(body.email));assert.ok(![...store.values()][0].includes(body.customerName))
  forgetCheckoutRequest('unrelated');assert.equal(await checkoutRequestId(body),id)
  forgetCheckoutRequest(id);assert.notEqual(await checkoutRequestId(body),id)
  const changed=await checkoutRequestId({...body,size:10});assert.notEqual(changed,id)
  forgetCheckoutRequest(changed)
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
})
test('blocked browser storage still keeps retries stable within the open checkout',async()=>{
 const previous=globalThis.localStorage
 globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}}
 try{const id=await checkoutRequestId(body);assert.equal(await checkoutRequestId(body),id);forgetCheckoutRequest(id)}finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
})

test('checkout keeps request after a lost response and stops duplicate submit calls after success',async()=>{
 const source=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8'),start=source.indexOf('async function submitReservation()'),end=source.indexOf('// ── View routing',start)
 const requests=[],bindings={checkoutRequestId,forgetCheckoutRequest,customerName:{value:body.customerName},customerEmail:{value:body.email},pickupDate:{value:body.pickupDate},selectedShoe:{value:{id:body.shoeId}},selectedSize:{value:9},partColors:{value:body.partColors},selectedCharm:{value:{id:'none',label:'None'}},reserved:{value:false},isSubmitting:{value:false},reservationError:{value:''},reservationReceipt:{value:null},adminShoes:{value:[]},saveGuestProfile(){},BroadcastChannel:undefined,api:async(endpoint,options)=>{
  if(endpoint==='shoes/list.php')return {shoes:[]}
  requests.push(options.body)
  if(requests.length===1)throw Error('Response lost')
  return {reservation:{id:'KC-2026-1234'}}
 }}
 const submit=new Function(...Object.keys(bindings),'return '+source.slice(start,end))(...Object.values(bindings))
 await submit();assert.equal(bindings.reserved.value,false);assert.equal(bindings.reservationError.value,'Response lost')
 await submit();assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(bindings.reservationReceipt.value.id,'KC-2026-1234');assert.equal(bindings.reserved.value,true)
 await submit();assert.equal(requests.length,2)
 bindings.reserved.value=false;bindings.isSubmitting.value=true;await submit();assert.equal(requests.length,2)
})
