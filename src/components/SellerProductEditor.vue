<script setup>
import {ref,reactive,computed,onBeforeUnmount} from 'vue'
import {api} from '../api.js'
import {validateProduct} from '../seller.js'
import {prepareScanMaterials,setMaterialColor,availableCharms,charmSource,charmScale} from '../customization.js'
const props=defineProps({shoe:{type:Object,required:true}})
const emit=defineEmits(['saved','close'])
const form=reactive(JSON.parse(JSON.stringify(props.shoe))),viewer=ref(null),activePart=ref(form.parts[0]?.id),error=ref(''),message=ref(''),busy=ref(false),ready=ref(false)
const charms=computed(()=>availableCharms(form)),charmId=ref('none')
const templateName=ref(form.name==='Untitled shoe'?'':form.name),templateDescription=ref(form.description),allowReuse=ref(false),sharing=ref(false),shared=ref(null)
const original=new Map();let highlighted=null
async function loaded() {
 try {
  await prepareScanMaterials(viewer.value,form.parts)
  for(const material of viewer.value.model.materials)original.set(material.name,{factor:[...material.pbrMetallicRoughness.baseColorFactor],texture:material.pbrMetallicRoughness.baseColorTexture.texture})
  ready.value=true
 }catch(cause){error.value=cause.message}
}
function selectPart(id){activePart.value=id;if(!ready.value)return;if(highlighted)highlighted.material.setEmissiveFactor(highlighted.factor);const material=viewer.value.model.materials.find(m=>m.name===form.parts.find(p=>p.id===id)?.material);highlighted=material?{material,factor:[...material.emissiveFactor]}:null;if(material)material.setEmissiveFactor([0.15,0.06,0])}
function preview(color){const part=form.parts.find(p=>p.id===activePart.value);if(ready.value&&part)setMaterialColor(viewer.value.model,part.material,color)}
function reset(){if(!ready.value)return;for(const material of viewer.value.model.materials){const saved=original.get(material.name);if(saved){material.pbrMetallicRoughness.baseColorTexture.setTexture(saved.texture);material.pbrMetallicRoughness.setBaseColorFactor(saved.factor)}}}
async function save(submit=false) {
 if(sharing.value)return
 error.value=validateProduct(form);message.value='';if(error.value)return
 if(submit&&Number(form.stock)<1){error.value='At least one available pair is needed for review.';return}
 busy.value=true
 try {
  const body={expectedStock:form.stockAtLoad??props.shoe.stock,id:form.id,name:form.name,description:form.description,price:Number(form.price),stock:Number(form.stock),sizes:form.sizes,parts:form.parts.map(({id,label})=>({id,label})),colors:form.colors}
  let result=await api('products/save.php',{method:'POST',body});Object.assign(form,result.shoe);form.stockAtLoad=result.shoe.stock
  if(submit){result=await api('products/submit.php',{method:'POST',body:{id:form.id}});Object.assign(form,result.shoe);form.stockAtLoad=result.shoe.stock}
  if(!templateName.value)templateName.value=form.name
  if(!templateDescription.value)templateDescription.value=form.description
  message.value=submit?'Submitted. Admin must approve before this appears in the marketplace.':'Draft saved. Preview colors are temporary; customers choose their own colors.'
  emit('saved',result.shoe)
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
onBeforeUnmount(()=>{if(highlighted)highlighted.material.setEmissiveFactor(highlighted.factor)})
</script>
<template>
 <section class="stack">
  <header><div><p class="tag">{{form.publicationState}} · {{form.sourceTemplateId?'Shared template':form.sourceScanId?'Photo scan':form.glbPath==='/models/shoe-soleview-final.glb'?'KickCraft template':'GLB upload'}}</p><h2>Product details</h2></div><button @click="emit('close')" :disabled="busy||sharing">Back to products</button></header>
  <p class="notice">Saving changes withdraws a live listing for another admin review. Existing pickup orders keep their original details.</p>
  <p v-if="form.reviewNote" class="notice">Admin review: {{form.reviewNote}}</p>
  <p v-if="error" role="alert" class="error">{{error}}</p><p v-if="message" role="status" class="success">{{message}}</p>
  <div class="editor-grid">
   <div class="stack">
    <model-viewer ref="viewer" :src="form.glbPath" camera-controls alt="Product customization preview" @load="loaded" @error="error='Could not load this 3D model.'"><extra-model v-for="charm in charms.filter(c=>c.src)" :key="charm.id" :src="charmSource(charm,form)" :offset="form.charmOffset" :scale="charmScale(charm.id,charmId,form.charmScale)" /></model-viewer>
    <div class="panel stack"><h3>Test customizable parts</h3><label>Part<select :value="activePart" @change="selectPart($event.target.value)"><option v-for="part in form.parts" :key="part.id" :value="part.id">{{part.label}}</option></select></label><div class="actions"><button v-for="color in form.colors" :key="color.value+color.name" :disabled="!ready" @click="preview(color.value)"><span :style="{background:color.value,display:'inline-block',width:'14px',height:'14px',border:'1px solid #bbb'}"></span> {{color.name}}</button><button :disabled="!ready" @click="reset">Original texture</button></div><label v-if="form.charmsEnabled">Preview charm<select v-model="charmId"><option v-for="charm in charms" :key="charm.id" :value="charm.id">{{charm.label}}</option></select></label><small>Choose a part, then a color. This tests independent recoloring; it does not change the photographed base texture.</small></div>
   </div>
   <form class="panel stack" @submit.prevent="save(false)">
    <label>Product name<input v-model="form.name" required minlength="2" maxlength="160"></label>
    <label>Description<textarea v-model="form.description" required maxlength="3000"></textarea></label>
    <div class="fields"><label>Price (₱)<input v-model.number="form.price" type="number" min="0.01" max="1000000" step="0.01" required></label><label>Available pairs<input v-model.number="form.stock" type="number" min="0" max="100000" step="1" required></label></div>
    <fieldset class="stack"><legend>Available US sizes</legend><div class="checks"><label v-for="size in 11" :key="size"><input type="checkbox" :value="size+4" v-model="form.sizes">{{size+4}}</label></div></fieldset>
    <fieldset class="stack"><legend>Part labels</legend><label v-for="part in form.parts" :key="part.id">{{part.material}}<input v-model="part.label" required maxlength="80"></label></fieldset>
    <fieldset class="stack"><legend>Customer palette</legend><div class="colors" v-for="(color,index) in form.colors" :key="index"><input type="color" v-model="color.value" :aria-label="'Color '+(index+1)"><input v-model="color.name" :aria-label="'Color name '+(index+1)" required maxlength="40"><button type="button" :disabled="form.colors.length===1" @click="form.colors.splice(index,1)" :aria-label="'Remove color '+(index+1)">Remove</button></div><button type="button" :disabled="form.colors.length>=32" @click="form.colors.push({name:'New color',value:'#245fa8'})">Add color</button></fieldset>
    <p class="muted">{{form.charmsEnabled?'Charms enabled at the model’s attachment point.':'No verified charm attachment point on this upload. Part recoloring remains available.'}}</p>
    <div class="actions"><button :disabled="busy||sharing">{{busy?'Saving…':'Save draft'}}</button><button type="button" class="primary" :disabled="busy||sharing" @click="save(true)">Submit for review</button></div>
   </form>
  </div>
  <form v-if="form.sourceScanId&&!form.sourceTemplateId" class="panel stack" @submit.prevent="shareTemplate"><h3>Share as template</h3><p>Let approved sellers reuse this saved model and its part boundaries without generating it again. Admin compares source photos and tests parts before adding it to the shared library.</p><p class="muted">Sharing saves a separate copy of the current saved model, part labels and palette. Later product edits do not change that copy. Price, stock, orders and private photos are not shared with other sellers.</p><label>Template name<input v-model="templateName" required minlength="2" maxlength="160" :disabled="sharing"></label><label>Template description<textarea v-model="templateDescription" required minlength="10" maxlength="3000" :disabled="sharing"></textarea></label><label class="checks"><input v-model="allowReuse" type="checkbox" required :disabled="sharing">This is my original design, and I allow other KickCraft sellers to reuse its model and part boundaries with creator attribution.</label><p v-if="shared">Template status: {{shared.publicationState}}<span v-if="shared.reviewNote"> — {{shared.reviewNote}}</span></p><button :disabled="busy||sharing||!allowReuse">{{sharing?'Submitting template…':'Submit shared template for review'}}</button></form>
  <p v-if="form.sourceTemplateId" class="notice">Uses shared template {{form.sourceTemplateId}}. Your reference photo and listing need their own admin review.</p>
 </section>
</template>
