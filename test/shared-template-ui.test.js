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
async function renderScreen(render,values){const app=Vue.createSSRApp({render,setup:()=>values});for(const [name,component]of Object.entries(shared))app.component(name,component);return (await renderToString(app)).replace(/<!--.*?-->/gs,'')}
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
 const own=await renderFile('SellerProductEditor.vue',values);assert.match(own,/Share as template/);assert.match(own,/allow other KickCraft sellers to reuse/)
 const reused=await renderFile('SellerProductEditor.vue',{...values,form:{...values.form,sourceTemplateId:'shared-check'}})
 assert.doesNotMatch(reused,/>Share as template</);assert.match(reused,/Uses shared template shared-check/)
})
