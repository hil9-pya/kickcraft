<script setup>
import {ref,computed,watch,nextTick,onBeforeUnmount} from 'vue'
import {readPhotoPixels,readSavedMask,maskCoverage} from '../scan-masks.js'
const props=defineProps({images:{type:Array,required:true},saving:Boolean})
const emit=defineEmits(['save','edit'])
const page=ref(0),selected=ref([]),ready=ref({}),errors=ref({}),loading=ref(false)
const pages=computed(()=>Math.ceil(props.images.length/12))
const visible=computed(()=>props.images.slice(page.value*12,page.value*12+12))
const surfaces=new Map()
let generation=0
function selectVisible() {
 if(props.saving)return
 selected.value=visible.value.filter(image=>image.maskUrl && !image.maskReviewed && ready.value[image.id]).map(image=>image.id)
}
async function loadPreviews() {
 const token=++generation,images=visible.value.slice()
 selected.value=[];ready.value={};errors.value={};loading.value=true
 await nextTick()
 for(const image of images) {
  try {
   const {canvas}=await readPhotoPixels(image,480)
   if(token!==generation)return
   if(image.maskUrl) {
    const mask=await readSavedMask(image,canvas.width,canvas.height)
    if(token!==generation)return
    const coverage=maskCoverage(mask)
    if(coverage<=0 || coverage>=1)throw new Error('Mask keeps everything or nothing. Edit this mask.')
    const context=canvas.getContext('2d'),overlay=context.getImageData(0,0,canvas.width,canvas.height)
    for(let i=0;i<mask.length;i++)if(mask[i]===0){
     overlay.data[i*4]=Math.round(overlay.data[i*4]*.43+220*.57)
     overlay.data[i*4+1]=Math.round(overlay.data[i*4+1]*.43+55*.57)
     overlay.data[i*4+2]=Math.round(overlay.data[i*4+2]*.43+30*.57)
    }
    context.putImageData(overlay,0,0)
   }
   const surface=surfaces.get(image.id)
   if(surface){surface.width=canvas.width;surface.height=canvas.height;surface.getContext('2d').drawImage(canvas,0,0)}
   if(image.maskUrl)ready.value[image.id]=true
  }catch(cause){if(token===generation)errors.value[image.id]=cause.message || 'Preview failed. Open mask editor to retry.'}
 }
 if(token===generation)loading.value=false
}
watch(()=>visible.value.map(image=>image.id+':'+(image.maskUrl||'')).join('|'),loadPreviews,{immediate:true})
watch(()=>props.images,()=>{selected.value=selected.value.filter(id=>props.images.some(image=>image.id===id && !image.maskReviewed && image.maskUrl))})
onBeforeUnmount(()=>{generation++})
</script>
<template>
 <section class="mask-review" aria-label="Review masks together">
  <h4>Review masks together</h4>
  <p>Red areas will be removed. Check that each whole shoe stays visible and the floor, support, and shadows are red. Select good masks; edit only the ones that need correction.</p>
  <div class="review-actions">
   <button type="button" :disabled="saving || loading" @click="selectVisible">Select visible unreviewed masks</button>
   <button type="button" :disabled="saving || !selected.length" @click="emit('save',selected.slice())">Save selected masks ({{selected.length}})</button>
  </div>
  <p aria-live="polite">Page {{page+1}} of {{pages}}<span v-if="loading"> · Loading overlays…</span></p>
  <div class="review-grid" :aria-busy="loading">
   <figure v-for="image in visible" :key="image.id">
    <canvas :ref="element=>element?surfaces.set(image.id,element):surfaces.delete(image.id)" role="img" :aria-label="'Mask overlay for '+image.name"></canvas>
    <figcaption>{{image.name}}</figcaption>
    <p v-if="errors[image.id]" class="review-error" role="alert">{{errors[image.id]}}</p>
    <p v-else-if="image.maskReviewed">Mask reviewed</p>
    <p v-else-if="!image.maskUrl">Mask needed</p>
    <label v-else><input v-model="selected" type="checkbox" :value="image.id" :disabled="saving || !ready[image.id]"> Mask looks correct</label>
    <button type="button" :disabled="saving" :aria-label="'Edit mask for '+image.name" @click="emit('edit',image.id)">Edit mask</button>
   </figure>
  </div>
  <div class="review-actions">
   <button type="button" :disabled="saving || page===0" @click="page--">Previous 12</button>
   <button type="button" :disabled="saving || page+1>=pages" @click="page++">Next 12</button>
   <button type="button" :disabled="saving || !selected.length" @click="emit('save',selected.slice())">Save selected masks ({{selected.length}})</button>
  </div>
  <p>Changing pages clears unsaved selections. Save selected masks before moving on.</p>
 </section>
</template>
<style scoped>
.mask-review{border:1px solid #aaa;padding:16px;display:grid;gap:12px}.mask-review h4{font-weight:700}.review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.review-grid figure{min-width:0;display:grid;align-content:start;gap:8px}.review-grid canvas{width:100%;height:190px;object-fit:contain;background:#f4f5f3}.review-grid figcaption{font-size:12px;overflow-wrap:anywhere}.review-grid label{display:flex;gap:8px;align-items:center}.review-actions{display:flex;flex-wrap:wrap;gap:8px}.review-error{color:#a92d17}button{border:1px solid #777;padding:8px 12px;background:white}button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,input:focus-visible{outline:2px solid #b94d27;outline-offset:2px}@media(max-width:500px){.review-grid{grid-template-columns:1fr}.mask-review{padding:12px}.review-grid canvas{height:240px}}
</style>
