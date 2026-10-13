import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parse} from '@vue/compiler-sfc'
import {compile} from '@vue/compiler-dom'
import * as Vue from 'vue'
import {renderToString} from '@vue/server-renderer'
const {descriptor}=parse(readFileSync(new URL('../src/components/PhotoScanner.vue',import.meta.url),'utf8'))
const render=new Function('Vue',compile(descriptor.template.content,{prefixIdentifiers:true,isCustomElement:tag=>tag==='model-viewer'}).code)(Vue)
const stub={render:()=>Vue.h('div','Tripo reference photos')}
async function screen(changes={}){
 const values={job:null,error:'',busy:false,files:[],recoverable:[],nativeAvailable:true,tripoAvailable:true,maskAvailable:true,selectedEngine:'meshroom',tripoMode:false,nativeVideo:false,missingCalibration:0,maskImage:null,maskColor:'#20dc1e',maskTolerance:80,accepted:false,likenessChecks:[],referenceImage:null,progress:'',emit(){},chooseAnotherCapture(){},recover(){},choose(){},upload(){},uploadVideo(){},addVideoFrames(){},remove(){},generateAiMasks(){},remember(){},tripoQueued(){},newCapture(){},saveMask(){},saveReviewedMasks(){},batchMasks(){},start(){},observe(){},acceptLikeness(){},complete(){},...changes}
 const app=Vue.createSSRApp({render,setup:()=>values});for(const name of ['TripoCapture','ScanVideoCapture','ScanPhotoMask','ScanMaskReview','ScanRegionEditor','Button'])app.component(name,name==='Button'?{render(){return Vue.h('button',this.$slots.default?.())}}:stub)
 return renderToString(app)
}
test('new shoe creation renders Tripo directly without local capture, video, or alignment controls',async()=>{
 const html=await screen();assert.match(html,/Tripo reference photos/);assert.doesNotMatch(html,/Local photo|Video with AI|Choose photos|Start reconstruction|Capture method|80%|65%|Scan a shoe from photos or video/)
})
test('Tripo processing retains local mask status and explicit cloud generation message',async()=>{
 const mask=await screen({job:{id:'mask',engine:'tripo',state:'queued',operation:'mask',stage:'Removing backgrounds'}})
 assert.match(mask,/Removing backgrounds locally/)
 const cloud=await screen({job:{id:'cloud',engine:'tripo',state:'processing',operation:'reconstruct',stage:'Generating'}})
 assert.match(cloud,/continues the existing task/)
})
test('Tripo ready models still require all photo comparisons before part editing',async()=>{
 const job={id:'ready',engine:'tripo',state:'ready',images:[],previewUrl:'/private.glb'}
 const html=await screen({job});assert.match(html,/Check all views before marking parts/);assert.match(html,/<button[^>]*disabled[^>]*>Shape matches/)
})
