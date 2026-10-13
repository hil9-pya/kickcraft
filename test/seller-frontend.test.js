import test from 'node:test'

import assert from 'node:assert/strict'

import {validateSeller,validateProduct,publicCatalog,palettePresets} from '../src/seller.js'

import {scanStorageKey,forgetCompletedScan} from '../src/scan-capture.js'

const seller={name:'Test Seller',email:'test@example.com',password:'strong-password',confirmPassword:'strong-password',storeName:'Original Studio',pickupAddress:'Manila studio',description:'',contact:''}

test('seller registration validates identity, confirmation, and pickup location',()=>{

 assert.equal(validateSeller(seller),'')

 for(const patch of [{email:'bad'},{confirmPassword:'different'},{password:'short',confirmPassword:'short'},{pickupAddress:''},{storeName:'x'}])assert.ok(validateSeller({...seller,...patch}))

})

test('product validation catches stock, sizes, and missing materials',()=>{

 const product={name:'Original shoe',description:'Made locally',price:1234,stock:2,sizes:[9],parts:[{id:'upper',label:'Upper'},{id:'sole',label:'Sole'}],colors:[{name:'White',value:'#ffffff'}]}

 assert.equal(validateProduct(product),'')
 assert.equal(validateProduct({...product,parts:[]},false),'','raw upload details can save privately')
 assert.ok(validateProduct({...product,parts:[]},true),'raw upload cannot submit')
 assert.ok(validateProduct({...product,parts:[{label:''}]},false),'draft labels still validated')

 for(const patch of [{price:0},{stock:1.5},{sizes:[]},{sizes:[16]},{parts:[]},{colors:[{name:'Bad',value:'red'}]}])assert.ok(validateProduct({...product,...patch}))

})

test('successful empty public catalog never revives fallback products',()=>{

 assert.deepEqual(publicCatalog([],true,[{id:'fallback'}]),[])

 assert.deepEqual(publicCatalog([],false,[{id:'fallback'}]),[{id:'fallback'}])

})

test('scan recovery stays isolated between accounts',()=>{

 const store=new Map([[scanStorageKey(11),'one'],[scanStorageKey(22),'two']])

 globalThis.localStorage={getItem:k=>store.get(k),removeItem:k=>store.delete(k)}

 forgetCompletedScan('/models/uploads/scan-one.glb',22)

 assert.equal(store.get(scanStorageKey(11)),'one')

 forgetCompletedScan('/models/uploads/scan-one.glb',11)

 assert.equal(store.has(scanStorageKey(11)),false)

 assert.equal(store.get(scanStorageKey(22)),'two')

 delete globalThis.localStorage

})


test('customer presets use only the actual product palette',()=>{
 const palette=[{name:'White',value:'#ffffff'},{name:'Rust',value:'#b94d27'}]
 const presets=palettePresets(palette)
 assert.ok(presets.length)
 for(const preset of presets)for(const color of preset.colors)assert.ok(palette.includes(color))
 assert.deepEqual(palettePresets([]),[])
})
