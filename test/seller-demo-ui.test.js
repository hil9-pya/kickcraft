import test,{after} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import {createServer} from 'vite'
import vue from '@vitejs/plugin-vue'
import * as Vue from 'vue'
import {renderToString} from '@vue/server-renderer'
import {parse} from '@vue/compiler-sfc'
import {compile} from '@vue/compiler-dom'
import {pickupActions,pickupLabels} from '../src/seller.js'
const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-seller-demo-tests',plugins:[vue({template:{compilerOptions:{isCustomElement:tag=>tag==='model-viewer'}}})],resolve:{alias:{'@':path.resolve('src')}},server:{middlewareMode:true,hmr:false},appType:'custom'})
after(()=>server.close())
const component=async name=>(await server.ssrLoadModule('/src/components/'+name+'.vue')).default
const render=async (component,props)=>renderToString(Vue.createSSRApp({render:()=>Vue.h(component,props)}))

test('photo creation removes demo noise and keeps explicit cloud confirmation',async()=>{
 const html=await render(await component('TripoCapture'),{available:true,job:{id:'saved',state:'uploading',images:[{view:'front',previewUrl:'/front.png',maskReviewed:true}],imageCount:1,maskCount:0}})
 assert.doesNotMatch(html,/credits|\$0\.30|\(required\)|\(optional\)|I agree|Nothing is approved|normal product\/admin review/i)
 assert.match(html,/Front \/ three-quarter/)
 assert.match(html,/>Generate shoe</)
 assert.doesNotMatch(html,/<button[^>]*disabled[^>]*>Generate shoe</)
})

test('generation needs confirmation and valid reviewed inputs; repeated confirmation cannot start twice',async()=>{
 const source=readFileSync(new URL('../src/components/TripoCapture.vue',import.meta.url),'utf8').replaceAll('\r\n','\n')
 const start=source.indexOf('async function generate()'),end=source.indexOf('\n}',start)
 assert.ok(start>=0&&end>start)
 const fn=source.slice(start,end+2)
 for(const invalid of [{confirming:{value:false}},{masksReady:{value:false}},{hasFiles:{value:true}},{saved:{value:{}}},{props:{job:{id:'saved'},available:false,disabled:false}},{props:{job:{id:'saved'},available:true,disabled:true}}]){
  let starts=0
  const values={props:{job:{id:'saved'},available:true,disabled:false},confirming:{value:true},masksReady:{value:true},hasFiles:{value:false},saved:{value:{front:{}}},useMasks:{value:true},error:{value:''},emit(){},startTripoScan:async()=>{starts++},...invalid}
  await new Function(...Object.keys(values),'return '+fn)(...Object.values(values))()
  assert.equal(starts,0)
 }
 let starts=0
 const values={props:{job:{id:'saved'},available:true,disabled:false},confirming:{value:true},masksReady:{value:true},hasFiles:{value:false},saved:{value:{front:{}}},useMasks:{value:true},error:{value:''},emit(){},startTripoScan:async(id,masks)=>{starts++;assert.equal(id,'saved');assert.equal(masks,true);return {id}}}
 const generate=new Function(...Object.keys(values),'return '+fn)(...Object.values(values))
 await generate();await generate();assert.equal(starts,1)
})

test('seller thumbnails frame the model with a static lazy preview and retain image fallback',async()=>{
 const thumb=await component('ShoeThumbnail')
 const html=await render(thumb,{src:'/models/original.glb',image:'/old.png',alt:'Original shoe'})
 assert.match(html,/<model-viewer[^>]*src="\/models\/original.glb"/)
 assert.match(html,/camera-orbit="45deg 70deg 110%"/)
 assert.match(html,/loading="lazy"/)
 assert.doesNotMatch(html,/camera-controls|auto-rotate/)
 assert.match(await render(thumb,{image:'/fallback.png',alt:'Original shoe'}),/<img[^>]*src="\/fallback.png"[^>]*alt="Original shoe"/)
})

test('pickup layout keeps customer, pickup, notes and all valid status actions',async()=>{
 const {descriptor}=parse(readFileSync(new URL('../src/components/SellerDashboard.vue',import.meta.url),'utf8'))
 const draw=new Function('Vue',compile(descriptor.template.content,{prefixIdentifiers:true}).code)(Vue)
 const Button=await component('ui/button/Button'),Textarea=await component('ui/textarea/Textarea')
 for(const status of Object.keys(pickupLabels)){
  const order={id:'KC-DEMO-1',shoeName:'Original shoe',size:9,status,customerName:'Demo buyer',email:'buyer@example.test',pickupDate:'2026-10-25',price:1234,pickupStore:'Original Studio',pickupAddress:'Demo pickup address',partColors:{upper:{name:'White',value:'#ffffff'}},charmLabel:'Star',notes:'Keep original colors'}
  const values={profile:{status:'approved',storeName:'Original Studio',tutorialStep:5},user:{id:99},tab:'orders',loading:false,busy:false,error:'',message:'',reviewNotices:[],products:[],orders:[order],visibleOrders:[order],editing:null,scanning:false,uploading:false,guide:null,store:{},orderFilter:'all',orderNotes:{},completing:null,leaving:null,productAction:null,pickupActions,pickupLabels,refresh(){},navigate(){},updateOrder(){},tutorial(){}}
  const app=Vue.createSSRApp({render:draw,setup:()=>values})
  app.component('Button',Button);app.component('Textarea',Textarea)
  for(const name of ['ConfirmModal','SharedTemplateLibrary','SellerProductEditor','ShoeThumbnail','PhotoScanner','Input'])app.component(name,{render:()=>null})
  const html=(await renderToString(app)).replace(/<!--.*?-->/gs,'')
  assert.match(html,/class="[^"]*order-card/)
  for(const text of ['Demo buyer','buyer@example.test','2026-10-25','Demo pickup address','KC-DEMO-1','Keep original colors','Star'])assert.ok(html.includes(text),text)
  for(const [target,label]of Object.entries({approved:'Confirm order',ready:'Mark ready',completed:'Complete pickup',cancelled:'Cancel order'}))assert.equal(html.includes('>'+label+'</button>'),pickupActions[status].includes(target),status+' -> '+target)
 }
})
