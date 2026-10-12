<script setup>
import {ref,computed,onMounted,onBeforeUnmount} from 'vue'
import ScanPhotoMask from './ScanPhotoMask.vue'
import ScanVideoCapture from './ScanVideoCapture.vue'
import {createPhotoMask} from '../scan-masks.js'
import ScanRegionEditor from './ScanRegionEditor.vue'
import {api} from '../api.js'
import {validateCaptureFile,uploadCapture,fetchScanJob,startScan,finalizeScan,discardScan,saveScanMask,scanStorageKey} from '../scan-capture.js'
const props=defineProps({accountId:{type:Number,default:null}})
const emit=defineEmits(['complete','cancel'])
const files=ref([]),job=ref(null),error=ref(''),busy=ref(false),progress=ref(''),accepted=ref(false)
const maskImageId=ref(null),maskColor=ref('#20dc1e'),maskTolerance=ref(80),likenessChecks=ref([]),referenceId=ref(null)
const maskImage=computed(()=>job.value?.images?.find(image=>image.id===maskImageId.value))
const missingCalibration=computed(()=>job.value?.images?.filter(image=>!image.cameraMetadata).length || 0)
const referenceImage=computed(()=>job.value?.images?.find(image=>image.id===referenceId.value) || job.value?.images?.[0])
const recoverable=ref([])
let timer,closed=false
const storageKey=scanStorageKey(props.accountId)
function remember(value) {job.value=value;try{localStorage.setItem(storageKey,value.id)}catch{}}
function clearFiles() {files.value.forEach(item=>URL.revokeObjectURL(item.url));files.value=[]}
async function choose(event) {
 if(busy.value)return
 busy.value=true;error.value='';progress.value='Checking selected photos…'
 try {
 for(const file of Array.from(event.target.files || [])) {
  if(files.value.length+(job.value?.imageCount||0)>=120){error.value='A scan accepts at most 120 photos.';break}
  const url=URL.createObjectURL(file)
  try {
   const image=new Image();image.src=url;await image.decode()
   const message=validateCaptureFile(file,{width:image.naturalWidth,height:image.naturalHeight})
   if(message)throw new Error(message)
   files.value.push({file,url})
  } catch(cause){URL.revokeObjectURL(url);error.value=cause.message || 'Photo cannot be read.'}
 }
 }finally{event.target.value='';busy.value=false;progress.value='Photos checked. Save selected photos to continue.'}
}
function addVideoFrames(selected) {
 if(closed)return
 const remaining=120-(job.value?.imageCount||0)-files.value.length
 if(selected.length>remaining){error.value='A scan accepts at most 120 photos. Remove selected images before adding this video.';return}
 for(const file of selected)files.value.push({file,url:URL.createObjectURL(file)})
 error.value='';progress.value='Video frames selected. Review coverage, then save selected photos.'
}
function remove(index) {URL.revokeObjectURL(files.value[index].url);files.value.splice(index,1)}
async function upload() {
 busy.value=true;error.value=''
 try {
  const value=await uploadCapture(files.value.map(item=>item.file),(value,done,total)=>{remember(value);progress.value=`Uploaded ${done} of ${total} selected photos`},job.value?.id)
  remember(value);clearFiles();progress.value='Photos saved. Start reconstruction when your capture is complete.'
 } catch(cause){error.value=cause.message;if(cause.jobId){try{remember(await fetchScanJob(cause.jobId))}catch{}}}finally{busy.value=false}
}
async function saveMask(png) {
 busy.value=true;error.value=''
 try {
  remember(await saveScanMask(job.value.id,maskImageId.value,png))
  maskImageId.value=job.value.images.find(image=>!image.maskReviewed)?.id || null
  progress.value='Mask saved. Review the next photo, including shoe edges.'
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
  progress.value='Draft masks generated. Review each photo before starting reconstruction.'
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
function acceptLikeness() {
 if(likenessChecks.value.length!==3)return
 accepted.value=true
}
async function start() {
 busy.value=true;error.value=''
 try{remember(await startScan(job.value.id));await observe()}catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function observe() {
 clearTimeout(timer)
 if(closed || !job.value)return
 try{remember(await fetchScanJob(job.value.id));error.value=''}catch(cause){error.value=cause.message}
 if(!closed && ['queued','processing'].includes(job.value?.state))timer=setTimeout(observe,3000)
}
async function newCapture() {
 if(busy.value)return
 busy.value=true;error.value=''
 try {
  if(job.value)await discardScan(job.value.id)
  clearTimeout(timer);clearFiles();job.value=null;accepted.value=false;progress.value='';maskImageId.value=null;likenessChecks.value=[];referenceId.value=null
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
 try{const id=localStorage.getItem(storageKey);if(id){job.value={id};await observe();if(!job.value.state)job.value=null}}catch{job.value=null}
 if(!job.value)try{recoverable.value=(await api('scans/list.php')).jobs}catch(cause){error.value=cause.message}
})
onBeforeUnmount(()=>{closed=true;clearTimeout(timer);clearFiles()})
</script>
<template>
 <section class="photo-scanner" aria-labelledby="scan-title">
  <div class="scan-header"><h3 id="scan-title">Scan a shoe from photos or video</h3><button type="button" :disabled="busy" @click="emit('cancel')">Back to shoe details</button></div>
  <p v-if="error" role="alert" class="scan-error">{{error}}</p>
  <div v-if="!job&&recoverable.length" class="scan-actions"><p>Saved captures:</p><button v-for="capture in recoverable" :key="capture.id" type="button" @click="recover(capture.id)">Resume {{capture.imageCount}} photos · {{capture.state}} · {{capture.createdAt}}</button></div>
  <template v-if="!job || job.state==='uploading'">
   <ol>
    <li>Keep one original shoe stationary. Move the camera around it in three rings: low, middle, and above. Aim for 60–100 views.</li>
    <li>Fill most of each frame with the shoe. Capture overlapping left, right, front, heel, and top views with sharp photos, soft light, and fixed zoom. Use original camera files with camera metadata; avoid screenshots and resized copies.</li>
    <li>Use a contrasting matte background. Raise the shoe on a small stationary support to photograph sole edges. Keep nearby texture for camera matching; mask out background and support. Do not move the shoe or use a turntable.</li>
    <li>Choose 30–120 JPG/PNG photos, or select frames from a video below. Photos: up to 10 MB and 24 megapixels each. Glossy or plain surfaces may reconstruct poorly.</li>
   </ol>
   <div class="scan-actions">
    <label class="file-button">Choose photos<input type="file" accept="image/jpeg,image/png" multiple :disabled="busy" @change="choose"></label>
    <label class="file-button">Take a photo<input type="file" accept="image/jpeg,image/png" capture="environment" :disabled="busy" @change="choose"></label>
   </div>
   <ScanVideoCapture :disabled="busy" :capacity="120-(job?.imageCount||0)-files.length" @busy="busy=$event" @frames="addVideoFrames" />
   <p v-if="missingCalibration" class="scan-error">{{missingCalibration}} photos have no camera focal metadata. Original phone/camera JPGs are preferred. If the shape fails comparison, recapture with original camera files.</p>
   <p>{{job?.imageCount || 0}} photos saved · {{files.length}} selected for upload</p>
   <div class="photo-grid">
    <figure v-for="image in job?.images || []" :key="image.id"><img :src="image.previewUrl" :alt="image.name" loading="lazy"><figcaption>{{image.maskReviewed?'Mask reviewed':image.maskUrl?'Review draft mask':'Mask needed'}}</figcaption><button type="button" :disabled="busy" @click="maskImageId=image.id">{{image.maskReviewed?'Edit mask':'Remove background'}}</button></figure>
    <figure v-for="(item,index) in files" :key="item.url"><img :src="item.url" :alt="item.file.name"><button type="button" :disabled="busy" @click="remove(index)" :aria-label="'Remove '+item.file.name">Remove</button></figure>
   </div>
   <p v-if="job">{{job.maskCount || 0}} of {{job.imageCount}} background masks reviewed. Every photo needs a reviewed mask.</p>
   <ScanPhotoMask v-if="maskImage" :image="maskImage" :saving="busy" v-model:background="maskColor" v-model:tolerance="maskTolerance" @save="saveMask" @batch="batchMasks" @close="maskImageId=null" />
   <p v-if="progress" aria-live="polite">{{progress}}</p>
   <div class="scan-actions">
    <button type="button" :disabled="busy || !files.length" @click="upload">{{busy?'Working…':'Save selected photos'}}</button>
    <button type="button" :disabled="busy || files.length>0 || (job?.imageCount || 0)<30 || job.maskCount!==job.imageCount" @click="start">Start reconstruction</button>
    <button v-if="job" type="button" :disabled="busy" @click="newCapture">Start new capture</button>
   </div>
   <p v-if="job">Saved photos survive a reload. Reselect any photos whose upload was interrupted; duplicates are skipped.</p>
  </template>
  <template v-else-if="['queued','processing'].includes(job.state)">
   <p role="status">{{job.stage}}</p><p>This may take several minutes. You can close this editor and return to the saved scan.</p>
   <button type="button" @click="observe">Refresh status</button>
  </template>
  <template v-else-if="job.state==='finalized'">
   <model-viewer v-if="job.draft" :src="job.draft.glbPath" camera-controls alt="Prepared scanned shoe" class="likeness-preview"></model-viewer>
   <p>Prepared model saved. Continue the catalog details, or start a new capture.</p>
   <div class="scan-actions"><button v-if="job.draft" type="button" @click="emit('complete',job.draft,job.id)">Continue shoe details</button><button type="button" @click="newCapture">Start new capture</button></div>
  </template>
  <template v-else-if="job.state==='ready'">
   <template v-if="!accepted">
    <p>{{job.stage}}</p>
    <div class="scan-comparison"><model-viewer :src="job.previewUrl" camera-controls alt="Reconstructed shoe preview" class="likeness-preview"></model-viewer><figure v-if="referenceImage"><img :src="referenceImage.previewUrl" :alt="referenceImage.name"><figcaption>Original photo — {{referenceImage.name}}</figcaption></figure></div>
    <div class="photo-grid"><figure v-for="image in job.images" :key="image.id"><button type="button" @click="referenceId=image.id" :aria-label="'Compare with '+image.name"><img :src="image.previewUrl" :alt="image.name" loading="lazy"></button></figure></div>
    <p>Compare the shape and photographed details from every angle. Accept only if this is a usable match for your actual shoe.</p>
    <fieldset class="likeness-checks"><legend>Check all views before marking parts</legend>
     <label><input v-model="likenessChecks" type="checkbox" value="front"> Front and toe shape match the original photos.</label>
     <label><input v-model="likenessChecks" type="checkbox" value="sides"> Both sides, sole, and heel match the original photos.</label>
     <label><input v-model="likenessChecks" type="checkbox" value="details"> Laces and tongue are usable; floor and background are removed.</label>
    </fieldset>
    <div class="scan-actions"><button type="button" :disabled="likenessChecks.length!==3" @click="acceptLikeness">Shape matches — mark parts</button><button type="button" @click="newCapture">Recapture shoe</button></div>
   </template>
   <fieldset v-else :disabled="busy"><ScanRegionEditor :preview-url="job.previewUrl" :saving="busy" @complete="complete" /></fieldset>
   <p v-if="busy" role="status">Saving prepared model…</p>
  </template>
  <template v-else-if="job.state==='failed'"><p role="alert" class="scan-error">{{job.error || 'Reconstruction failed.'}}</p><button type="button" @click="newCapture">Start new capture</button></template>
 </section>
</template>
<style scoped>
.scan-comparison{display:grid;grid-template-columns:1fr 1fr;gap:16px}.scan-comparison figure{display:grid;align-content:center}.scan-comparison img{max-height:400px;width:100%;object-fit:contain}.likeness-checks{display:grid;gap:8px}.likeness-checks legend{font-weight:700;margin-bottom:8px}.likeness-checks label{display:flex;align-items:start;gap:8px}.likeness-checks input{margin-top:4px}.photo-scanner{padding:20px;border:1px solid #ccc;background:white;display:grid;grid-auto-rows:max-content;align-content:start;gap:16px;color:#202220}.scan-header{display:flex;justify-content:space-between;align-items:center;gap:12px}.scan-header h3{font-weight:700;font-size:20px}.scan-actions{display:flex;flex-wrap:wrap;gap:12px}ol{list-style:decimal;padding-left:22px;line-height:1.6}.photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px;max-height:260px;overflow:auto}.photo-grid img{width:100%;height:85px;object-fit:cover}.photo-grid button{padding:4px;font-size:12px;width:100%}button,.file-button{display:inline-block;border:1px solid #777;padding:10px 14px;background:white;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,.file-button:focus-within{outline:2px solid #b94d27;outline-offset:2px}.file-button input{display:block;max-width:220px;font-size:12px;margin-top:6px}.scan-error{padding:12px;background:#fff0eb;color:#a92d17}.likeness-preview{width:100%;height:400px;background:#f4f5f3}@media(max-width:600px){.scan-comparison{grid-template-columns:1fr}.photo-scanner{padding:12px}.scan-header{align-items:start;flex-direction:column}.likeness-preview{height:300px}}
</style>

