<script setup>
import {ref,onBeforeUnmount} from 'vue'
import {validateVideoInput,extractVideoFrames} from '../scan-video.js'
const props=defineProps({native:{type:Boolean,default:false},disabled:{type:Boolean,default:false},capacity:{type:Number,default:120}})
const emit=defineEmits(['frames','busy','video'])
const clip=ref(null),preview=ref(''),extracting=ref(false),progress=ref(null),error=ref(''),message=ref('')
const metadataReady=ref(false)
let controller,closed=false
function choose(event){
 const file=event.target.files?.[0];event.target.value='';if(!file)return
 metadataReady.value=false
 error.value=(props.native && (!['video/mp4','video/quicktime'].includes(file.type)||!/\.(mp4|mov)$/i.test(file.name))?'Choose an MP4 or MOV video.':validateVideoInput(file))||'';message.value='';if(error.value)return
 if(preview.value)URL.revokeObjectURL(preview.value)
 clip.value=file;preview.value=URL.createObjectURL(file);progress.value=null
}
function checkMetadata(event){
 const video=event.target
 error.value=validateVideoInput(clip.value,{duration:video.duration,width:video.videoWidth,height:video.videoHeight})||''
 metadataReady.value=!error.value
}
async function extract(){
 if(!clip.value || extracting.value || props.disabled)return
 extracting.value=true;emit('busy',true);error.value='';message.value='';controller=new AbortController()
 try {
  const result=await extractVideoFrames(clip.value,{signal:controller.signal,maxFrames:Math.min(60,props.capacity),onProgress:value=>{if(!closed)progress.value=value}})
  if(closed)return
  emit('frames',result.files)
  message.value=`${result.files.length} frames selected from ${Math.round(result.duration)} seconds. Review the images below, then save selected photos.`
 }catch(cause){if(!closed){if(cause.name==='AbortError')message.value='Frame selection canceled. Existing photos kept.';else error.value=cause.message}}
 finally{extracting.value=false;progress.value=null;if(!closed)emit('busy',false)}
}
onBeforeUnmount(()=>{closed=true;controller?.abort();if(preview.value)URL.revokeObjectURL(preview.value)})
</script>
<template>
 <section class="scan-video" aria-labelledby="video-capture-title">
  <h4 id="video-capture-title">Use a video instead of individual photos</h4>
  <p>Record 45–90 seconds in three slow passes: shoe height, low around the sole, then above. Keep the shoe still and in frame; move around it with fixed zoom and good light. Avoid cinematic / portrait effects, digital stabilization and lens switching.</p>
  <div class="video-actions">
   <label>Choose video<input type="file" :accept="native?'video/mp4,video/quicktime,.mp4,.mov':'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov'" :disabled="disabled||extracting" @change="choose"></label>
   <label>Record video on phone<input type="file" accept="video/*" capture="environment" :disabled="disabled||extracting" @change="choose"></label>
  </div>
  <p class="video-help">{{native?'MP4 or browser-playable MOV':'MP4, WebM or browser-playable MOV'}} · 15–180 seconds · up to 300 MB. On desktop, record with your phone and choose the transferred clip.</p>
  <template v-if="clip">
   <video @loadedmetadata="checkMetadata" @error="error='Browser cannot read this video. Try H.264 MP4.';metadataReady=false" :src="preview" controls muted playsinline preload="metadata" aria-label="Shoe capture video"></video>
   <p>{{clip.name}}</p>
   <p v-if="native">Video uploads privately to this computer. AI masks are drafts: review every frame and fix shoe edges before reconstruction.</p>
   <p v-else>Video stays on this device. Only selected JPEG frames upload when you save them. Frames lack camera EXIF; shape may fail, so compare the reconstruction carefully. Original camera photos remain available.</p>
   <p v-if="!native && capacity<30" class="video-error">Make room for at least 30 frames by removing selected photos or starting a new capture.</p>
   <div v-if="native" class="video-actions"><button type="button" :disabled="disabled||!metadataReady" @click="emit('video',clip)">{{disabled?'Uploading video…':'Upload video and generate AI masks'}}</button></div>
   <div v-else class="video-actions"><button type="button" :disabled="disabled||extracting||capacity<30" @click="extract">{{extracting?'Selecting frames…':'Select sharp frames'}}</button><button v-if="extracting" type="button" @click="controller?.abort()">Cancel frame selection</button></div>
  </template>
  <div v-if="progress" role="status" aria-live="polite"><p>{{progress.stage}} · {{progress.done}} / {{progress.total}}</p><progress :value="progress.done" :max="progress.total" aria-label="Video frame processing"></progress></div>
  <p v-if="error" role="alert" class="video-error">{{error}}</p>
  <p v-if="message" role="status">{{message}}</p>
  <p v-if="!native" class="video-help">Selection checks sharpness, exposure and image changes. It cannot verify that every shoe surface was filmed. Review toe, both sides, heel, tongue and sole edges.</p>
 </section>
</template>
<style scoped>
.scan-video{border-top:1px solid #cfd2ce;border-bottom:1px solid #cfd2ce;padding:16px 0;display:grid;gap:12px}.scan-video h4{font-weight:700}.scan-video p{line-height:1.5}.video-actions{display:flex;flex-wrap:wrap;gap:12px}.video-actions label{display:grid;gap:6px;font-weight:600;font-size:14px}.video-actions input{max-width:260px;font-size:12px}.scan-video video{width:100%;max-width:560px;max-height:300px;background:#202220}.scan-video button{border:1px solid #777;padding:10px 14px;background:white;cursor:pointer}.scan-video button:disabled{opacity:.45;cursor:not-allowed}.scan-video :focus-visible{outline:2px solid #b94d27;outline-offset:2px}.video-help{font-size:12px;color:#626662}.video-error{padding:12px;background:#fff0eb;color:#a92d17}.scan-video progress{width:min(100%,560px)}
</style>
