<script setup>
import {ref,computed,watch,onBeforeUnmount} from 'vue'
import {validateCaptureFile,fetchScanJob} from '../scan-capture.js'
import {uploadTripoCapture,startTripoScan} from '../tripo-capture.js'
const props=defineProps({job:{type:Object,default:null},disabled:Boolean,available:Boolean,maskAvailable:Boolean})
const emit=defineEmits(['saved','queued','busy','reset','mask'])
const selected=ref({}),error=ref(''),progress=ref(''),consent=ref(false),useMasks=ref(false)
const views=[{id:'front',label:'Front / three-quarter (required)'},{id:'left',label:'Left side (optional)'},{id:'back',label:'Heel / back (optional)'},{id:'right',label:'Right side (optional)'}]
const saved=computed(()=>Object.fromEntries((props.job?.images || []).map(image=>[image.view,image])))
const hasFiles=computed(()=>Object.keys(selected.value).length>0)
const resumed=computed(()=>props.job?.tripoTaskSaved===true)
const hasMasks=computed(()=>props.job?.images?.some(image=>image.maskUrl))
const masksReady=computed(()=>!useMasks.value || (props.job?.images?.length>0 && props.job.images.every(image=>image.maskUrl && image.maskReviewed)))
watch(()=>[props.job?.id,props.job?.tripoTaskSaved,props.job?.images?.map(image=>image.maskUrl).join('|')],()=>{
 useMasks.value=resumed.value?props.job.tripoUseMasks===true:!!hasMasks.value;consent.value=false
},{immediate:true})
async function choose(event,view) {
 const file=event.target.files?.[0];event.target.value='';if(!file)return
 emit('busy',true);error.value='';const url=URL.createObjectURL(file)
 try {
  const image=new Image();image.src=url;await image.decode()
  const message=validateCaptureFile(file,{width:image.naturalWidth,height:image.naturalHeight})
  if(message)throw new Error(message)
  if(Math.min(image.naturalWidth,image.naturalHeight)<256)throw new Error('Choose a photo at least 256 pixels on each side.')
  if(selected.value[view])URL.revokeObjectURL(selected.value[view].url)
  selected.value[view]={file,url}
 }catch(cause){URL.revokeObjectURL(url);error.value=cause.message}finally{emit('busy',false)}
}
async function upload() {
 emit('busy',true);error.value=''
 try {
  const entries=views.filter(view=>selected.value[view.id]&&!saved.value[view.id]).map(view=>({view:view.id,file:selected.value[view.id].file}))
  await uploadTripoCapture(entries,(job,done,total)=>{emit('saved',job);progress.value=`Saved ${done} of ${total} photos locally`},props.job)
  for(const item of Object.values(selected.value))URL.revokeObjectURL(item.url)
  selected.value={}
 }catch(cause){error.value=cause.message;if(cause.jobId)try{emit('saved',await fetchScanJob(cause.jobId))}catch{}}
 finally{emit('busy',false)}
}
async function generate() {
 if(!consent.value || !masksReady.value || hasFiles.value)return
 emit('busy',true);error.value=''
 try{emit('queued',await startTripoScan(props.job.id,useMasks.value))}catch(cause){error.value=cause.message}finally{emit('busy',false)}
}
onBeforeUnmount(()=>{for(const item of Object.values(selected.value))URL.revokeObjectURL(item.url)})
</script>
<template>
 <div class="tripo-capture">
  <p>Tripo AI generates a textured shoe from one clear photo or up to four labeled views. Multiple views show more of your actual shoe. Use your own original design; AI can invent unseen details.</p>
  <p v-if="!available" role="alert">Tripo is not configured. Ask the owner to configure the private API key and local worker, or use the local scanner.</p>
  <p v-if="error" role="alert" class="capture-error">{{error}}</p>
  <p v-if="job?.error" role="alert" class="capture-error">{{job.error}}</p>
  <fieldset v-if="!job || job.state==='uploading'" :disabled="disabled || !available">
   <legend>Reference photos</legend>
   <p>Use sharp JPG/PNG photos, 256 pixels or more on each side, up to 10 MB each. Photograph the same stationary shoe with consistent lighting and a simple background. Save photos first, then optionally remove backgrounds together and review the cutouts.</p>
   <div class="view-grid"><label v-for="view in views" :key="view.id">{{view.label}}
    <img v-if="saved[view.id] || selected[view.id]" :src="saved[view.id]?.previewUrl || selected[view.id].url" :alt="view.label">
    <span v-if="saved[view.id]">Saved locally</span>
    <input v-else type="file" accept="image/jpeg,image/png" :aria-label="view.label" @change="choose($event,view.id)">
   </label></div>
   <button type="button" :disabled="!hasFiles || (!saved.front && !selected.front)" @click="upload">Save reference photos</button>
  </fieldset>
  <section v-if="job?.state==='uploading' && job.imageCount" class="background-tools" aria-label="Optional background removal">
   <h4>Background cleanup (optional)</h4>
   <p>Remove backgrounds locally before sending photos to Tripo. No extra Tripo credits. Reviewed masks are kept; check laces, toe and sole edges carefully.</p>
   <button type="button" :disabled="disabled || hasFiles || !maskAvailable || job.maskCount===job.imageCount" @click="consent=false;emit('mask')">Remove backgrounds</button>
   <p v-if="!maskAvailable">Local AI masking is unavailable. Use the original photos or configure the existing local masking worker.</p>
   <label v-if="hasMasks" class="cloud-consent"><input v-model="useMasks" type="checkbox" :disabled="disabled" @change="consent=false">Use background-removed photos for generation</label>
   <p v-if="hasMasks" role="status">{{useMasks?'Review and save every cutout before generation.':'Original photos will be sent. Saved masks remain available.'}} {{job.maskCount}} of {{job.imageCount}} masks reviewed.</p>
   <slot v-if="hasMasks" name="masks"></slot>
  </section>
  <p v-if="progress" role="status">{{progress}}</p>
  <template v-if="job && (job.state==='uploading' || job.canRetry)">
   <p v-if="resumed">Resume saved Tripo task. No new generation request or generation charge will be made.</p>
   <p v-else><strong>Generation costs 30 API credits ($0.30), from the owner's Tripo balance.</strong> Saving photos locally is free. Defining and recoloring parts afterwards is free. No paid segmentation is included.</p>
   <label class="cloud-consent"><input v-model="consent" type="checkbox" :disabled="disabled || !available">{{resumed?'Resume the saved task and download its result from Tripo.':'I agree to send these reference photos to Tripo cloud and use 30 API credits for this generation.'}}</label>
   <button type="button" :disabled="disabled || !available || !consent || hasFiles || !saved.front || !masksReady" @click="generate">{{disabled?'Working…':resumed?'Resume saved Tripo task':'Generate shoe — 30 credits'}}</button>
  </template>
  <p v-if="useMasks && !masksReady" role="status">Generation stays disabled until every background-removed photo is reviewed. Uncheck the option to use originals instead.</p>
  <p>Generated models need photo comparison, at least two editable parts, and normal product/admin review. Nothing is approved or published automatically.</p>
  <button v-if="job" type="button" :disabled="disabled" @click="emit('reset')">Start new capture</button>
 </div>
</template>
<style scoped>
.tripo-capture{display:grid;gap:16px}.background-tools{display:grid;gap:12px;border-top:1px solid #ccc;padding-top:16px}.background-tools h4{font-weight:700}.view-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.view-grid label{display:grid;gap:8px;align-content:start}.view-grid img{width:100%;height:150px;object-fit:contain;background:#f4f5f3}.cloud-consent{display:flex;align-items:start;gap:10px}fieldset{border:1px solid #ccc;padding:16px}button{border:1px solid #8c918a;padding:10px 14px;background:white;color:#202220;justify-self:start}button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,input:focus-visible{outline:2px solid #b94d27;outline-offset:2px}.capture-error{color:#a92d17;background:#fff0eb;padding:12px}@media(max-width:600px){.view-grid{grid-template-columns:1fr}}
</style>
