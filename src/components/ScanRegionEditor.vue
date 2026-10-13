<script setup>
import { Button } from './ui/button'
import {ref,onMounted,onBeforeUnmount,computed} from 'vue'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {PARTS} from '../customization.js'
import {setRegionControls,createRegionState,surfaceBrushFaces,sampleFaceColors,smartFillFaces,paintFaces,cropFaces,undoStroke,exportScanRegions,buildRegionGroups,neutralDetailTexture} from '../scan-regions.js'
const props=defineProps({previewUrl:{type:String,required:true},saving:{type:Boolean,default:false}})
const emit=defineEmits(['complete'])
const editor=ref(null),fullscreen=ref(false),fills=ref([])
const host=ref(null),error=ref(''),ready=ref(false),busy=ref(false)
const mode=ref('rotate'),region=ref('upper'),radius=ref(16),revision=ref(0),charm=ref(null),testColor=ref('#ffffff')
const cursor=ref(null),fillTolerance=ref(40)
let previewMesh,neutralMap,textureColors,paintPointer=null
const previewColors={}
const cropMin=ref(-100),cropMax=ref(100),cropAxis=ref('y')
let renderer,scene,camera,controls,mesh,overlay,state,frame,observer,disposed=false,painting=false
const pending=new Set(),raycaster=new THREE.Raycaster(),point=new THREE.Vector2()
const swatches=['#e87558','#e9c460','#809c75','#b99bd0','#7fbed0','#cc8cad','#abb9c2','#b7a176']
const counts=computed(()=>{revision.value;return Object.fromEntries(PARTS.map(part=>[part.id,state?.assignments.filter(id=>id===part.id).length || 0]))})
const fillCount=computed(()=>{revision.value;return pending.size})
const brushActive=computed(()=>['paint','erase'].includes(mode.value) && !busy.value && !props.saving)
const partCount=computed(()=>Object.values(counts.value).filter(Boolean).length)
function refresh() {
 if(!mesh || !state) return
 const colors=new Float32Array(state.assignments.length*9),color=new THREE.Color()
 const kept=[]
 state.assignments.forEach((assigned,id)=>{
  const selected=pending.has(id) ? (mode.value==='erase'?null:region.value) : assigned
  color.set(selected && selected!=='removed' ? swatches[PARTS.findIndex(p=>p.id===selected)] : '#888888')
  for(let vertex=0;vertex<3;vertex++) color.toArray(colors,id*9+vertex*3)
  if(assigned!=='removed') kept.push(id)
 })
 overlay.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3))
 for(const geometry of [mesh.geometry,overlay.geometry]) {
  geometry.clearGroups()
  let start=null,last=null
  for(const id of kept) {
   if(start!==null && id!==last+1) {geometry.addGroup(start*3,(last-start+1)*3,0);start=null}
   if(start===null) start=id
   last=id
  }
  if(start!==null) geometry.addGroup(start*3,(last-start+1)*3,0)
 }
 mesh.visible=mode.value!=='preview'
 if(previewMesh)previewMesh.visible=mode.value==='preview'
 overlay.visible=['paint','erase','fill'].includes(mode.value)
 revision.value++
}
function pick(clientX,clientY) {
 const rect=renderer.domElement.getBoundingClientRect()
 point.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1)
 raycaster.setFromCamera(point,camera)
 return raycaster.intersectObject(mesh,false).find(hit=>state.assignments[hit.faceIndex]!=='removed')
}
function brush(event) {
 const hit=pick(event.clientX,event.clientY)
 if(hit) {
  const height=renderer.domElement.getBoundingClientRect().height
  const distance=hit.point.distanceTo(camera.position)
  const worldRadius=2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*Number(radius.value)/height
  const center=mesh.worldToLocal(hit.point.clone()),eye=mesh.worldToLocal(camera.position.clone())
  pending.add(hit.faceIndex)
  for(const id of surfaceBrushFaces(state,center,worldRadius,eye))pending.add(id)
 }
 refresh()
}
function rebuildFills() {
 pending.clear()
 for(const fill of fills.value)for(const id of fill.faces)pending.add(id)
 refresh()
}
function suggestFill(seed) {
 if(!ready.value || busy.value || props.saving)return
 error.value=''
 try {
  if(!textureColors) {
   const texture=mesh.material[0].map
   if(!texture?.image)throw new Error('Smart fill needs the original photographed texture. Use Paint instead.')
   const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height
   const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(texture.image,0,0)
   textureColors=sampleFaceColors(state,texture,context.getImageData(0,0,canvas.width,canvas.height))
  }
  if(seed!==undefined) {
   const eye=mesh.worldToLocal(camera.position.clone())
   const faces=smartFillFaces(state,seed,textureColors,Number(fillTolerance.value),eye,region.value)
   if(!faces.length){error.value='No visible unlabeled region here. Try another surface or use Paint.';return}
   fills.value.push({seed,eye,faces})
  }else for(const fill of fills.value)fill.faces=smartFillFaces(state,fill.seed,textureColors,Number(fillTolerance.value),fill.eye,region.value)
  rebuildFills()
 }catch(cause){error.value=cause.message}
}
function removeFill(index) {fills.value.splice(index,1);rebuildFills()}
function clearFill() {fills.value=[];pending.clear();refresh()}
function applyFill() {
 if(busy.value || props.saving || !pending.size)return
 paintFaces(state,[...pending],region.value);clearFill()
}
function clearPart() {
 if(!ready.value || busy.value || props.saving || fills.value.length)return
 up();paintFaces(state,state.assignments.flatMap((part,id)=>part===region.value?[id]:[]),null);setMode(mode.value==='preview'?'rotate':mode.value)
}
function fullscreenChanged(){fullscreen.value=document.fullscreenElement===editor.value}
async function toggleFullscreen() {
 try{if(fullscreen.value)await document.exitFullscreen();else await editor.value.requestFullscreen()}
 catch{error.value='Fullscreen unavailable in this browser. Maximize the browser window instead.'}
}
function pointer(event) {
 const rect=renderer.domElement.getBoundingClientRect()
 cursor.value={x:event.clientX-rect.left,y:event.clientY-rect.top}
}
function down(event) {
 if(!ready.value || ['rotate','preview'].includes(mode.value) || busy.value || props.saving || event.button!==0) return
 pointer(event)
 if(mode.value==='fill') {
  const hit=pick(event.clientX,event.clientY);if(hit)suggestFill(hit.faceIndex)
  return
 }
 if(mode.value==='charm') {
  const hit=pick(event.clientX,event.clientY)
  if(hit) charm.value=mesh.worldToLocal(hit.point.clone()).toArray()
  return
 }
 renderer.domElement.setPointerCapture(event.pointerId)
 painting=true;paintPointer=event.pointerId;pending.clear();brush(event)
}
function move(event) {pointer(event);if(painting && event.pointerId===paintPointer && (event.buttons&1)) brush(event)}
function up(event) {
 if(!painting || (event && (event.pointerId!==paintPointer || (event.type==='pointerup' && event.button!==0)))) return
 painting=false;paintFaces(state,[...pending],mode.value==='erase'?null:region.value)
 pending.clear();refresh()
}
function setMode(value) {
 if(fills.value.length){error.value='Apply or clear pending fills before changing tools or parts.';return}
 up();pending.clear();mode.value=value
 if(controls)setRegionControls(controls,value)
 refresh()
}
function keydown(event) {
 if(!ready.value || !['paint','erase','fill'].includes(mode.value) || busy.value || props.saving)return
 const arrows={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]}
 if(!arrows[event.key] && event.key!==' ')return
 event.preventDefault()
 const rect=renderer.domElement.getBoundingClientRect(),at=cursor.value || {x:rect.width/2,y:rect.height/2}
 if(arrows[event.key]) {
  const [dx,dy]=arrows[event.key];cursor.value={x:Math.max(0,Math.min(rect.width,at.x+dx)),y:Math.max(0,Math.min(rect.height,at.y+dy))};return
 }
 const clientX=rect.left+at.x,clientY=rect.top+at.y
 if(mode.value==='fill'){const hit=pick(clientX,clientY);if(hit)suggestFill(hit.faceIndex)}
 else {painting=true;pending.clear();brush({clientX,clientY});up()}
}
function undo() {if(fills.value.length){removeFill(fills.value.length-1);return}if(state){up();undoStroke(state);setMode(mode.value==='preview'?'rotate':mode.value)}}
function rotate(axis) {
 if(!mesh)return
 if(fills.value.length){error.value='Apply or clear pending fills before changing model orientation.';return}
 up();const rotation=new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),Math.PI/2)
 state.geometry.applyMatrix4(rotation);mesh.geometry.applyMatrix4(rotation);overlay.geometry.applyMatrix4(rotation)
 if(charm.value) charm.value=new THREE.Vector3(...charm.value).applyMatrix4(rotation).toArray()
 setMode('rotate')
}
function crop() {
 if(fills.value.length){error.value='Apply or clear pending fills before cropping.';return}
 up();if(Number(cropMin.value)>=Number(cropMax.value)){error.value='Crop start must be below crop end.';return}
 const positions=state.geometry.getAttribute('position'),box=new THREE.Box3().setFromBufferAttribute(positions)
 const axis=cropAxis.value,low=box.min[axis],span=box.max[axis]-low
 const minimum=low+span*(Number(cropMin.value)+100)/200,maximum=low+span*(Number(cropMax.value)+100)/200
 const ids=[]
 for(let id=0;id<state.assignments.length;id++) {
  let center=0
  for(let i=0;i<3;i++) center+=positions['get'+axis.toUpperCase()](id*3+i)/3
  if(center<minimum || center>maximum) ids.push(id)
 }
 if(ids.length===state.assignments.length){error.value='Crop would remove the entire scan.';return}
 cropFaces(state,ids);cropMin.value=-100;cropMax.value=100;setMode('rotate')
}
async function previewColor(reset=false) {
 if(!state || !mesh || busy.value || fills.value.length)return
 error.value=''
 try {
  if(reset)delete previewColors[region.value]
  else previewColors[region.value]=testColor.value
  const original=mesh.material[0]
  if(!neutralMap){
   const blob=await neutralDetailTexture(original.map),url=URL.createObjectURL(blob)
   try{neutralMap=await new THREE.TextureLoader().loadAsync(url);neutralMap.flipY=false;neutralMap.colorSpace=THREE.SRGBColorSpace}finally{URL.revokeObjectURL(url)}
  }
  if(previewMesh){scene.remove(previewMesh);previewMesh.geometry.dispose();previewMesh.material.forEach(mat=>mat.dispose())}
  const {geometry,parts}=buildRegionGroups(state)
  const materials=[original.clone(),...parts.map(part=>{
   const mat=original.clone()
   if(previewColors[part.id]){mat.map=neutralMap;mat.color.set(previewColors[part.id])}
   return mat
  })]
  previewMesh=new THREE.Mesh(geometry,materials);scene.add(previewMesh);setMode('preview')
 }catch(cause){error.value=cause.message}
}
async function finish() {
 if(busy.value || props.saving)return
 if(fills.value.length){error.value='Apply or cancel the suggested fill before saving.';return}
 up();busy.value=true;error.value=''
 try {
  const payload=await exportScanRegions(mesh,state)
  mesh.visible=true;overlay.visible=false;if(previewMesh)previewMesh.visible=false
  renderer.render(scene,camera)
  payload.thumbnail=await new Promise((resolve,reject)=>renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not capture the shoe thumbnail.')),'image/png'))
  refresh()
  const point=charm.value ? mesh.localToWorld(new THREE.Vector3(...charm.value)).toArray() : null
  emit('complete',{payload,charmPoint:point})
 } catch(cause){error.value=cause.message} finally {busy.value=false;refresh()}
}
onMounted(async()=>{
 document.addEventListener('fullscreenchange',fullscreenChanged)
 try {
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#f4f5f3')
  host.value.appendChild(renderer.domElement)
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,0.001,20)
  scene.add(new THREE.HemisphereLight(0xffffff,0x777777,3))
  const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(1,2,3);scene.add(key)
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;setRegionControls(controls,mode.value)
  const loaded=await new GLTFLoader().loadAsync(props.previewUrl)
  if(disposed){loaded.scene.traverse(o=>{o.geometry?.dispose()});return}
  const meshes=[];loaded.scene.traverse(o=>{if(o.isMesh)meshes.push(o)})
  if(meshes.length!==1 || Array.isArray(meshes[0].material)) throw new Error('Prepared scan must contain one textured surface. Check local conversion.')
  mesh=meshes[0];mesh.updateWorldMatrix(true,false)
  mesh.geometry.applyMatrix4(mesh.matrixWorld);mesh.matrix.identity();mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1)
  scene.add(mesh);state=createRegionState(mesh);mesh.geometry.dispose();mesh.geometry=state.geometry.clone();mesh.material=[mesh.material]
  overlay=new THREE.Mesh(mesh.geometry.clone(),[new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0.55,polygonOffset:true,polygonOffsetFactor:-1,depthWrite:false})]);scene.add(overlay)
  const box=new THREE.Box3().setFromObject(mesh),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length()
  camera.position.copy(center).add(new THREE.Vector3(size,size*0.65,size));controls.target.copy(center)
  observer=new ResizeObserver(()=>{if(!host.value)return;renderer.setSize(host.value.clientWidth,host.value.clientHeight);camera.aspect=host.value.clientWidth/host.value.clientHeight;camera.updateProjectionMatrix()});observer.observe(host.value)
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up)
  const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)};animate()
  ready.value=true;refresh()
 } catch(cause){error.value=cause.message}
})
onBeforeUnmount(()=>{
 document.removeEventListener('fullscreenchange',fullscreenChanged)
 if(fullscreen.value)document.exitFullscreen().catch(()=>{})
 disposed=true;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose()
 scene?.traverse(o=>{o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(mat){for(const value of Object.values(mat))if(value?.isTexture)value.dispose();mat.dispose()}}})
 renderer?.dispose()
})
</script>
<template>
 <div ref="editor" class="region-editor">
  <div class="editor-heading"><strong>Edit shoe parts</strong><Button variant="outline" type="button" @click="toggleFullscreen">{{fullscreen?'Exit fullscreen':'Fullscreen editor'}}</Button></div>
  <p>Choose a part, click several areas with Smart fill, then apply together. Hold middle mouse to rotate in any tool; wheel zooms, right mouse pans. Unselected faces keep their photographed appearance.</p>
  <p v-if="error" role="alert" class="scan-error">{{error}}</p>
  <div class="region-layout">
   <div>
    <div ref="host" class="scan-canvas" :class="{'brush-active':brushActive,'fill-active':mode==='fill'}" :aria-busy="!ready" tabindex="0" aria-label="Interactive shoe region editor; arrow keys move brush or selection, Space selects" @keydown="keydown" @pointerleave="cursor=null">
     <span v-if="cursor && brushActive" class="brush-cursor" :class="{'erase-cursor':mode==='erase'}" :style="{left:cursor.x+'px',top:cursor.y+'px',width:Number(radius)*2+'px',height:Number(radius)*2+'px',borderColor:mode==='erase'?'#fff':swatches[PARTS.findIndex(p=>p.id===region)]}" aria-hidden="true"></span>
     <span v-if="cursor && mode==='fill'" class="fill-cursor" :style="{left:cursor.x+'px',top:cursor.y+'px'}" aria-hidden="true">+</span>
    </div>
    <div class="scan-toolbar">
     <Button variant="outline" v-for="tool in ['rotate','fill','paint','erase','charm']" :key="tool" type="button" :aria-pressed="mode===tool" :disabled="!ready || busy || saving" @click="setMode(tool)">{{tool==='charm'?'Place charm':tool==='fill'?'Smart fill':tool[0].toUpperCase()+tool.slice(1)}}</Button>
     <Button variant="outline" type="button" :disabled="!ready || busy || saving" @click="undo">Undo selection / stroke / crop</Button>
    </div>
    <div v-if="mode==='fill'" class="fill-tools">
     <label>Fill tolerance <input v-model="fillTolerance" type="range" min="10" max="120" :disabled="busy || saving" @input="suggestFill()">{{fillTolerance}}</label>
     <p role="status">{{fills.length?fills.length+' pending fills, '+fillCount+' unique faces. Review edges before applying.':'Click several shoe areas to collect fills for this part.'}} Already labeled parts stay protected.</p>
     <div class="scan-toolbar"><Button variant="outline" type="button" :disabled="!fillCount || busy || saving" @click="applyFill">Apply all fills</Button><Button variant="outline" type="button" :disabled="!fills.length || busy || saving" @click="clearFill();error=''">Clear pending fills</Button></div>
     <ol v-if="fills.length" class="fill-list"><li v-for="(fill,index) in fills" :key="index">Fill {{index+1}}: {{fill.faces.length}} faces <Button variant="outline" type="button" :disabled="busy || saving" :aria-label="'Remove fill '+(index+1)" @click="removeFill(index)">Remove</Button></li></ol>
     <p>Lower tolerance keeps selection tighter. Same-colored parts may merge; correct with Paint / Erase. Arrow keys move selection; Space selects.</p>
    </div>
    <label>Brush size <input v-model="radius" type="range" min="6" max="40" :disabled="busy || saving"></label>
    <p v-if="mode==='charm'">Click the shoe where charms should attach. <Button variant="outline" type="button" @click="charm=null">Disable charms</Button></p>
    <p v-if="charm">Charm position selected.</p>
    <div class="scan-toolbar">
     <label>Test {{PARTS.find(part=>part.id===region)?.label}} color <input v-model="testColor" type="color" :disabled="!ready || busy || !counts[region]" @input="previewColor()"></label>
     <Button variant="outline" type="button" :disabled="!ready || busy || saving" @click="previewColor(true)">Restore selected part</Button>
    </div>
    <details>
     <summary>Orient or crop surroundings</summary>
     <div class="scan-toolbar"><Button variant="outline" v-for="axis in ['x','y','z']" type="button" :key="axis" @click="rotate(axis)" :disabled="!ready || busy || saving">Rotate {{axis.toUpperCase()}} 90°</Button></div>
     <label>Crop axis <select v-model="cropAxis"><option>x</option><option>y</option><option>z</option></select></label>
     <label>Keep from <input v-model="cropMin" type="range" min="-100" max="99">{{cropMin}}</label>
     <label>Keep to <input v-model="cropMax" type="range" min="-99" max="100">{{cropMax}}</label>
     <Button variant="outline" type="button" :disabled="!ready || busy || saving" @click="crop">Crop outside range</Button>
    </details>
   </div>
   <div class="part-list">
    <label v-for="(part,index) in PARTS" :key="part.id" :style="{'border-left-color':swatches[index]}">
     <input v-model="region" type="radio" name="scan-part" :value="part.id" @change="setMode(mode==='fill'?'fill':'paint')" :disabled="busy || saving || fills.length>0">{{part.label}} <span>{{counts[part.id]}} faces</span>
    </label>
    <Button variant="outline" type="button" :disabled="!counts[region] || busy || saving || fills.length>0" @click="clearPart">Clear selected part</Button>
    <p>{{partCount}} customizable parts. At least two required.</p>
    <Button variant="outline" type="button" :disabled="!ready || busy || saving || fills.length>0 || partCount<2" @click="finish">{{busy?'Preparing model…':'Use these parts'}}</Button>
   </div>
  </div>
 </div>
</template>
<style scoped>
.region-editor{display:grid;gap:16px}.editor-heading{display:flex;align-items:center;justify-content:space-between;gap:16px}.region-editor:fullscreen{display:block;background:white;padding:24px;overflow:auto;color:#202220}.region-editor:fullscreen .scan-canvas{height:65dvh;min-height:360px}.region-editor:fullscreen .region-layout{margin-top:16px}.fill-list{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}.fill-list li{border:1px solid #ccc;padding:4px 8px}.fill-list button:not([data-slot]){margin-left:8px}.region-layout{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:20px}.scan-canvas{position:relative;height:440px;width:100%;overflow:hidden;border:1px solid #ccc;touch-action:none}.scan-canvas :deep(canvas){display:block}.scan-canvas.brush-active :deep(canvas){cursor:none}.scan-canvas.fill-active :deep(canvas){cursor:crosshair}.brush-cursor{position:absolute;z-index:2;pointer-events:none;box-sizing:border-box;border:2px solid;border-radius:50%;box-shadow:0 0 0 1px #202220,inset 0 0 0 1px #fff;transform:translate(-50%,-50%)}.erase-cursor{border-style:dashed}.fill-cursor{position:absolute;z-index:2;pointer-events:none;transform:translate(-50%,-50%);color:#fff;text-shadow:1px 1px #202220,-1px -1px #202220;font:24px monospace}.scan-canvas:focus-visible{outline:2px solid #b94d27;outline-offset:2px}.fill-tools p{font-size:14px}.scan-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}button:not([data-slot]),select{border:1px solid #8c918a;padding:8px 12px;background:white;color:#202220}button[aria-pressed=true]{background:#202220;color:white}button:not([data-slot]):disabled{opacity:.45;cursor:not-allowed}button:not([data-slot]):focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #b94d27;outline-offset:2px}.part-list{display:grid;align-content:start;gap:8px}.part-list label{border-left:5px solid;padding:8px;display:flex;gap:8px;align-items:center;background:#f4f5f3}.part-list span{font-size:12px;margin-left:auto}label{display:flex;gap:8px;align-items:center;margin:6px 0}.scan-error{color:#a92d17;background:#fff0eb;padding:12px}details{margin-top:16px}summary{cursor:pointer}@media(max-width:760px){.region-layout{grid-template-columns:1fr}.scan-canvas{position:relative;height:340px}.part-list{grid-template-columns:1fr 1fr}.part-list>p,.part-list>button:not([data-slot]){grid-column:1/-1}}
</style>
