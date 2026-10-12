import test from 'node:test'
import assert from 'node:assert/strict'
import {validateVideoInput,analyzeVideoFrame,selectVideoFrames,extractVideoFrames} from '../src/scan-video.js'

const file={type:'video/mp4',size:1000,name:'shoe.mp4'}
test('video input rejects oversized, unreadable, too short and excessive-resolution clips',()=>{
 assert.equal(validateVideoInput(file,{duration:60,width:1920,height:1080}),null)
 assert.ok(validateVideoInput({...file,size:301*1024*1024}))
 assert.ok(validateVideoInput({...file,type:'image/svg+xml',name:'shoe.svg'}))
 assert.ok(validateVideoInput(file,{duration:Infinity,width:1920,height:1080}))
 assert.ok(validateVideoInput(file,{duration:5,width:1920,height:1080}))
 assert.ok(validateVideoInput(file,{duration:181,width:1920,height:1080}))
 assert.ok(validateVideoInput(file,{duration:60,width:10000,height:10000}))
 assert.ok(validateVideoInput(file,{duration:60,width:320,height:240}))
 assert.ok(validateVideoInput(file,{duration:60,width:NaN,height:1080}))
 assert.ok(validateVideoInput(file,{duration:60,width:1920,height:undefined}))
})
function pixels(kind){
 const width=32,height=32,data=new Uint8ClampedArray(width*height*4)
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const n=(y*width+x)*4,value=kind==='sharp'?((x>>2)+(y>>2))%2*180+35:kind==='dark'?0:kind==='white'?255:125
  data[n]=data[n+1]=data[n+2]=value;data[n+3]=255
 }
 return {data,width,height}
}
test('sharpness and exposure screening distinguish real pixel detail from a flat or dark frame',()=>{
 const sharp=analyzeVideoFrame(pixels('sharp')),flat=analyzeVideoFrame(pixels('flat'))
 assert.ok(sharp.sharpness>1000);assert.ok(sharp.contrast>70)
 assert.equal(flat.sharpness,0);assert.equal(flat.contrast,0)
 assert.equal(analyzeVideoFrame(pixels('dark')).mean,0)
 assert.equal(analyzeVideoFrame(pixels('white')).clipped,1)
 assert.equal(sharp.signature.length,256)
})
function candidate(time,signature,sharpness=200){return {time,signature:new Uint8Array(256).fill(signature),sharpness,mean:100,contrast:40,clipped:0}}
test('frame selection keeps sharp distinct views spread across the complete recording',()=>{
 const frames=[]
 for(let i=0;i<60;i++)frames.push(candidate(i+.2,i*4),candidate(i+.6,i*4,300))
 const picked=selectVideoFrames(frames,60)
 assert.equal(picked.length,60)
 assert.equal(picked[0].time,.6);assert.equal(picked.at(-1).time,59.6)
 assert.ok(picked.every((frame,i)=>!i || frame.time>picked[i-1].time))
 const limited=selectVideoFrames(frames,60,30);assert.equal(limited.length,30);assert.ok(limited.at(-1).time>58)
})
test('a stationary, dark, blurred or incomplete video cannot silently produce a usable capture',()=>{
 const distinct=Array.from({length:60},(_,i)=>candidate(i+.5,i*4))
 assert.throws(()=>selectVideoFrames(distinct.map(f=>({...f,signature:new Uint8Array(256).fill(40)})),60),/distinct|recapture/i)
 assert.throws(()=>selectVideoFrames(distinct.map(f=>({...f,sharpness:0})),60),/sharp|recapture/i)
 assert.throws(()=>selectVideoFrames(distinct.map(f=>({...f,mean:0})),60),/sharp|recapture/i)
 assert.throws(()=>selectVideoFrames(distinct.filter(f=>f.time<35),60),/gap|coverage|recapture/i)
 assert.throws(()=>selectVideoFrames(distinct,60,20),/room|30/i)
})


test('canceled extraction and invalid files never start decoding or upload anything',async()=>{
 const controller=new AbortController();controller.abort()
 await assert.rejects(extractVideoFrames(file,{signal:controller.signal}),{name:'AbortError'})
 await assert.rejects(extractVideoFrames({...file,type:'image/svg+xml'}),/MP4|WebM|MOV/)
})
