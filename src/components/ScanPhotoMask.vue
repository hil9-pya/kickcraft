<script setup>
import {ref,watch,onBeforeUnmount} from 'vue'
import {createForegroundMask,paintMask,displayMask,maskCoverage,readPhotoPixels,photoMaskPng} from '../scan-masks.js'
const props=defineProps({image:{type:Object,required:true},saving:Boolean})
const emit=defineEmits(['save','batch','close'])
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
 const token=++generation;loading.value=true;error.value='';history=[];keyboardPoint=null;up()
 try{
  const loaded=await readPhotoPixels(props.image)
  if(token!==generation)return
  source=loaded.canvas;pixels=loaded.pixels;mask=createForegroundMask(pixels,source.width,source.height,rgb(),Number(tolerance.value))
  if(props.image.maskUrl){
   const saved=new Image();saved.src=props.image.maskUrl;await saved.decode()
   if(token!==generation)return
   const raw=document.createElement('canvas'),swapped=(props.image.orientation || 1)>=5
   raw.width=swapped?source.height:source.width;raw.height=swapped?source.width:source.height
   const context=raw.getContext('2d',{willReadFrequently:true});context.imageSmoothingEnabled=false;context.drawImage(saved,0,0,raw.width,raw.height)
   const data=context.getImageData(0,0,raw.width,raw.height).data,values=new Uint8Array(raw.width*raw.height)
   for(let i=0;i<values.length;i++)values[i]=data[i*4]>=128?255:0
   mask=displayMask(values,raw.width,raw.height,props.image.orientation || 1)
  }
  if(surface.value){surface.value.width=source.width;surface.value.height=source.height;draw()}
 }catch(cause){if(token===generation)error.value=cause.message}finally{if(token===generation)loading.value=false}
},{immediate:true,flush:'post'})
onBeforeUnmount(()=>{generation++;cancelAnimationFrame(frame)})
</script>
<template>
 <section class="mask-editor" aria-label="Remove photo background">
  <div class="mask-heading"><h4>{{image.name}}</h4><button type="button" :disabled="saving || loading" @click="emit('close')">Close mask editor</button></div>
  <p>Red area will be removed. Keep the entire shoe, including sole and laces. Remove floor, shadows, and background. Brush changes save only when you press Save.</p>
  <p v-if="error" role="alert" class="mask-error">{{error}}</p>
  <p v-if="loading" role="status">Preparing mask…</p>
  <fieldset :disabled="saving || loading || !!error">
   <div class="mask-tools">
    <button type="button" :aria-pressed="mode==='pick'" @click="mode='pick'">Pick background</button>
    <label>Background color<input v-model="background" type="color"></label>
    <label>Color tolerance<input v-model="tolerance" type="range" min="10" max="220"><output>{{tolerance}}</output></label>
    <button type="button" @click="regenerate">Remove this background</button>
    <button type="button" :aria-pressed="mode==='keep'" @click="mode='keep'">Keep shoe brush</button>
    <button type="button" :aria-pressed="mode==='remove'" @click="mode='remove'">Remove background brush</button>
    <label>Brush size<input v-model="radius" type="range" min="4" max="80"></label>
    <button type="button" :disabled="!canUndo" @click="undo">Undo</button>
   </div>
   <div class="mask-scroll"><canvas ref="surface" class="mask-canvas" tabindex="0" aria-label="Photo mask; arrow keys move brush, Space paints or picks background" @keydown="keydown" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up"></canvas></div>
   <p>Keyboard: focus photo, use arrow keys to move, then Space to paint or pick background.</p>
   <p>{{Math.round(coverage*100)}}% of photo kept. Check shoe edges carefully before saving.</p>
   <div class="mask-tools">
    <button type="button" :disabled="coverage<=0 || coverage>=1" @click="save">Save reviewed mask &amp; next</button>
    <button type="button" @click="emit('batch',{background:rgb(),tolerance:Number(tolerance)})">Generate masks for remaining photos</button>
   </div>
   <p>Batch generation saves drafts. Review every photo before reconstruction. Color removal works best with a contrasting, plain background.</p>
  </fieldset>
 </section>
</template>
<style scoped>
.mask-editor{border:1px solid #aaa;padding:16px;display:grid;gap:12px}.mask-heading,.mask-tools{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.mask-heading{justify-content:space-between}.mask-heading h4{font-weight:700}.mask-tools{margin-bottom:12px}.mask-tools label{display:flex;gap:8px;align-items:center;font-size:14px}.mask-scroll{max-height:600px;overflow:auto}.mask-canvas{display:block;width:100%;touch-action:none;cursor:crosshair;background:#f4f5f3;height:auto}.mask-error{color:#a92d17}button{border:1px solid #777;padding:8px 12px;background:white}button[aria-pressed=true]{background:#202220;color:white}button:disabled,fieldset:disabled{opacity:.5}button:focus-visible,input:focus-visible,canvas:focus-visible{outline:2px solid #b94d27;outline-offset:2px}fieldset>p{margin:12px 0}input[type=color]{width:40px}
</style>
