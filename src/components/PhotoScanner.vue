<script setup>
import { Button } from './ui/button'
import {ref,computed,onMounted,onBeforeUnmount} from 'vue'
import TripoCapture from './TripoCapture.vue'
import ScanPhotoMask from './ScanPhotoMask.vue'
import ScanMaskReview from './ScanMaskReview.vue'
import {createPhotoMask,savedPhotoMaskPng} from '../scan-masks.js'
import ScanRegionEditor from './ScanRegionEditor.vue'
import {api} from '../api.js'
import {fetchScanJob,finalizeScan,discardScan,saveScanMask,scanStorageKey,generateScanMasks} from '../scan-capture.js'
const props=defineProps({accountId:{type:Number,default:null}})
const emit=defineEmits(['complete','cancel'])
const job=ref(null),error=ref(''),busy=ref(false),progress=ref(''),accepted=ref(false)
const maskImageId=ref(null),maskColor=ref('#20dc1e'),maskTolerance=ref(80),likenessChecks=ref([]),referenceId=ref(null)
const maskImage=computed(()=>job.value?.images?.find(image=>image.id===maskImageId.value))
const referenceImage=computed(()=>job.value?.images?.find(image=>image.id===referenceId.value) || job.value?.images?.[0])
const recoverable=ref([]),maskAvailable=ref(false),tripoAvailable=ref(false)
let timer,closed=false
const storageKey=scanStorageKey(props.accountId)
function remember(value) {if(value.engine!=='tripo')throw new Error('Local photo/video scanning is retired. Start a photo capture.');job.value=value;try{localStorage.setItem(storageKey,value.id)}catch{}}
async function tripoQueued(value){remember(value);accepted.value=false;likenessChecks.value=[];await observe()}
async function generateAiMasks() {
 if(busy.value || closed || job.value?.state!=='uploading')return
 busy.value=true;error.value=''
 try {remember(await generateScanMasks(job.value.id));maskImageId.value=null;await observe()}
 catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function saveMask(png) {
 busy.value=true;error.value=''
 try {
  remember(await saveScanMask(job.value.id,maskImageId.value,png))
  maskImageId.value=null
  progress.value='Mask saved. Continue reviewing the mask grid.'
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function saveReviewedMasks(ids) {
 if(busy.value || closed || job.value?.state!=='uploading')return
 busy.value=true;error.value=''
 try {
  const pending=job.value.images.filter(image=>ids.includes(image.id) && image.maskUrl && !image.maskReviewed)
  for(const [index,image] of pending.entries()) {
   if(closed)return
   progress.value=`Saving reviewed mask ${index+1} of ${pending.length}: ${image.name}`
   const png=await savedPhotoMaskPng(image)
   if(closed)return
   remember(await saveScanMask(job.value.id,image.id,png))
  }
  progress.value=`${pending.length} masks saved. Leave incorrect masks unchecked and edit their edges.`
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function batchMasks({background,tolerance}) {
 busy.value=true;error.value=''
 try {
  const pending=job.value.images.filter(image=>!image.maskReviewed)
  for(const [index,image] of pending.entries()) {
   progress.value=`Generating mask ${index+1} of ${pending.length}: ${image.name}`
   const png=await createPhotoMask(image,background,tolerance)
   remember(await saveScanMask(job.value.id,image.id,png,false))
  }
  progress.value='Draft masks generated. Review each photo before using background-removed photos.'
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
function acceptLikeness() {
 if(likenessChecks.value.length!==3)return
 accepted.value=true
}
async function observe() {
 clearTimeout(timer)
 if(closed || !job.value)return
 try{remember(await fetchScanJob(job.value.id));error.value=''}catch(cause){error.value=cause.message}
 if(!closed && ['queued','processing'].includes(job.value?.state))timer=setTimeout(observe,3000)
}
async function chooseAnotherCapture() {
 if(busy.value)return
 clearTimeout(timer);job.value=null;accepted.value=false;likenessChecks.value=[];referenceId.value=null;maskImageId.value=null;error.value='';progress.value=''
 try{localStorage.removeItem(storageKey);recoverable.value=(await api('scans/list.php')).jobs.filter(capture=>capture.engine==='tripo')}catch(cause){error.value=cause.message}
}
async function newCapture() {
 if(busy.value)return
 busy.value=true;error.value=''
 try {
  if(job.value)await discardScan(job.value.id)
  clearTimeout(timer);job.value=null;accepted.value=false;progress.value='';maskImageId.value=null;likenessChecks.value=[];referenceId.value=null
  try{localStorage.removeItem(storageKey)}catch{}
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function complete({payload,charmPoint}) {
 busy.value=true;error.value=''
 try {
  const draft=await finalizeScan(job.value.id,payload,charmPoint)
  remember({...job.value,state:'finalized',draft})
  emit('complete',draft,job.value.id)
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function recover(id) {error.value='';try{remember(await fetchScanJob(id));await observe()}catch(cause){error.value=cause.message}}
onMounted(async()=>{
 try{const capabilities=await api('scans/capabilities.php');maskAvailable.value=capabilities.aiMasks;tripoAvailable.value=capabilities.tripo}catch{}
 try{const id=localStorage.getItem(storageKey);if(id){const saved=await fetchScanJob(id);if(saved.engine==='tripo'){remember(saved);if(['queued','processing'].includes(saved.state))await observe()}else localStorage.removeItem(storageKey)}}catch{job.value=null}
 if(!job.value)try{recoverable.value=(await api('scans/list.php')).jobs.filter(capture=>capture.engine==='tripo')}catch(cause){error.value=cause.message}
})
onBeforeUnmount(()=>{closed=true;clearTimeout(timer)})
</script>
<template>
 <section class="photo-scanner" :class="{'painting-stage':job?.state==='ready'&&accepted}" aria-labelledby="scan-title">
  <div class="scan-header"><h3 id="scan-title">Generate a shoe from photos</h3><div class="scan-actions"><Button variant="outline" v-if="job" type="button" :disabled="busy" @click="chooseAnotherCapture">Choose another capture</Button><Button variant="outline" type="button" :disabled="busy" @click="emit('cancel')">Back to shoe details</Button></div></div>
  <p v-if="error" role="alert" class="scan-error">{{error}}</p>
  <div v-if="!job&&recoverable.length" class="scan-actions"><p>Saved captures:</p><Button variant="outline" v-for="capture in recoverable" :key="capture.id" type="button" @click="recover(capture.id)">Resume photo generation · {{capture.imageCount}} photos · {{capture.state}} · {{capture.createdAt}}</Button></div>
  <p v-if="!tripoAvailable" role="status">Photo generation needs a configured cloud service and local worker.</p>
  <p v-if="progress" role="status">{{progress}}</p>
  <TripoCapture v-if="!job || ['uploading','failed'].includes(job.state)" :job="job" :disabled="busy" :available="tripoAvailable" :mask-available="maskAvailable" @mask="generateAiMasks" @saved="remember" @queued="tripoQueued" @busy="busy=$event" @reset="newCapture">
   <template #masks>
    <ScanPhotoMask v-if="maskImage" :image="maskImage" :saving="busy" :ai-available="maskAvailable" @ai="generateAiMasks" v-model:background="maskColor" v-model:tolerance="maskTolerance" @save="saveMask" @batch="batchMasks" @close="maskImageId=null" />
    <ScanMaskReview v-else :images="job.images" :saving="busy" @save="saveReviewedMasks" @edit="maskImageId=$event" />
   </template>
  </TripoCapture>
  <template v-else-if="['queued','processing'].includes(job.state)">
   <p role="status">{{job.stage}}</p><p v-if="job.operation==='mask'">Removing backgrounds locally. Review cutouts when processing finishes.</p><p v-else>Cloud photo generation is handled by the local worker. Refreshing this page continues the existing task.</p><p>This may take several minutes. You can close this editor and return to the saved scan.</p>
   <Button variant="outline" type="button" @click="observe">Refresh status</Button>
  </template>
  <template v-else-if="job.state==='finalized'">
   <model-viewer v-if="job.draft" :src="job.draft.glbPath" camera-controls alt="Prepared scanned shoe" class="likeness-preview"></model-viewer>
   <p>Prepared model saved. Continue the catalog details, or start a new capture.</p>
   <div class="scan-actions"><Button variant="outline" v-if="job.draft" type="button" @click="emit('complete',job.draft,job.id)">Continue shoe details</Button><Button variant="outline" type="button" @click="newCapture">Start new capture</Button></div>
  </template>
  <template v-else-if="job.state==='ready'">
   <template v-if="!accepted">
    <p>{{job.stage}}</p>
    <div class="scan-comparison"><model-viewer :src="job.previewUrl" camera-controls alt="Reconstructed shoe preview" class="likeness-preview"></model-viewer><figure v-if="referenceImage"><img :src="referenceImage.previewUrl" :alt="referenceImage.name"><figcaption>Original photo — {{referenceImage.name}}</figcaption></figure></div>
    <div class="photo-grid"><figure v-for="image in job.images" :key="image.id"><Button variant="outline" type="button" @click="referenceId=image.id" :aria-label="'Compare with '+image.name"><img :src="image.previewUrl" :alt="image.name" loading="lazy"></Button></figure></div>
    <p>Compare the shape and photographed details from every angle. Accept only if this is a usable match for your actual shoe.</p>
    <fieldset class="likeness-checks"><legend>Check all views before marking parts</legend>
     <label><input v-model="likenessChecks" type="checkbox" value="front"> Front and toe shape match the original photos.</label>
     <label><input v-model="likenessChecks" type="checkbox" value="sides"> Both sides, sole, and heel match the original photos.</label>
     <label><input v-model="likenessChecks" type="checkbox" value="details"> Laces and tongue are usable; floor and background are removed.</label>
    </fieldset>
    <div class="scan-actions"><Button variant="outline" type="button" :disabled="likenessChecks.length!==3" @click="acceptLikeness">Shape matches — mark parts</Button><Button variant="outline" type="button" @click="newCapture">Recapture shoe</Button></div>
   </template>
   <fieldset v-else :disabled="busy"><ScanRegionEditor :preview-url="job.previewUrl" :saving="busy" @complete="complete" /></fieldset>
   <p v-if="busy" role="status">Saving prepared model…</p>
  </template>

 </section>
</template>
<style scoped>
.photo-scanner.painting-stage{--painting-height:clamp(300px,calc(100dvh - 540px),600px);padding:0;border:0}.painting-stage .scan-header h3{font-size:16px}

.scan-comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px}.scan-comparison figure{display:grid;align-content:center}.scan-comparison img{max-height:400px;width:100%;object-fit:contain}.likeness-checks{display:grid;gap:8px}.likeness-checks legend{font-weight:700;margin-bottom:8px}.likeness-checks label{display:flex;align-items:start;gap:8px}.likeness-checks input{margin-top:4px}.photo-scanner{padding:20px;border:1px solid #ccc;background:white;display:grid;grid-auto-rows:max-content;align-content:start;gap:16px;color:#202220}.scan-header{display:flex;justify-content:space-between;align-items:center;gap:12px}.scan-header h3{font-weight:700;font-size:20px}.scan-actions{display:flex;flex-wrap:wrap;gap:12px}ol{list-style:decimal;padding-left:22px;line-height:1.6}.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;max-height:260px;overflow:auto}.photo-grid img{width:100%;height:85px;object-fit:cover}.photo-grid button:not([data-slot]){padding:4px;font-size:12px;width:100%}button:not([data-slot]),.file-button:not([data-slot]){display:inline-block;border:1px solid #777;padding:10px 14px;background:white;cursor:pointer}button:not([data-slot]):disabled{opacity:.45;cursor:not-allowed}button:not([data-slot]):focus-visible,.file-button:focus-within{outline:2px solid #b94d27;outline-offset:2px}.file-button input{display:block;max-width:220px;font-size:12px;margin-top:6px}.scan-error{padding:12px;background:#fff0eb;color:#a92d17}.likeness-preview{width:100%;height:400px;background:#f4f5f3}@media(max-width:600px){.scan-comparison{grid-template-columns:1fr}.photo-scanner{padding:12px}.scan-header{align-items:start;flex-direction:column}.likeness-preview{height:300px}}
</style>
