<script setup>
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {ref,reactive,computed,onBeforeUnmount,watch} from 'vue'
import {api} from '../api.js'
import {validateProduct,productLabels} from '../seller.js'
import RecentColors from './RecentColors.vue'
import ScanRegionEditor from './ScanRegionEditor.vue'
import SwayingCharms from './SwayingCharms.vue'
import {rememberColor} from '../color-history.js'
import {frameLatest} from '../color-input.js'
import {prepareScanMaterials,setMaterialColor,availableCharms,charmSource} from '../customization.js'
const props=defineProps({shoe:{type:Object,required:true}})
const emit=defineEmits(['saved','close'])
const form=reactive(JSON.parse(JSON.stringify(props.shoe))),viewer=ref(null),activePart=ref(form.parts[0]?.id),error=ref(''),message=ref(''),busy=ref(false),ready=ref(false)
const charms=computed(()=>availableCharms(form)),charmId=ref('none')
const charmModels=computed(()=>charms.value.filter(charm=>charm.src).map(charm=>({...charm,src:charmSource(charm,form)})))
const templateName=ref(form.name==='Untitled shoe'?'':form.name),templateDescription=ref(form.description),allowReuse=ref(false),sharing=ref(false),shared=ref(null)
const painting=ref(null)
const canPaint=computed(()=>!!form.sourceScanId||!form.parts.length||form.parts.every(part=>part.recolorTexturePath&&part.material.startsWith('KCScan_')))
const original=new Map();let highlighted=null
const previewHex=ref('#ffffff'),paletteIndex=ref(0)
const previewInput=frameLatest(color=>preview(color))
const paletteInput=frameLatest(({index,color})=>{if(form.colors[index])form.colors[index].value=color})
function reusePreview(color){previewInput.cancel();previewHex.value=color;preview(color);rememberColor(color)}
function reusePalette(color){paletteInput.flush();form.colors[paletteIndex.value].value=color}
watch(()=>[props.shoe.publicationState,props.shoe.reviewNote],([state,note])=>{if(state!==form.publicationState)message.value='';form.publicationState=state;form.reviewNote=note})
async function loaded() {
 ready.value=false;original.clear();highlighted=null
 try {
  await prepareScanMaterials(viewer.value,form.parts)
  for(const material of viewer.value.model.materials)original.set(material.name,{factor:[...material.pbrMetallicRoughness.baseColorFactor],texture:material.pbrMetallicRoughness.baseColorTexture.texture})
  ready.value=true
 }catch(cause){error.value=cause.message}
}
function selectPart(id){previewInput.flush();activePart.value=id;if(!ready.value)return;if(highlighted)highlighted.material.setEmissiveFactor(highlighted.factor);const material=viewer.value.model.materials.find(m=>m.name===form.parts.find(p=>p.id===id)?.material);highlighted=material?{material,factor:[...material.emissiveFactor]}:null;if(material)material.setEmissiveFactor([0.15,0.06,0])}
function preview(color){const part=form.parts.find(p=>p.id===activePart.value);if(ready.value&&part)setMaterialColor(viewer.value.model,part.material,color)}
function reset(){previewInput.cancel();if(!ready.value)return;for(const material of viewer.value.model.materials){const saved=original.get(material.name);if(saved){material.pbrMetallicRoughness.baseColorTexture.setTexture(saved.texture);material.pbrMetallicRoughness.setBaseColorFactor(saved.factor)}}}
async function save(submit=false) {
 if(sharing.value)return
 paletteInput.flush();previewInput.flush()
 error.value=validateProduct(form,submit);message.value='';if(error.value)return
 if(submit&&Number(form.stock)<1){error.value='At least one available pair is needed for review.';return}
 busy.value=true
 try {
  const body={expectedStock:form.stockAtLoad??props.shoe.stock,id:form.id,name:form.name,description:form.description,price:Number(form.price),stock:Number(form.stock),sizes:form.sizes,parts:form.parts.map(({id,label})=>({id,label})),colors:form.colors}
  let result=await api('products/save.php',{method:'POST',body});Object.assign(form,result.shoe);form.stockAtLoad=result.shoe.stock
  if(submit){result=await api('products/submit.php',{method:'POST',body:{id:form.id}});Object.assign(form,result.shoe);form.stockAtLoad=result.shoe.stock}
  if(!templateName.value)templateName.value=form.name
  if(!templateDescription.value)templateDescription.value=form.description
  message.value=submit?'Submitted. Admin must approve before this appears in Shop.':'Draft saved. Preview colors are temporary; customers choose their own colors.'
  emit('saved',result.shoe)
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function openPainting(){
 if(busy.value||sharing.value)return
 busy.value=true;error.value='';message.value=''
 try{painting.value=await api('products/regions.php?id='+encodeURIComponent(form.id))}
 catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function saveParts({payload,charmPoint,charmSettings}){
 if(busy.value||!painting.value)return
 busy.value=true;error.value=''
 try{
  const body=new FormData();body.append('id',form.id);body.append('expectedModel',painting.value.shoe.glbPath)
  body.append('file',new Blob([payload.glb],{type:'model/gltf-binary'}),'regions.glb');body.append('neutralTexture',payload.neutralTexture,'neutral.png');body.append('thumbnail',payload.thumbnail,'thumbnail.png');body.append('charmPoint',JSON.stringify(charmPoint));body.append('charmSettings',JSON.stringify(charmSettings))
  const {shoe}=await api('products/regions.php',{method:'POST',body})
  const labels=new Map(form.parts.map(part=>[part.id,part.label]))
  for(const key of ['glbPath','thumbnailPath','charmsEnabled','charmOffset','charmScale','charmDir','publicationState','reviewNote'])form[key]=shoe[key]
  form.parts=shoe.parts.map(part=>({...part,label:labels.get(part.id)||part.label}))
  if(!form.parts.some(part=>part.id===activePart.value))activePart.value=form.parts[0]?.id
  ready.value=false;painting.value=null;message.value='Revised parts saved as a private draft. Check details and submit for admin review.';emit('saved',shoe)
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function shareTemplate(){
 if(sharing.value||busy.value)return
 error.value='';message.value=''
 if(!allowReuse.value||templateName.value.trim().length<2||templateDescription.value.trim().length<10){error.value='Add template name, description (at least 10 characters), and confirm reuse permission.';return}
 sharing.value=true
 try{shared.value=(await api('templates/submit.php',{method:'POST',body:{productId:form.id,name:templateName.value,description:templateDescription.value,allowReuse:allowReuse.value}})).template;message.value=shared.value.publicationState==='approved'?'This model is already approved in Shared templates.':'Template submitted for admin review. Your product listing keeps its own review status.'}
 catch(cause){error.value=cause.message}finally{sharing.value=false}
}
onBeforeUnmount(()=>{previewInput.cancel();paletteInput.cancel();if(highlighted)highlighted.material.setEmissiveFactor(highlighted.factor)})
</script>
<template>
 <section class="stack product-editor">
  <header><div><p class="tag">{{productLabels[form.publicationState] || form.publicationState}} · {{form.sourceTemplateId?'Shared template':form.sourceScanId?'Photo scan':form.glbPath==='/models/shoe-soleview-final.glb'?'KickCraft template':'GLB upload'}}</p><h2>Product details</h2></div><Button variant="outline" @click="emit('close')" :disabled="busy||sharing||painting">Back to products</Button></header>
  <p class="notice">Saving changes withdraws a live listing for another admin review. Existing pickup orders keep their original details.</p>
  <p v-if="form.reviewNote" class="notice">Admin review: {{form.reviewNote}}</p>
  <p v-if="error" role="alert" class="error">{{error}}</p><p v-if="message" role="status" class="success">{{message}}</p>
  <template v-if="painting">
   <div class="actions"><Button variant="outline" type="button" :disabled="busy" @click="painting=null">Back to product details</Button><p class="muted">Saving revised parts withdraws this listing until admin reviews it again. Previous model files and existing pickup orders are retained.</p></div>
   <ScanRegionEditor :preview-url="painting.shoe.glbPath" :parts="painting.shoe.parts" :charm-point="painting.charmPoint" :charm-settings="painting.charmSettings" :saving="busy" @complete="saveParts" />
  </template>
  <template v-else>
  <p v-if="!form.parts.length" class="notice">This upload has one surface. Paint at least two separate regions before submitting for review.</p>
  <Button v-if="canPaint" variant="outline" type="button" :disabled="busy||sharing||!ready" @click="openPainting">{{form.parts.length?'Edit painted parts':'Paint customizable parts'}}</Button>
  <div class="editor-grid">
   <div class="product-preview stack">
    <model-viewer ref="viewer" :src="form.glbPath" camera-controls alt="Product customization preview" @load="loaded" @error="error='Could not load this 3D model.'"><SwayingCharms :viewer="viewer" :charms="charmModels" :selected="charmId" :offset="form.charmOffset" :scale="form.charmScale" /></model-viewer>
    <div v-if="form.parts.length" class="preview-controls stack"><h3>Test customizable parts</h3><label>Part<select :value="activePart" @change="selectPart($event.target.value)"><option v-for="part in form.parts" :key="part.id" :value="part.id">{{part.label}}</option></select></label><div class="actions"><Button variant="outline" v-for="color in form.colors" :key="color.value+color.name" :disabled="!ready" @click="reusePreview(color.value)"><span :style="{background:color.value,display:'inline-block',width:'14px',height:'14px',border:'1px solid #bbb'}"></span> {{color.name}}</Button><Button variant="outline" :disabled="!ready" @click="reset">Original texture</Button></div><label>Custom preview color<input type="color" v-model="previewHex" aria-label="Seller preview color" :disabled="!ready" @input="previewInput(previewHex)" @change="previewInput.flush();rememberColor(previewHex)"></label><RecentColors :disabled="!ready" @select="reusePreview" /><label v-if="form.charmsEnabled">Preview charm<select v-model="charmId"><option v-for="charm in charms" :key="charm.id" :value="charm.id">{{charm.label}}</option></select></label><small>Choose a part, then a color. This tests independent recoloring; it does not change the photographed base texture.</small></div>
   </div>
   <form id="product-details-form" class="panel stack product-details" @submit.prevent="save(false)"><h3>Listing details</h3>
    <label>Product name<Input v-model="form.name" required minlength="2" maxlength="160" /></label>
    <label>Description<Textarea v-model="form.description" required maxlength="3000"></Textarea></label>
    <div class="fields"><label>Price (₱)<Input v-model.number="form.price" type="number" min="0.01" max="1000000" step="0.01" required /></label><label>Available pairs<Input v-model.number="form.stock" type="number" min="0" max="100000" step="1" required /></label></div>
    <fieldset class="stack"><legend>Available US sizes</legend><div class="checks"><label v-for="size in 11" :key="size"><input type="checkbox" :value="size+4" v-model="form.sizes">{{size+4}}</label></div></fieldset>
    <details class="product-options"><summary>Part labels · {{form.parts.length}}</summary><fieldset class="stack"><legend class="sr-only">Part labels</legend><label v-for="part in form.parts" :key="part.id">{{part.material}}<Input v-model="part.label" required maxlength="80" /></label></fieldset></details>
    <details class="product-options"><summary>Customer palette · {{form.colors.length}} colors</summary><fieldset class="stack"><legend class="sr-only">Customer palette</legend><div class="colors" v-for="(color,index) in form.colors" :key="index"><input type="color" :value="color.value" @focus="paletteIndex=index" @input="paletteIndex=index;paletteInput({index,color:$event.target.value})" @change="paletteInput.flush();rememberColor(color.value)" :aria-label="'Color '+(index+1)"><Input v-model="color.name" :aria-label="'Color name '+(index+1)" required maxlength="40" /><Button variant="outline" type="button" :disabled="form.colors.length===1" @click="paletteInput.flush();form.colors.splice(index,1);paletteIndex=0" :aria-label="'Remove color '+(index+1)">Remove</Button></div><p class="muted">Recent colors apply to {{form.colors[paletteIndex]?.name || 'selected color'}}. Select a color field first.</p><RecentColors @select="reusePalette" /><Button variant="outline" type="button" :disabled="form.colors.length>=32" @click="form.colors.push({name:'New color',value:'#245fa8'})">Add color</Button></fieldset></details>
    <p class="muted">{{form.charmsEnabled?'Charms enabled at the model’s attachment point.':form.parts.length?'No verified charm attachment point on this upload. Part recoloring remains available.':'Paint customizable regions to enable part recoloring.'}}</p>
   </form>
  </div>
  <div class="product-savebar"><p class="muted">Drafts stay private until approved.</p><div class="actions"><Button type="submit" form="product-details-form" variant="outline" :disabled="busy||sharing">{{busy?'Saving…':'Save draft'}}</Button><Button variant="default" type="button" :disabled="busy||sharing||form.parts.length<2" @click="save(true)">Submit for review</Button></div></div>
  <form v-if="form.sourceScanId&&!form.sourceTemplateId" class="panel stack" @submit.prevent="shareTemplate"><h3>Share as template</h3><p>Let approved sellers reuse this saved model and its part boundaries without generating it again. Admin compares source photos and tests parts before adding it to the shared library.</p><p class="muted">Sharing saves a separate copy of the current saved model, part labels and palette. Later product edits do not change that copy. Price, stock, orders and private photos are not shared with other sellers.</p><label>Template name<Input v-model="templateName" required minlength="2" maxlength="160" :disabled="sharing" /></label><label>Template description<Textarea v-model="templateDescription" required minlength="10" maxlength="3000" :disabled="sharing"></Textarea></label><label class="checks"><input v-model="allowReuse" type="checkbox" required :disabled="sharing">This is my original design, and I allow other KickCraft sellers to reuse its model and part boundaries with creator attribution.</label><p v-if="shared">Template status: {{shared.publicationState}}<span v-if="shared.reviewNote"> — {{shared.reviewNote}}</span></p><Button variant="outline" :disabled="busy||sharing||!allowReuse">{{sharing?'Submitting template…':'Submit shared template for review'}}</Button></form>
  <p v-if="form.sourceTemplateId" class="notice">Uses shared template {{form.sourceTemplateId}}. Your reference photo and listing need their own admin review.</p>
  </template>
 </section>
</template>
