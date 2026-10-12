import test from 'node:test'
import assert from 'node:assert/strict'
import * as capture from '../src/scan-capture.js'
test('prepared scan recovery remains until the matching catalog shoe is saved',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage');let current='12345678-1234-4234-8234-123456789abc'
 Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:{getItem(){return current},removeItem(){current=null}}})
 try {
  capture.forgetCompletedScan('/models/another-shoe.glb');assert.ok(current)
  capture.forgetCompletedScan('/models/uploads/scan-'+current+'.glb');assert.equal(current,null)
 }finally{if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage}
})
