import test from 'node:test'
import assert from 'node:assert/strict'
import {inflateSync} from 'node:zlib'
import {createForegroundMask,paintMask,resizeMask,rawMask,encodeMaskPng,maskCoverage,readSavedMask,savedPhotoMaskPng} from '../src/scan-masks.js'

test('background removal reaches image edges but preserves enclosed matching shoe detail',()=>{
 const colors=[0,0,0,0,0, 0,1,1,1,0, 0,1,0,1,0, 0,1,1,1,0, 0,0,0,0,0]
 const rgba=new Uint8ClampedArray(colors.flatMap(value=>value?[150,80,30,255]:[20,220,30,255]))
 const mask=createForegroundMask(rgba,5,5,[20,220,30],20)
 assert.deepEqual([...mask],[0,0,0,0,0, 0,255,255,255,0, 0,255,255,255,0, 0,255,255,255,0, 0,0,0,0,0])
 assert.equal(maskCoverage(mask),9/25)
})
test('mask brush restores shoe and removes background without touching outside pixels',()=>{
 const mask=new Uint8Array(25)
 paintMask(mask,5,5,2,2,1,true)
 assert.deepEqual([...mask],[0,0,0,0,0, 0,0,255,0,0, 0,255,255,255,0, 0,0,255,0,0, 0,0,0,0,0])
 paintMask(mask,5,5,2,2,0,false)
 assert.equal(mask[12],0);assert.equal(mask[7],255)
 assert.deepEqual([...resizeMask(new Uint8Array([255,0]),2,1,4,2)],[255,255,0,0,255,255,0,0])
})
test('portrait EXIF masks map back to raw photo coordinates including mirrored orientations',()=>{
 const upright=new Uint8Array([1,2,3,4,5,6])
 assert.deepEqual([...rawMask(upright,2,3,6)],[2,4,6,1,3,5])
 assert.deepEqual([...rawMask(upright,2,3,8)],[5,3,1,6,4,2])
 assert.deepEqual([...rawMask(new Uint8Array([1,2,3,4,5,6]),3,2,2)],[3,2,1,6,5,4])
})
test('mask PNG contains lossless full-resolution grayscale pixels for reconstruction',async()=>{
 const png=Buffer.from(await (await encodeMaskPng(new Uint8Array([0,255,255,0]),2,2)).arrayBuffer())
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),2);assert.equal(png.readUInt32BE(20),2)
 assert.equal(png[24],8);assert.equal(png[25],0)
 const idat=[];let at=8
 while(at<png.length){const n=png.readUInt32BE(at);if(png.subarray(at+4,at+8).toString()==='IDAT')idat.push(png.subarray(at+8,at+8+n));at+=n+12}
 assert.deepEqual([...inflateSync(Buffer.concat(idat))],[0,0,255,0,255,0])
})

test('saved mask loading handles EXIF and batch PNG keeps original raw dimensions',async()=>{
 const originalImage=globalThis.Image,originalDocument=globalThis.document,draws=[]
 const raw=[0,255,0,255,0,255]
 try {
  globalThis.Image=class {async decode(){}}
  globalThis.document={createElement(){const canvas={width:0,height:0};canvas.getContext=()=>({drawImage(){draws.push([canvas.width,canvas.height])},getImageData(){return {data:new Uint8ClampedArray(raw.flatMap(value=>[value,value,value,255]))}}});return canvas}}
  const image={maskUrl:'/draft.png',width:3,height:2,orientation:6}
  assert.deepEqual([...await readSavedMask(image,2,3)],[255,0,0,255,255,0])
  const png=Buffer.from(await (await savedPhotoMaskPng(image)).arrayBuffer())
  assert.equal(png.readUInt32BE(16),3);assert.equal(png.readUInt32BE(20),2)
  assert.deepEqual(draws,[[3,2],[3,2]])
  const n=png.readUInt32BE(33)
  assert.deepEqual([...inflateSync(png.subarray(41,41+n))],[0,0,255,0,0,255,0,255])
 }finally{globalThis.Image=originalImage;globalThis.document=originalDocument}
})
