import test, {after} from 'node:test'
import {createServer} from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {parse} from '@vue/compiler-sfc'
import {compile} from '@vue/compiler-dom'
import * as Vue from 'vue'
import {renderToString} from '@vue/server-renderer'
const server=await createServer({configFile:false,cacheDir:'node_modules/.vite-template-tests',plugins:[vue()],resolve:{alias:{'@':path.resolve('src')}},server:{middlewareMode:true,hmr:false},appType:'custom'})
after(()=>server.close())
const shared={}
for(const name of ['Button','Input','Textarea'])shared[name]=(await server.ssrLoadModule('/src/components/ui/'+name.toLowerCase()+'/'+name+'.vue')).default
shared.Slider=(await server.ssrLoadModule('/src/components/ui/slider/Slider.vue')).default
async function renderScreen(render,values){const app=Vue.createSSRApp({render,setup:()=>values});for(const [name,component]of Object.entries(shared))app.component(name,component);for(const name of ['PhotoScanner','SellerProductEditor','SharedTemplateLibrary','ConfirmModal'])app.component(name,{render:()=>null});return (await renderToString(app)).replace(/<!--.*?-->/gs,'')}
const {descriptor}=parse(readFileSync(new URL('../src/components/SellerModeration.vue',import.meta.url),'utf8'))
const render=new Function('Vue',compile(descriptor.template.content,{prefixIdentifiers:true,isCustomElement:tag=>tag==='model-viewer'}).code)(Vue)
const shoe={id:'shared-check',name:'Shared original shoe',description:'Original fixture',glbPath:'/models/check.glb',storeName:'Creator Studio',parts:[{id:'upper',label:'Upper',material:'UpperMaterial'},{id:'midsole',label:'Midsole',material:'MidsoleMaterial'}],publicationState:'pending',sourceScanId:'capture'}
async function screen(changes={}){
 const values={mode:'templates',ready:true,selected:shoe,source:{images:[]},reference:null,rows:[],filter:'all',error:'',busy:false,loading:false,notes:{},part:'UpperMaterial',testedParts:[],photoReviewed:false,load(){},loaded(){},recolor(){},reset(){},review(){},inspect(){},...changes}
 return renderScreen(render,values)
}
test('shared template review renders without product price, stock or sizes; approval needs photos and two parts',async()=>{
 const pending=await screen()
 assert.match(pending,/Creator: Creator Studio/);assert.doesNotMatch(pending,/US sizes|NaN/)
 assert.match(pending,/<button[^>]*\sdisabled(?=[\s=>])[^>]*>Approve shared template<\/button>/)
 const ready=await screen({photoReviewed:true,testedParts:['UpperMaterial','MidsoleMaterial']})
 assert.match(ready,/<button\b(?![^>]*\sdisabled(?=[\s=>]))[^>]*>Approve shared template<\/button>/)
 const loading=await screen({ready:false});assert.match(loading,/<button\b[^>]*\sdisabled(?=[\s=>])[^>]*>Test rust<\/button>/)
})
test('seller product review still includes inventory and sizes',async()=>{
 const html=await screen({mode:'products',selected:{...shoe,price:1234,stock:2,sizes:[8,9],pickupAddress:'Pickup Studio'}})
 assert.match(html,/US sizes: 8, 9/);assert.match(html,/2 pairs/);assert.match(html,/Approve listing/)
})


async function renderFile(file,values){
 const {descriptor}=parse(readFileSync(new URL('../src/components/'+file,import.meta.url),'utf8'))
 const render=new Function('Vue',compile(descriptor.template.content,{prefixIdentifiers:true,isCustomElement:tag=>['model-viewer','extra-model'].includes(tag)}).code)(Vue)
 return renderScreen(render,values)
}
test('template library requires own photo and match confirmation; pending templates offer no reuse form',async()=>{
 const values={templates:[],selected:{...shoe,canReuse:true},viewer:null,part:'UpperMaterial',error:'',busy:false,loading:false,file:null,photoUrl:'',matches:false,load(){},choosePhoto(){},useTemplate(){},loaded(){},recolor(){},reset(){},clearPhoto(){}}
 const html=await renderFile('SharedTemplateLibrary.vue',values)
 assert.match(html,/Your matching-shoe reference photo/);assert.match(html,/type="file"[^>]*required/)
 assert.match(html,/<button\b[^>]*\sdisabled(?=[\s=>])[^>]*>Use template/)
 const ready=await renderFile('SharedTemplateLibrary.vue',{...values,file:{name:'shoe.png'},matches:true})
 assert.match(ready,/<button\b(?![^>]*\sdisabled(?=[\s=>]))[^>]*>Use template/)
 const pending=await renderFile('SharedTemplateLibrary.vue',{...values,selected:{...shoe,canReuse:false}})
 assert.doesNotMatch(pending,/type="file"/);assert.match(pending,/Awaiting admin review/)
})
test('only original finished scan products offer creator opt-in sharing',async()=>{
 const values={form:{...shoe,sourceTemplateId:null,parts:shoe.parts,colors:[{name:'White',value:'#ffffff'}],sizes:[9],stock:0,charmsEnabled:false},busy:false,sharing:false,shared:null,ready:false,error:'',message:'',charms:[],charmId:'none',activePart:'upper',templateName:'Original shoe',templateDescription:'Original model description',allowReuse:false,emit(){},save(){},shareTemplate(){},loaded(){},selectPart(){},preview(){},reset(){}}
 const own=await renderFile('SellerProductEditor.vue',values);assert.match(own,/<button[^>]*type="submit"[^>]*form="product-details-form"/);assert.match(own,/Share as template/);assert.match(own,/allow other KickCraft sellers to reuse/)
 const reused=await renderFile('SellerProductEditor.vue',{...values,form:{...values.form,sourceTemplateId:'shared-check'}})
 assert.doesNotMatch(reused,/>Share as template</);assert.match(reused,/Uses shared template shared-check/)
})


test('seller navigation stays separate from workspace and approval gates stay intact',async()=>{
 const values={profile:{status:'approved',storeName:'Original Studio',tutorialStep:5},user:{id:99},tab:'products',loading:false,busy:false,error:'',message:'',products:[],orders:[],visibleOrders:[],editing:null,scanning:false,uploading:false,guide:null,store:{},orderFilter:'all',completing:null,leaving:null,refresh(){},create(){},tutorial(){},saveStore(){}}
 const approved=await renderFile('SellerDashboard.vue',values)
 assert.match(approved,/<nav[^>]*class="seller-navigation"/)
 assert.match(approved,/<div class="seller-workspace"/)
 assert.match(approved,/Scan from photos/)
 for(const status of ['pending','rejected','suspended']){
  const html=await renderFile('SellerDashboard.vue',{...values,profile:{...values.profile,status}})
  assert.doesNotMatch(html,/Scan from photos|Seller sections|Pickup orders<\/button>/)
  if(status==='suspended')assert.doesNotMatch(html,/Save store settings|Resubmit application/)
  else assert.match(html,/Store settings/)
 }
})

test('painting keeps pending fills and the two-part requirement ahead of finalization',async()=>{
 const values={fullscreen:false,error:'',ready:true,busy:false,saving:false,mode:'fill',fills:[{faces:[0,1]}],fillCount:2,fillTolerance:40,region:'upper',radius:16,cursor:null,brushActive:false,counts:{upper:2,midsole:4},partCount:2,PARTS:[{id:'upper',label:'Upper'},{id:'midsole',label:'Midsole'}],swatches:['#e87558','#abb9c2'],charm:null,testColor:'#ffffff',cropMin:-100,cropMax:100,cropAxis:'y',toggleFullscreen(){},undo(){},keydown(){},clearPart(){},applyFill(){},crop(){},finish(){}}
 const pending=await renderFile('ScanRegionEditor.vue',values)
 assert.match(pending,/<button[^>]*\sdisabled(?=[\s=>])[^>]*>Use these parts<\/button>/)
 assert.match(pending,/<button\b(?![^>]*\sdisabled(?=[\s=>]))[^>]*>Apply all fills<\/button>/)
 assert.match(pending,/<input[^>]*type="radio"[^>]*\sdisabled(?=[\s=>])/)
 const ready=await renderFile('ScanRegionEditor.vue',{...values,fills:[],fillCount:0})
 assert.match(ready,/<button\b(?![^>]*\sdisabled(?=[\s=>]))[^>]*>Use these parts<\/button>/)
 for(const changes of [{partCount:1},{saving:true},{busy:true}]){
  const html=await renderFile('ScanRegionEditor.vue',{...values,fills:[],...changes})
  assert.match(html,/<button[^>]*\sdisabled(?=[\s=>])[^>]*>(Use these parts|Saving model…|Preparing model…)<\/button>/)
 }
})

test('seller section clicks preserve active work until leaving is confirmed',async()=>{
 const {descriptor}=parse(readFileSync(new URL('../src/components/SellerDashboard.vue',import.meta.url),'utf8'))
 const render=new Function('Vue',compile(descriptor.template.content,{prefixIdentifiers:true}).code)(Vue)
 const values=Vue.reactive({profile:{status:'approved',storeName:'Fixture',tutorialStep:5},user:{id:99},tab:'products',loading:false,busy:false,error:'',message:'',products:[],editing:{id:'draft'},scanning:false,uploading:false,guide:null,store:{},completing:null,leaving:null,saved(){},refresh(){},navigate(item){this.tab=item;this.editing=null}})
 const clicks={}
 const app=Vue.createSSRApp({render,setup:()=>values})
 app.component('Button',{setup(_,{attrs,slots}){return()=>{const children=slots.default?.();const label=children?.map(v=>v.children).join('');clicks[label]=attrs.onClick;return Vue.h('button',attrs,children)}}})
 for(const name of ['Input','Textarea','PhotoScanner','SellerProductEditor','SharedTemplateLibrary','ConfirmModal'])app.component(name,{render:()=>null})
 await renderToString(app)
 clicks['My products']()
 assert.equal(values.editing.id,'draft')
 assert.equal(values.leaving,null)
 clicks['Store settings']()
 assert.equal(values.tab,'products')
 assert.equal(values.editing.id,'draft')
 assert.equal(values.leaving,'settings')
 values.editing=null;values.leaving=null
 clicks['Store settings']()
 assert.equal(values.tab,'settings')
})

test('mask settings and saving stay disabled while preparing or saving the photo',async()=>{
 const values={image:{name:'Fixture.png'},saving:false,loading:false,error:'',mode:'keep',aiAvailable:false,canUndo:false,coverage:.5,background:'#20dc1e',tolerance:80,radius:24,emit(){},rgb(){return [32,220,30]},undo(){},keydown(){},down(){},move(){},up(){},save(){},regenerate(){}}
 const html=await renderFile('ScanPhotoMask.vue',values)
 assert.match(html,/aria-labelledby="mask-radius-label"[^>]*class=/)
 assert.match(html,/<button\b(?![^>]*\sdisabled(?=[\s=>]))[^>]*>Save reviewed mask<\/button>/)
 for(const changes of [{saving:true},{loading:true},{error:'Photo unavailable'}]){
  const locked=await renderFile('ScanPhotoMask.vue',{...values,...changes})
  assert.match(locked,/<fieldset\sdisabled/)
  assert.match(locked,/<span[^>]*role="slider"[^>]*data-disabled/)
 }
})
