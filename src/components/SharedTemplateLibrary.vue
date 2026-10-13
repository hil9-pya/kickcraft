<script setup>
import {ref,onMounted,onBeforeUnmount,nextTick} from 'vue'
import {api} from '../api.js'
import {prepareScanMaterials,setMaterialColor,restoreMaterialColor} from '../customization.js'
import {validateCaptureFile} from '../scan-capture.js'
const emit=defineEmits(['created'])
const previewPanel=ref(null),templates=ref([]),selected=ref(null),viewer=ref(null),part=ref(''),error=ref(''),busy=ref(false),loading=ref(true),file=ref(null),photoUrl=ref(''),matches=ref(false),requestId=ref('')
let selection=0
async function load(){loading.value=true;error.value='';try{templates.value=(await api('templates/list.php')).templates}catch(cause){error.value=cause.message}finally{loading.value=false}}
function clearPhoto(){if(photoUrl.value)URL.revokeObjectURL(photoUrl.value);photoUrl.value='';file.value=null;matches.value=false;requestId.value=''}
async function inspect(template){selection++;clearPhoto();selected.value=template;part.value=template.parts[0].material;error.value='';await nextTick();previewPanel.value?.scrollIntoView({block:'start'})}
async function loaded(){try{await prepareScanMaterials(viewer.value,selected.value.parts)}catch(cause){error.value=cause.message}}
function recolor(color){if(viewer.value?.model)setMaterialColor(viewer.value.model,part.value,color)}
function reset(){for(const mat of viewer.value?.model?.materials||[])restoreMaterialColor(viewer.value.model,mat.name)}
async function choosePhoto(event){
 clearPhoto();error.value='';const photo=event.target.files[0],ticket=++selection;if(!photo)return
 try{
  let issue=validateCaptureFile(photo,{width:256,height:256});if(issue)throw new Error(issue)
  const image=await createImageBitmap(photo);issue=validateCaptureFile(photo,image);const small=image.width<256||image.height<256;image.close();if(issue||small)throw new Error(issue||'Photo must be at least 256 pixels on each side.')
  if(ticket!==selection)return;file.value=photo;photoUrl.value=URL.createObjectURL(photo);requestId.value=crypto.randomUUID()
 }catch(cause){if(ticket===selection)error.value=cause.message}
}
async function useTemplate(){
 if(busy.value||!file.value||!matches.value)return
 busy.value=true;error.value=''
 try{const body=new FormData();body.append('id',selected.value.id);body.append('requestId',requestId.value);body.append('matches','1');body.append('file',file.value);const result=await api('templates/use.php',{method:'POST',body});clearPhoto();emit('created',result.shoe)}catch(cause){error.value=cause.message}finally{busy.value=false}
}
onMounted(load);onBeforeUnmount(()=>{selection++;clearPhoto()})
</script>
<template>
 <section class="stack">
  <header><div><h2>Shared shoe templates</h2><p class="muted">Reuse an approved original model and its editable parts. No AI generation credits. Creator keeps attribution.</p></div><button :disabled="loading||busy" @click="load">Refresh templates</button></header>
  <p v-if="error" class="error" role="alert">{{error}}</p><p v-if="loading" role="status">Loading templates…</p>
  <section v-if="selected" ref="previewPanel" class="panel stack"><div class="actions"><h3>{{selected.name}}</h3><button :disabled="busy" @click="selection++;selected=null;clearPhoto()">Close template</button></div>
   <div class="editor-grid"><div class="stack"><model-viewer :key="selected.id" ref="viewer" :src="selected.glbPath" camera-controls alt="Shared shoe template preview" @load="loaded" @error="error='Could not load template model.'"></model-viewer><label>Preview part<select v-model="part"><option v-for="item in selected.parts" :key="item.id" :value="item.material">{{item.label}}</option></select></label><div class="actions"><button @click="recolor('#b94d27')">Test rust</button><button @click="recolor('#245fa8')">Test blue</button><button @click="reset">Original texture</button></div></div>
    <div class="stack"><p>Created by <strong>{{selected.storeName}}</strong> · {{selected.parts.length}} editable parts</p><p>{{selected.description}}</p><p class="notice">Use only when this model matches the actual shoe you sell. Similar shoe styles can have different geometry. Your new listing still needs admin approval.</p><p v-if="selected.reviewNote">Admin note: {{selected.reviewNote}}</p>
     <form v-if="selected.canReuse" class="stack" @submit.prevent="useTemplate"><label>Your matching-shoe reference photo<input :key="selected.id" type="file" accept="image/jpeg,image/png" required :disabled="busy" @change="choosePhoto"></label><small>One clear JPG/PNG, at least 256 pixels per side, up to 10 MB. Private reference for admin comparison.</small><img v-if="photoUrl" :src="photoUrl" alt="Your matching shoe reference" class="matching-photo"><label class="checks"><input v-model="matches" type="checkbox" :disabled="busy" required>This model matches the actual shoe I sell.</label><button class="primary" :disabled="busy||!file||!matches">{{busy?'Creating draft…':'Use template — create private draft'}}</button></form>
     <p v-else class="notice">{{selected.publicationState==='pending'?'Awaiting admin review.':selected.publicationState==='rejected'?'Template rejected or withdrawn. Correct sharing details in its source product to resubmit.':'Creator store approval is required before reuse.'}}</p>
    </div>
   </div>
  </section>
  <p v-if="!loading&&!templates.length" class="panel">No shared templates yet. Finish a photo-generated shoe, then choose Share as template in Product details.</p>
  <div class="product-list"><article v-for="template in templates" :key="template.id" class="panel stack"><img class="product-image" :src="template.thumbnailPath" :alt="template.name"><p class="tag">{{template.publicationState}} · {{template.parts.length}} editable parts</p><h3>{{template.name}}</h3><p>By {{template.storeName}}</p><button :disabled="busy" @click="inspect(template)">Preview template</button></article></div>
 </section>
</template>
<style scoped>.matching-photo{width:100%;max-height:240px;object-fit:contain}</style>
