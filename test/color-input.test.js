import test from 'node:test'
import assert from 'node:assert/strict'
import {frameLatest} from '../src/color-input.js'
import {readRecentColors,rememberColor,recentColors} from '../src/color-history.js'
test('picker drag coalesces to latest value per frame and final value can flush immediately',()=>{
 let queued,cancelled=0;const applied=[]
 const input=frameLatest(value=>applied.push(value),callback=>{queued=callback;return 1},()=>{cancelled++})
 input('#112233');input('#445566');input('#778899');assert.deepEqual(applied,[])
 queued();assert.deepEqual(applied,['#778899'])
 input('#abcdef');input.flush();assert.equal(applied.at(-1),'#abcdef');assert.equal(cancelled,1)
 input('#ffffff');input.cancel();assert.equal(applied.length,2)
})
test('recent colors normalize and deduplicate, survive reload, and tolerate disabled storage',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}
 rememberColor('#13ABCD',storage);rememberColor('#b93fd4',storage);rememberColor('#13abcd',storage);rememberColor('red',storage)
 assert.deepEqual(readRecentColors(storage),['#13abcd','#b93fd4']);assert.deepEqual(recentColors.value,readRecentColors(storage))
 for(let i=0;i<12;i++)rememberColor('#'+i.toString(16).padStart(6,'0'),storage)
 assert.equal(readRecentColors(storage).length,8)
 assert.deepEqual(readRecentColors({getItem:()=>'{broken'}),[])
 assert.doesNotThrow(()=>rememberColor('#ffffff',{getItem(){throw Error('Blocked')},setItem(){throw Error('Blocked')}}))
})
