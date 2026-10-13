<script setup>
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import {ref,reactive,onMounted,onBeforeUnmount,watch,nextTick} from 'vue'
import {api} from '../api.js'
import {prepareScanMaterials,setMaterialColor,restoreMaterialColor} from '../customization.js'
import '../seller.css'
const props=defineProps({mode:{type:String,required:true}}),emit=defineEmits(['changed'])
const reviewArea=()=>props.mode==='templates'?'templates':'products'
const reviewPanel=ref(null),ready=ref(false),reference=ref(null),original=new Map()
const rows=ref([]),error=ref(''),busy=ref(false),loading=ref(false),filter=ref('all'),selected=ref(null),source=ref(null),notes=reactive({}),viewer=ref(null),part=ref(''),photoReviewed=ref(false),testedParts=ref([])
let selection=0,loadRequest=0,timer,closed=false
async function load(){
 const ticket=++loadRequest;loading.value=true;error.value=''
 try{
  const result=await api(props.mode==='sellers'?'sellers/list.php':reviewArea()+'/list.php?review=1')
  if(ticket!==loadRequest||closed)return
  rows.value=result.sellers||result.shoes||result.templates
  if(selected.value){
   const current=selected.value,updated=rows.value.find(row=>row.id===current.id)
   if(!updated){selection++;selected.value=null;ready.value=false;source.value=null;reference.value=null;photoReviewed.value=false;testedParts.value=[];original.clear()}
   else if(current.publicationState!==updated.publicationState||current.glbPath!==updated.glbPath||current.sourceScanId!==updated.sourceScanId||JSON.stringify(current.parts)!==JSON.stringify(updated.parts))await inspect(updated)
   else selected.value=updated
  }
 }catch(cause){if(ticket===loadRequest)error.value=cause.message}finally{if(ticket===loadRequest)loading.value=false}
}
async function inspect(row){const request=++selection;selected.value=row;ready.value=false;source.value=null;reference.value=null;original.clear();part.value=row.parts?.[0]?.material||'';photoReviewed.value=false;testedParts.value=[];await nextTick();if(request!==selection)return;reviewPanel.value?.scrollIntoView({block:'start'});if(row.sourceScanId)try{const result=await api(reviewArea()+'/scan.php?id='+encodeURIComponent(row.id));if(request===selection){source.value=result.job;reference.value=result.job.images[0]}}catch(cause){if(request===selection)error.value=cause.message}}
async function loaded(){
 const ticket=selection,model=viewer.value,row=selected.value
 try{await prepareScanMaterials(model,row.parts);if(ticket!==selection)return;for(const mat of model.model.materials)original.set(mat.name,[...mat.pbrMetallicRoughness.baseColorFactor]);ready.value=true}
 catch(cause){if(ticket===selection)error.value=cause.message}
}
function recolor(value){if(ready.value&&viewer.value?.model&&setMaterialColor(viewer.value.model,part.value,value)&&!testedParts.value.includes(part.value))testedParts.value.push(part.value)}
function reset(){for(const mat of viewer.value?.model?.materials||[]){restoreMaterialColor(viewer.value.model,mat.name);if(original.has(mat.name))mat.pbrMetallicRoughness.setBaseColorFactor(original.get(mat.name))}}
async function review(row,status){error.value='';const note=notes[row.id]??row.reviewNote??'';if(status!=='approved'&&note.trim().length<3){error.value='Explain the decision in the review note.';return}
 if(props.mode!=='sellers'&&status==='approved'&&row.sourceScanId&&(!photoReviewed.value||testedParts.value.length<2)){error.value='Compare source photos and test at least two different parts before approval.';return}
 busy.value=true;try{await api(props.mode==='sellers'?'sellers/review.php':reviewArea()+'/review.php',{method:'POST',body:{id:row.id,status,note,photoReviewed:photoReviewed.value,testedParts:testedParts.value}});selected.value=null;source.value=null;await load();emit('changed')}catch(cause){error.value=cause.message}finally{busy.value=false}}
function refreshSelected(){
 if(selected.value&&!busy.value&&!loading.value&&!document.hidden)void load()
}
onMounted(()=>{load();timer=setInterval(refreshSelected,15000);document.addEventListener('visibilitychange',refreshSelected);window.addEventListener('focus',refreshSelected)})
onBeforeUnmount(()=>{closed=true;selection++;loadRequest++;clearInterval(timer);document.removeEventListener('visibilitychange',refreshSelected);window.removeEventListener('focus',refreshSelected)})
watch(()=>props.mode,()=>{selection++;ready.value=false;selected.value=null;source.value=null;rows.value=[];filter.value='all';load()})
</script>
<template>
 <section class="seller" style="padding:0">
  <header><div><h1>{{mode==='sellers'?'Seller applications':mode==='templates'?'Shared template review':'Seller product review'}}</h1><p class="muted">{{mode==='sellers'?'Approve original studios with a clear pickup location. Suspension hides their listings immediately.':mode==='templates'?'Compare original photos and test at least two independent parts. Approval shares this model with approved sellers; it does not approve their listings.':'Check the actual model, independent parts, price and pickup store before publishing.'}}</p></div><Button variant="outline" :disabled="loading||busy" @click="load">Refresh</Button></header>
  <p v-if="error" role="alert" class="error">{{error}}</p><p v-if="loading" role="status">Loading review queue…</p>
  <label style="max-width:240px;margin-bottom:16px">Show<select v-model="filter"><option value="all">All statuses</option><option v-for="status in mode==='sellers'?['pending','approved','rejected','suspended']:mode==='templates'?['pending','approved','rejected']:['pending','approved','draft','rejected']" :key="status">{{status}}</option></select></label>
  <template v-if="mode==='sellers'">
   <article class="row panel" v-for="row in rows.filter(r=>filter==='all'||r.status===filter)" :key="row.id"><div class="actions"><h2>{{row.storeName}}</h2><strong class="tag">{{row.status}}</strong></div><p>{{row.name}} · {{row.email}}<br>{{row.description}}<br><strong>Pickup:</strong> {{row.pickupAddress}}<br>{{row.contact}}</p><label>Review note<Textarea v-model="notes[row.id]" :placeholder="row.reviewNote||'Required for rejection or suspension'" maxlength="1000"></Textarea></label><div class="actions"><Button variant="default" class="primary" :disabled="busy" @click="review(row,'approved')">{{row.status==='suspended'?'Restore approval':'Approve seller'}}</Button><Button variant="outline" :disabled="busy" @click="review(row,'rejected')">Request changes</Button><Button variant="outline" :disabled="busy" @click="review(row,'suspended')">Suspend seller</Button></div></article>
  </template>
  <template v-else>
   <section v-if="selected" ref="reviewPanel" class="panel stack" style="margin-bottom:24px"><div class="actions"><h2>{{selected.name}}</h2><Button variant="outline" @click="selected=null;source=null;selection++">Close review</Button></div><div class="editor-grid"><div><model-viewer :key="selection" ref="viewer" :src="selected.glbPath" camera-controls alt="Seller product review model" @load="loaded" @error="error='Could not load product model.'"></model-viewer><p v-if="!ready" role="status">Preparing model and editable textures…</p><label>Test a part<select v-model="part" :disabled="!ready"><option v-for="item in selected.parts" :key="item.id" :value="item.material">{{item.label}}</option></select></label><div class="actions" style="margin-top:12px"><Button variant="outline" :disabled="!ready" @click="recolor('#b94d27')">Test rust</Button><Button variant="outline" :disabled="!ready" @click="recolor('#245fa8')">Test blue</Button><Button variant="outline" :disabled="!ready" @click="reset">Original texture</Button></div><p>{{testedParts.length}} independent parts tested</p></div><div class="stack"><p class="tag">Review status: {{selected.publicationState}}</p><p v-if="selected.publicationState==='draft'" class="notice" role="status">Private draft. The seller must use Submit for review in Product details before this listing can be approved.</p><p>{{selected.description}}</p><p v-if="mode!=='templates'">₱{{Number(selected.price).toLocaleString()}} · {{selected.stock}} pairs<br>US sizes: {{selected.sizes.join(', ')}}<br><strong>{{selected.storeName}}</strong><br>{{selected.pickupAddress}}</p><p v-if="mode==='templates'"><strong>Creator: {{selected.storeName}}</strong>. Creator opted in to model and part reuse with attribution.</p><template v-if="selected.sourceScanId"><p v-if="!source">Loading private source capture…</p><template v-else><h3>Original source photographs</h3><p v-if="source.alignmentMinPercent===65" class="notice">Experimental 65% alignment retry: lower alignment may produce incomplete geometry or missing surfaces. Inspect all source views before approval.</p><p class="muted">Compare toe, sides, heel, sole and photographed detail. Reject unusable geometry, background fragments, or wrong part boundaries.</p><figure v-if="reference"><img :src="reference.previewUrl" :alt="reference.name" style="width:100%;height:300px;object-fit:contain"><figcaption>{{reference.name}}</figcaption></figure><div class="review-images"><Button variant="outline" v-for="image in source.images" :key="image.id" type="button" @click="reference=image" :aria-label="'Compare '+image.name"><img :src="image.previewUrl" :alt="image.name" loading="lazy"></Button></div><label class="checks"><input type="checkbox" v-model="photoReviewed">I compared all views and this model represents the photographed shoe.</label></template></template><p v-else class="notice">{{selected.glbPath==='/models/shoe-soleview-final.glb'?'This is an original KickCraft template, not a reconstruction of seller photos.':'Uploaded model: verify original design and independently recolorable materials.'}}</p><label>Review note<Textarea v-model="notes[selected.id]" :placeholder="selected.reviewNote||'Required when rejecting'" maxlength="1000"></Textarea></label><div class="actions"><Button variant="default" v-if="selected.publicationState==='pending'" class="primary" :disabled="busy||!ready||(selected.sourceScanId&&(!source||!photoReviewed||testedParts.length<2))" @click="review(selected,'approved')">{{mode==='templates'?'Approve shared template':'Approve listing'}}</Button><Button variant="outline" v-if="['pending','approved'].includes(selected.publicationState)||(mode==='products'&&selected.publicationState==='draft')" :disabled="busy" @click="review(selected,'rejected')">{{mode==='templates'?'Reject / withdraw template':'Reject listing'}}</Button></div></div></div></section>
   <div class="product-list review-list"><article class="panel stack review-card" v-for="row in rows.filter(r=>filter==='all'||r.publicationState===filter)" :key="row.id"><div class="product-image thumbnail-stage"><img :src="row.thumbnailPath" :alt="row.name" loading="lazy"></div><p class="tag">{{row.publicationState}}</p><h2>{{row.name}}</h2><p>{{row.storeName}} · {{row.parts.length}} parts</p><p v-if="row.reviewNote" class="review-card-note">{{row.reviewNote}}</p><Button class="review-card-action" variant="outline" @click="inspect(row)">{{mode==='templates'?'Inspect template':'Inspect listing'}}</Button></article></div>
  </template>
  <p v-if="!loading&&!rows.length" class="panel">No {{mode==='sellers'?'seller applications':mode==='templates'?'shared templates':'seller products'}} yet.</p>
 </section>
</template>
