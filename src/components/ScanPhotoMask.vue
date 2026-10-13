<script setup>
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import {ref,watch,onBeforeUnmount} from 'vue'
import {createForegroundMask,paintMask,readSavedMask,maskCoverage,readPhotoPixels,photoMaskPng} from '../scan-masks.js'
const props=defineProps({image:{type:Object,required:true},saving:Boolean,aiAvailable:Boolean})
const emit=defineEmits(['save','batch','close','ai'])
const background=defineModel('background',{default:'#20dc1e'}),tolerance=defineModel('tolerance',{default:80})
const surface=ref(null),mode=ref('pick'),radius=ref(24),error=ref(''),loading=ref(true),coverage=ref(1),canUndo=ref(false)
let source,pixels,mask,history=[],painting=false,last=null,generation=0,frame,keyboardPoint=null
function rgb(){return background.value.slice(1).match(/../g).map(value=>parseInt(value,16))}
function draw(){
 if(!surface.value || !source || !mask)return
 const context=surface.value.getContext('2d'),overlay=context.createImageData(source.width,source.height)
 context.drawImage(source,0,0)
 for(let i=0;i<mask.length;i++)if(mask[i]===0){overlay.data[i*4]=220;overlay.data[i*4+1]=55;overlay.data[i*4+2]=30;overlay.data[i*4+3]=145}
 const layer=document.createElement('canvas');layer.width=source.width;layer.height=source.height;layer.getContext('2d').putImageData(overlay,0,0);context.drawImage(layer,0,0)
 if(keyboardPoint){context.beginPath();context.arc(keyboardPoint.x,keyboardPoint.y,Number(radius.value)*source.width/surface.value.getBoundingClientRect().width,0,Math.PI*2);context.strokeStyle='#202220';context.lineWidth=3;context.stroke();context.strokeStyle='white';context.lineWidth=1;context.stroke()}
 coverage.value=maskCoverage(mask);canUndo.value=history.length>0
}
function scheduleDraw(){if(!frame)frame=requestAnimationFrame(()=>{frame=null;draw()})}
function checkpoint(){history.push(mask.slice());if(history.length>5)history.shift()}
function regenerate(){if(!source || props.saving || loading.value)return;checkpoint();mask=createForegroundMask(pixels,source.width,source.height,rgb(),Number(tolerance.value));draw()}
function undo(){if(history.length){mask=history.pop();draw()}}
function location(event){const rect=surface.value.getBoundingClientRect();return {x:(event.clientX-rect.left)*source.width/rect.width,y:(event.clientY-rect.top)*source.height/rect.height,r:Number(radius.value)*source.width/rect.width}}
function stroke(event){
 const point=location(event),previous=last || point,distance=Math.hypot(point.x-previous.x,point.y-previous.y),steps=Math.max(1,Math.ceil(distance/Math.max(1,point.r/2)))
 for(let i=1;i<=steps;i++)paintMask(mask,source.width,source.height,previous.x+(point.x-previous.x)*i/steps,previous.y+(point.y-previous.y)*i/steps,point.r,mode.value==='keep')
 last=point;scheduleDraw()
}
function down(event){
 if(loading.value || props.saving || event.button!==0)return
 if(mode.value==='pick'){
  const {x,y}=location(event),at=(Math.min(source.height-1,Math.max(0,Math.floor(y)))*source.width+Math.min(source.width-1,Math.max(0,Math.floor(x))))*4
  background.value='#'+[pixels[at],pixels[at+1],pixels[at+2]].map(value=>value.toString(16).padStart(2,'0')).join('');regenerate();return
 }
 checkpoint();painting=true;last=null;surface.value.setPointerCapture(event.pointerId);stroke(event)
}
function move(event){if(painting)stroke(event)}
function up(){painting=false;last=null}
function keydown(event){
 if(loading.value || props.saving || !mask)return
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter'].includes(event.key))return
 event.preventDefault();keyboardPoint ||= {x:source.width/2,y:source.height/2}
 const step=Number(radius.value)*source.width/surface.value.getBoundingClientRect().width/2
 if(event.key==='ArrowLeft')keyboardPoint.x=Math.max(0,keyboardPoint.x-step)
 if(event.key==='ArrowRight')keyboardPoint.x=Math.min(source.width-1,keyboardPoint.x+step)
 if(event.key==='ArrowUp')keyboardPoint.y=Math.max(0,keyboardPoint.y-step)
 if(event.key==='ArrowDown')keyboardPoint.y=Math.min(source.height-1,keyboardPoint.y+step)
 if(event.key===' ' || event.key==='Enter'){
  if(mode.value==='pick'){
   const at=(Math.floor(keyboardPoint.y)*source.width+Math.floor(keyboardPoint.x))*4
   background.value='#'+[pixels[at],pixels[at+1],pixels[at+2]].map(value=>value.toString(16).padStart(2,'0')).join('');regenerate()
  }else{checkpoint();paintMask(mask,source.width,source.height,keyboardPoint.x,keyboardPoint.y,step*2,mode.value==='keep')}
 }
 draw()
}
async function save(){
 if(loading.value || props.saving)return
 loading.value=true;error.value=''
 try{emit('save',await photoMaskPng(mask,source.width,source.height,props.image))}
 catch(cause){error.value=cause.message}finally{loading.value=false}
}
watch(()=>[props.image.id,props.image.maskUrl],async()=>{
 const token=++generation;loading.value=true;error.value='';history=[];keyboardPoint=null;mode.value=props.image.maskUrl?'keep':'pick';up()
 try{
  const loaded=await readPhotoPixels(props.image)
  if(token!==generation)return
  source=loaded.canvas;pixels=loaded.pixels;mask=createForegroundMask(pixels,source.width,source.height,rgb(),Number(tolerance.value))
  if(props.image.maskUrl)mask=await readSavedMask(props.image,source.width,source.height)
  if(token!==generation)return
  if(surface.value){surface.value.width=source.width;surface.value.height=source.height;draw()}
 }catch(cause){if(token===generation)error.value=cause.message}finally{if(token===generation)loading.value=false}
},{immediate:true,flush:'post'})
onBeforeUnmount(()=>{generation++;cancelAnimationFrame(frame)})
</script>
<template>
 <section class="mask-editor" aria-label="Remove photo background">
  <div class="mask-heading"><div><h4>Remove background</h4><p>{{image.name}}</p></div><Button variant="outline" type="button" :disabled="saving || loading" @click="emit('close')">Close mask editor</Button></div>
  <p class="mask-help">Red area will be removed. Keep the entire shoe, including sole and laces. Brush changes save only when you press Save.</p>
  <p v-if="error" role="alert" class="mask-error">{{error}}</p>
  <p v-if="loading" role="status">Preparing mask…</p>
  <fieldset :disabled="saving || loading || !!error">
   <div class="mask-tools" role="group" aria-label="Mask tools">
    <Button variant="outline" type="button" :aria-pressed="mode==='pick'" @click="mode='pick'">Pick background</Button>
    <Button variant="outline" type="button" :aria-pressed="mode==='keep'" @click="mode='keep'">Keep shoe brush</Button>
    <Button variant="outline" type="button" :aria-pressed="mode==='remove'" @click="mode='remove'">Remove background brush</Button>
    <Button variant="ghost" type="button" :disabled="!canUndo" @click="undo">Undo</Button>
   </div>
   <div class="mask-layout">
    <div class="mask-image-column">
     <div class="mask-scroll"><canvas ref="surface" class="mask-canvas" tabindex="0" aria-label="Photo mask; arrow keys move brush, Space paints or picks background" @keydown="keydown" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up"></canvas></div>
     <p class="mask-help">Focus photo, use arrow keys to move, then Space to paint or pick background.</p>
    </div>
    <aside class="mask-settings" aria-label="Mask settings">
     <section class="mask-section">
      <h5>{{mode==='pick'?'Background selection':mode==='keep'?'Keep shoe brush':'Remove background brush'}}</h5>
      <template v-if="mode==='pick'">
       <label class="color-field">Background color<input v-model="background" type="color"></label>
       <div class="mask-label"><label id="mask-tolerance-label">Color tolerance</label><output>{{tolerance}}</output></div>
       <Slider aria-labelledby="mask-tolerance-label" :model-value="[Number(tolerance)]" :min="10" :max="220" :disabled="saving||loading||!!error" @update:model-value="tolerance=$event[0]" />
       <Button variant="outline" type="button" @click="regenerate">Remove by color</Button>
       <p>Pick the background from the photo, then adjust tolerance. Color removal works best with a contrasting, plain background.</p>
      </template>
      <template v-else>
       <div class="mask-label"><label id="mask-radius-label">Brush radius</label><output>{{radius}} px</output></div>
       <Slider aria-labelledby="mask-radius-label" :model-value="[Number(radius)]" :min="4" :max="80" :disabled="saving||loading||!!error" @update:model-value="radius=$event[0]" />
       <p>{{mode==='keep'?'Paint over shoe edges to restore removed details.':'Paint over floor, shadows and remaining background.'}}</p>
      </template>
     </section>
     <section class="mask-section"><h5>Review mask</h5><p>{{Math.round(coverage*100)}}% of photo kept. Check shoe edges carefully before saving.</p></section>
     <details class="mask-section"><summary>Generate remaining masks</summary><div class="batch-tools">
      <template v-if="aiAvailable"><Button variant="outline" type="button" @click="emit('ai')">Generate AI masks for unreviewed photos</Button><p>Use AI for mixed backgrounds or similar shoe and background colors. Reviewed masks stay unchanged.</p></template>
      <Button variant="outline" type="button" @click="emit('batch',{background:rgb(),tolerance:Number(tolerance)})">Generate color masks for remaining photos</Button>
      <p>Batch generation saves drafts. Review drafts together in the mask grid before reconstruction.</p>
     </div></details>
    </aside>
   </div>
   <div class="mask-savebar"><p>Review shoe edges before saving.</p><Button type="button" :disabled="coverage<=0 || coverage>=1" @click="save">{{saving?'Saving…':'Save reviewed mask'}}</Button></div>
  </fieldset>
 </section>
</template>
<style scoped>
.mask-editor { --primary:#292b2d; --primary-foreground:#fff; display:grid; gap:16px; min-width:0; }
.mask-heading,.mask-label,.mask-savebar { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.mask-heading h4 { font-size:18px; font-weight:600; }
.mask-heading p,.mask-help,.mask-settings p,.mask-savebar p { font-size:13px; line-height:1.5; color:var(--muted-foreground); }
.mask-editor fieldset { min-width:0; display:grid; gap:16px; }
.mask-tools { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.mask-tools button[aria-pressed=true] { background:var(--primary); border-color:var(--primary); color:var(--primary-foreground); }
.mask-tools button:last-child { margin-left:auto; }
.mask-layout { --mask-height:clamp(240px,calc(100dvh - 510px),580px); display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:20px; align-items:start; }
.mask-image-column { display:grid; gap:8px; min-width:0; }
.mask-scroll { height:var(--mask-height); overflow:auto; display:grid; place-items:center; background:#f4f5f3; border:1px solid var(--border); border-radius:6px; }
.mask-canvas { display:block; max-width:100%; max-height:var(--mask-height); width:auto; height:auto; touch-action:none; cursor:crosshair; }
.mask-settings { max-height:var(--mask-height); overflow:auto; border:1px solid var(--border); border-radius:6px; }
.mask-section { display:grid; gap:16px; padding:16px; border-bottom:1px solid var(--border); }
.mask-section:last-child { border-bottom:0; }
.mask-section h5 { font-size:14px; font-weight:600; }
.color-field { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.mask-label output { font-size:12px; color:var(--muted-foreground); }
.mask-section summary { cursor:pointer; font-size:13px; font-weight:600; }
.batch-tools { display:grid; gap:12px; margin-top:16px; }
.batch-tools button { white-space:normal; height:auto; min-height:40px; }
.mask-savebar { position:sticky; bottom:0; z-index:5; background:var(--card); padding-bottom:12px; border-top:1px solid var(--border); padding-top:12px; }
.mask-error { color:var(--destructive); background:#fff0eb; padding:12px; border-radius:6px; font-size:14px; }
fieldset:disabled .mask-canvas { opacity:.5; cursor:default; }
input[type=color] { width:36px; height:30px; padding:2px; border:1px solid var(--input); border-radius:4px; }
canvas:focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
@media(max-width:900px) { .mask-layout { grid-template-columns:minmax(0,1fr); } .mask-savebar { flex-wrap:wrap; } }
</style>
