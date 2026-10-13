<script setup>
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import {ref,onMounted,onBeforeUnmount,computed,watch} from 'vue'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {fitCharmPreview} from '../charm-fitting.js'
import {PARTS,CHARMS} from '../customization.js'
import {captureShoeThumbnail} from '../scan-thumbnail.js'
import RecentColors from './RecentColors.vue'
import {rememberColor} from '../color-history.js'
import {frameLatest} from '../color-input.js'
import {setRegionControls,createRegionState,restoreRegionMesh,surfaceBrushFaces,sampleFaceColors,smartFillFaces,paintFaces,cropFaces,undoStroke,redoStroke,canPaintFace,brushStrokePoints,exportScanRegions,buildRegionGroups,neutralDetailTexture} from '../scan-regions.js'
const props=defineProps({previewUrl:{type:String,required:true},saving:{type:Boolean,default:false},parts:{type:Array,default:()=>[]},charmPoint:{type:Array,default:null},charmSettings:{type:Object,default:()=>({size:1,rotation:[0,0,0]})}})
const emit=defineEmits(['complete'])
const editor=ref(null),fullscreen=ref(false),fills=ref([])
const host=ref(null),error=ref(''),ready=ref(false),busy=ref(false)
const mode=ref('rotate'),region=ref('upper'),radius=ref(16),revision=ref(0),charm=ref(props.charmPoint?[...props.charmPoint]:null),testColor=ref('#ffffff')
const charmSize=ref(props.charmSettings.size),charmRotation=ref([...props.charmSettings.rotation]),previewCharm=ref('star'),charmReady=ref(false)
const charmModels=new Map()
function updateCharms(){
 for(const [id,root] of charmModels){fitCharmPreview(root,charm.value,{size:Number(charmSize.value),rotation:charmRotation.value.map(Number)});root.visible=!!charm.value&&id===previewCharm.value}
}
watch([charm,charmSize,charmRotation,previewCharm],updateCharms,{deep:true})
const cursor=ref(null),fillTolerance=ref(40)
let previewMesh,previewParts=[],neutralMap,neutralPreparing,textureColors,paintPointer=null,lastBrush=null
const previewColors={}
const cropMin=ref(-100),cropMax=ref(100),cropAxis=ref('y')
let renderer,scene,camera,controls,mesh,overlay,state,frame,observer,disposed=false,painting=false
const pending=new Set(),raycaster=new THREE.Raycaster(),point=new THREE.Vector2()
const swatches=['#e87558','#e9c460','#809c75','#b99bd0','#7fbed0','#cc8cad','#abb9c2','#b7a176']
const lockedParts=ref([]),unassignedOnly=ref(false)
const canUndo=computed(()=>{revision.value;return fills.value.length>0 || painting || !!state?.undoStack.length})
const canRedo=computed(()=>{revision.value;return !painting && !fills.value.length && !!state?.redoStack.length})
function toggleLock(part) {
 up();state.lockedParts.has(part)?state.lockedParts.delete(part):state.lockedParts.add(part)
 lockedParts.value=[...state.lockedParts];refresh()
}
function setUnassignedOnly() {up();state.unassignedOnly=unassignedOnly.value}
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
  const target=mode.value==='erase'?null:region.value
  for(const id of [hit.faceIndex,...surfaceBrushFaces(state,center,worldRadius,eye)])if(canPaintFace(state,id,target))pending.add(id)
 }
 return !!hit
}
function stroke(event) {
 for(const sample of brushStrokePoints(lastBrush,event,Number(radius.value))) {
  lastBrush=brush(sample)?sample:null
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
 painting=true;paintPointer=event.pointerId;lastBrush=null;pending.clear();stroke(event)
}
function move(event) {pointer(event);if(painting && event.pointerId===paintPointer && (event.buttons&1)) stroke(event)}
function up(event) {
 if(!painting || (event && (event.pointerId!==paintPointer || (event.type==='pointerup' && event.button!==0)))) return
 if(event?.type==='pointerup')stroke(event)
 painting=false;lastBrush=null;paintPointer=null;paintFaces(state,[...pending],mode.value==='erase'?null:region.value)
 pending.clear();refresh()
}
function setMode(value) {
 if(fills.value.length){error.value='Apply or clear pending fills before changing tools or parts.';return}
 if(value!=='preview'){previewColorInput.cancel();if(previewMesh){scene.remove(previewMesh);previewMesh.geometry.dispose();previewMesh.material.forEach(mat=>mat.dispose());previewMesh=null}}
 up();pending.clear();mode.value=value
 if(controls)setRegionControls(controls,value)
 refresh()
}
function keydown(event) {
 if(!ready.value || busy.value || props.saving || event.target.closest('input,textarea,select,[contenteditable="true"],[role="slider"]'))return
 const key=event.key.toLowerCase()
 if((event.ctrlKey || event.metaKey) && key==='z') {event.preventDefault();event.shiftKey?redo():undo();return}
 if(event.ctrlKey || event.metaKey || event.altKey)return
 if(key==='b' || key==='e'){event.preventDefault();setMode(key==='b'?'paint':'erase');return}
 if(key==='[' || key===']'){event.preventDefault();up();radius.value=Math.max(2,Math.min(40,Number(radius.value)+(key==='['?-2:2)));return}
 if(event.target!==host.value || !['paint','erase','fill','charm'].includes(mode.value))return
 const arrows={ArrowLeft:[-8,0],ArrowRight:[8,0],ArrowUp:[0,-8],ArrowDown:[0,8]}
 if(!arrows[event.key] && event.key!==' ')return
 event.preventDefault()
 const rect=renderer.domElement.getBoundingClientRect(),at=cursor.value || {x:rect.width/2,y:rect.height/2}
 if(arrows[event.key]) {
  const [dx,dy]=arrows[event.key];cursor.value={x:Math.max(0,Math.min(rect.width,at.x+dx)),y:Math.max(0,Math.min(rect.height,at.y+dy))};return
 }
 const clientX=rect.left+at.x,clientY=rect.top+at.y
 if(mode.value==='charm'){const hit=pick(clientX,clientY);if(hit)charm.value=mesh.worldToLocal(hit.point.clone()).toArray()}
 else if(mode.value==='fill'){const hit=pick(clientX,clientY);if(hit)suggestFill(hit.faceIndex)}
 else {painting=true;lastBrush=null;pending.clear();stroke({clientX,clientY});up()}
}
function undo() {if(!ready.value || busy.value || props.saving)return;if(fills.value.length){removeFill(fills.value.length-1);return}if(state){up();undoStroke(state);setMode(mode.value==='preview'?'rotate':mode.value)}}
function redo() {if(!ready.value || busy.value || props.saving || fills.value.length)return;up();redoStroke(state);setMode(mode.value==='preview'?'rotate':mode.value)}
function rotate(axis) {
 if(!mesh)return
 if(fills.value.length){error.value='Apply or clear pending fills before changing model orientation.';return}
 up();const rotation=new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),Math.PI/2)
 state.geometry.applyMatrix4(rotation);mesh.geometry.applyMatrix4(rotation);overlay.geometry.applyMatrix4(rotation)
 if(charm.value){
  charm.value=new THREE.Vector3(...charm.value).applyMatrix4(rotation).toArray()
  const fit=new THREE.Quaternion().setFromEuler(new THREE.Euler(...charmRotation.value.map(THREE.MathUtils.degToRad))).premultiply(new THREE.Quaternion().setFromRotationMatrix(rotation))
  const angles=new THREE.Euler().setFromQuaternion(fit);charmRotation.value=[angles.x,angles.y,angles.z].map(THREE.MathUtils.radToDeg)
 }
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
const previewColorInput=frameLatest(({part,color})=>{void previewColor(false,part,color)})
function reuseColor(color){testColor.value=color;previewColorInput.cancel();void previewColor(false,region.value,color)}
async function previewColor(reset=false,part=region.value,color=testColor.value) {
 if(!state || !mesh || busy.value || fills.value.length)return
 error.value=''
 try {
  if(reset)delete previewColors[part]
  else previewColors[part]=color
  const original=mesh.material[0]
  if(!neutralMap){
   if(!neutralPreparing)neutralPreparing=(async()=>{
    const blob=await neutralDetailTexture(original.map),url=URL.createObjectURL(blob)
    try{const texture=await new THREE.TextureLoader().loadAsync(url);texture.flipY=false;texture.colorSpace=THREE.SRGBColorSpace;return texture}finally{URL.revokeObjectURL(url)}
   })()
   try{neutralMap=await neutralPreparing}catch(cause){neutralPreparing=null;throw cause}
  }
  if(disposed){neutralMap.dispose();neutralMap=null;return}
  if(!previewMesh){
   const {geometry,parts}=buildRegionGroups(state);previewParts=parts
   previewMesh=new THREE.Mesh(geometry,[original.clone(),...parts.map(()=>original.clone())]);scene.add(previewMesh)
  }
  previewParts.forEach((item,index)=>{
   const material=previewMesh.material[index+1],hex=previewColors[item.id],map=hex?neutralMap:original.map
   if(material.map!==map){material.map=map;material.needsUpdate=true}
   if(hex)material.color.set(hex);else material.color.copy(original.color)
  })
  if(mode.value!=='preview')setMode('preview')
 }catch(cause){error.value=cause.message}
}
async function finish() {
 if(busy.value || props.saving)return
 if(fills.value.length){error.value='Apply or cancel the suggested fill before saving.';return}
 up();busy.value=true;error.value=''
 try {
  if(charm.value&&!charmReady.value)throw new Error('Wait for the local charm preview to load before saving.')
  const payload=await exportScanRegions(mesh,state)
  const {geometry}=buildRegionGroups(state)
  try {payload.thumbnail=await captureShoeThumbnail(new THREE.Mesh(geometry,mesh.material[0]))}
  finally {geometry.dispose()}
  const point=charm.value ? mesh.localToWorld(new THREE.Vector3(...charm.value)).toArray() : null
  emit('complete',{payload,charmPoint:point,charmSettings:{size:Number(charmSize.value),rotation:charmRotation.value.map(Number)}})
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
  if(props.parts.length){const restored=restoreRegionMesh(loaded.scene,props.parts);mesh=restored.mesh;state=restored.state}
  else {
   const meshes=[];loaded.scene.traverse(o=>{if(o.isMesh)meshes.push(o)})
   if(meshes.length!==1 || Array.isArray(meshes[0].material))throw new Error('Prepared scan must contain one textured surface. Check local conversion.')
   mesh=meshes[0];mesh.updateWorldMatrix(true,false)
   mesh.geometry.applyMatrix4(mesh.matrixWorld);mesh.matrix.identity();mesh.position.set(0,0,0);mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1)
   state=createRegionState(mesh)
  }
  scene.add(mesh);mesh.geometry.dispose();mesh.geometry=state.geometry.clone();mesh.material=[mesh.material]
  overlay=new THREE.Mesh(mesh.geometry.clone(),[new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0.55,polygonOffset:true,polygonOffsetFactor:-1,depthWrite:false})]);scene.add(overlay)
  const box=new THREE.Box3().setFromObject(mesh),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).length()
  camera.position.copy(center).add(new THREE.Vector3(size,size*0.65,size));controls.target.copy(center)
  observer=new ResizeObserver(()=>{if(!host.value)return;renderer.setSize(host.value.clientWidth,host.value.clientHeight);camera.aspect=host.value.clientWidth/host.value.clientHeight;camera.updateProjectionMatrix()});observer.observe(host.value)
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);renderer.domElement.addEventListener('lostpointercapture',up)
  const animate=()=>{frame=requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)};animate()
  ready.value=true;refresh()
  for(const item of CHARMS.filter(charm=>charm.src)){
   const loadedCharm=await new GLTFLoader().loadAsync(item.src)
   if(disposed){loadedCharm.scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});return}
   const root=loadedCharm.scene.getObjectByName('CharmRoot');if(!root)throw new Error('Local charm attachment missing.')
   scene.add(loadedCharm.scene);charmModels.set(item.id,root);updateCharms()
  }
  charmReady.value=true
 } catch(cause){error.value=cause.message}
})
onBeforeUnmount(()=>{
 previewColorInput.cancel()
 document.removeEventListener('fullscreenchange',fullscreenChanged)
 if(fullscreen.value)document.exitFullscreen().catch(()=>{})
 disposed=true;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose()
 scene?.traverse(o=>{o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(mat){for(const value of Object.values(mat))if(value?.isTexture)value.dispose();mat.dispose()}}})
 renderer?.dispose()
})
</script>
<template>
 <div ref="editor" class="region-editor" @keydown="keydown">
  <div class="editor-heading"><div><h3>Edit shoe parts</h3><p>Select a part, then mark the shoe with Smart fill or Paint.</p></div><Button variant="outline" type="button" @click="toggleFullscreen">{{fullscreen?'Exit fullscreen':'Fullscreen editor'}}</Button></div>
  <div class="scan-toolbar" role="group" aria-label="Painting tools">
   <Button variant="outline" v-for="tool in ['rotate','fill','paint','erase','charm']" :key="tool" type="button" :aria-pressed="mode===tool" :disabled="!ready || busy || saving || fills.length>0" @click="setMode(tool)">{{tool==='charm'?'Place charm':tool==='fill'?'Smart fill':tool[0].toUpperCase()+tool.slice(1)}}</Button>
   <Button variant="ghost" type="button" :disabled="!ready || busy || saving || !canUndo" @click="undo">Undo selection / stroke / crop</Button>
   <Button variant="ghost" type="button" :disabled="!ready || busy || saving || !canRedo" @click="redo">Redo stroke / crop</Button>
  </div>
  <div class="region-layout">
   <div class="canvas-column">
    <div ref="host" class="scan-canvas" @mousedown.middle.prevent @auxclick.middle.prevent :class="{'brush-active':brushActive,'fill-active':['fill','charm'].includes(mode)}" :aria-busy="!ready" tabindex="0" aria-label="Interactive shoe region editor; arrow keys move brush or selection, Space selects" @pointerleave="cursor=null">
     <span v-if="cursor && brushActive" class="brush-cursor" :class="{'erase-cursor':mode==='erase'}" :style="{left:cursor.x+'px',top:cursor.y+'px',width:Number(radius)*2+'px',height:Number(radius)*2+'px',borderColor:mode==='erase'?'#fff':swatches[PARTS.findIndex(p=>p.id===region)]}" aria-hidden="true"></span>
     <span v-if="cursor && ['fill','charm'].includes(mode)" class="fill-cursor" :style="{left:cursor.x+'px',top:cursor.y+'px'}" aria-hidden="true">+</span>
     <p v-if="error" role="alert" class="scan-error">{{error}}</p>
     <span v-if="!ready&&!error" class="canvas-status" role="status">Loading shoe…</span>
    </div>
    <p class="canvas-help">Middle drag to rotate · Scroll to zoom · Right drag to pan. Focus canvas, use arrow keys, then Space to paint or select. B: paint · E: erase · [ / ]: brush size · Ctrl/Cmd+Z: undo · Ctrl/Cmd+Shift+Z: redo.</p>
   </div>
   <aside class="region-inspector" aria-label="Part and tool settings">
    <div v-if="mode!=='charm'" class="inspector-section">
     <div class="section-heading"><h4>Shoe parts</h4><span>{{partCount}} / {{PARTS.length}} marked</span></div>
     <div class="part-list">
      <div v-for="(part,index) in PARTS" :key="part.id" class="part-row"><label :class="{selected:region===part.id}">
       <input v-model="region" type="radio" name="scan-part" :value="part.id" @change="setMode(mode==='fill'?'fill':'paint')" :disabled="!ready || busy || saving || fills.length>0">
       <i class="part-swatch" :style="{background:swatches[index]}" aria-hidden="true"></i>{{part.label}}<span>{{counts[part.id]}} faces</span>
      </label><Button variant="ghost" size="sm" type="button" :aria-label="(lockedParts.includes(part.id)?'Unlock ':'Lock ')+part.label" :aria-pressed="lockedParts.includes(part.id)" :disabled="!ready || busy || saving || fills.length>0" @click="toggleLock(part.id)">{{lockedParts.includes(part.id)?'Unlock':'Lock'}}</Button></div>
     </div>
     <label class="unassigned-option"><input v-model="unassignedOnly" type="checkbox" :disabled="!ready || busy || saving || fills.length>0" @change="setUnassignedOnly"> Paint unassigned faces only</label>
     <p>Locks protect parts from painting, erasing, clearing and cropping. Undo and redo restore earlier edits.</p>
     <Button variant="ghost" size="sm" type="button" :disabled="!counts[region] || busy || saving || fills.length>0 || lockedParts.includes(region) || unassignedOnly" @click="clearPart">Clear selected part</Button>
    </div>
    <div v-if="mode==='fill'" class="inspector-section fill-tools">
     <div class="section-heading"><label id="fill-tolerance-label">Fill tolerance</label><output>{{fillTolerance}}</output></div>
     <Slider aria-labelledby="fill-tolerance-label" :model-value="[Number(fillTolerance)]" :min="10" :max="120" :disabled="!ready || busy || saving" @update:model-value="fillTolerance=$event[0];suggestFill()" />
     <p role="status">{{fills.length?fills.length+' pending fills, '+fillCount+' unique faces. Review edges before applying.':'Click several shoe areas to collect fills for this part.'}} Already labeled parts stay protected.</p>
     <div class="inspector-actions"><Button type="button" :disabled="!fillCount || busy || saving" @click="applyFill">Apply all fills</Button><Button variant="outline" type="button" :disabled="!fills.length || busy || saving" @click="clearFill();error=''">Clear pending fills</Button></div>
     <ol v-if="fills.length" class="fill-list"><li v-for="(fill,index) in fills" :key="index"><span>Fill {{index+1}} · {{fill.faces.length}} faces</span><Button variant="ghost" size="sm" type="button" :disabled="busy || saving" :aria-label="'Remove fill '+(index+1)" @click="removeFill(index)">Remove</Button></li></ol>
     <p>Lower tolerance selects tighter areas. Correct similar-colored parts with Paint / Erase.</p>
    </div>
    <div v-if="mode==='paint'||mode==='erase'" class="inspector-section">
     <div class="section-heading"><label id="brush-radius-label">Brush radius</label><output>{{radius}} px</output></div>
     <Slider aria-labelledby="brush-radius-label" :model-value="[Number(radius)]" :min="2" :max="40" :disabled="!ready || busy || saving" @update:model-value="radius=$event[0]" />
    </div>
    <div v-if="mode==='charm'" class="inspector-section charm-controls">
     <h4>Charm attachment</h4><p>Click the shoe to attach. Rotate the view to check all sides. Customers use this saved fit.</p>
     <p role="status">{{charm?(charmReady?'Charm position selected.':'Loading local charms…'):'No attachment point selected.'}}</p>
     <label>Preview charm<select v-model="previewCharm" :disabled="!charmReady || busy || saving"><option v-for="item in CHARMS.filter(c=>c.src)" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
     <div><label id="charm-size-label">Size · {{Math.round(charmSize*100)}}%</label><Slider aria-labelledby="charm-size-label" :model-value="[Math.round(charmSize*100)]" :min="20" :max="300" :step="5" :disabled="!charm || !charmReady || busy || saving" @update:model-value="charmSize=$event[0]/100" /></div>
     <div v-for="(axis,index) in ['X','Y','Z']" :key="axis"><label :id="'charm-rotation-'+axis">Rotate {{axis}} · {{Math.round(charmRotation[index])}}°</label><Slider :aria-labelledby="'charm-rotation-'+axis" :model-value="[charmRotation[index]]" :min="-180" :max="180" :step="5" :disabled="!charm || !charmReady || busy || saving" @update:model-value="charmRotation[index]=$event[0]" /></div>
     <Button variant="outline" type="button" :disabled="!charm || busy || saving" @click="charmSize=1;charmRotation=[0,0,0]">Reset size and rotation</Button>
     <Button variant="outline" type="button" :disabled="!charm || busy || saving" @click="charm=null">Disable charms</Button>
    </div>
    <div v-if="mode!=='charm'" class="inspector-section">
     <label class="test-color">Test {{PARTS.find(part=>part.id===region)?.label}} color<input v-model="testColor" type="color" :disabled="!ready || busy || saving || fills.length>0 || !counts[region]" @input="previewColorInput({part:region,color:testColor})" @change="previewColorInput.flush();rememberColor(testColor)"></label>
     <RecentColors :disabled="!ready || busy || saving || fills.length>0 || !counts[region]" @select="reuseColor" />
     <Button variant="outline" size="sm" type="button" :disabled="!ready || busy || saving || fills.length>0 || !counts[region]" @click="previewColor(true)">Restore selected part</Button>
     <p>Unselected faces keep their photographed appearance.</p>
    </div>
    <details class="inspector-section">
     <summary>Orient or crop surroundings</summary>
     <div class="crop-settings">
      <div class="inspector-actions"><Button variant="outline" size="sm" v-for="axis in ['x','y','z']" type="button" :key="axis" @click="rotate(axis)" :disabled="!ready || busy || saving || fills.length>0">Rotate {{axis.toUpperCase()}} 90°</Button></div>
      <label>Crop axis<select v-model="cropAxis" :disabled="!ready||busy||saving||fills.length>0"><option>x</option><option>y</option><option>z</option></select></label>
      <div class="section-heading"><label id="crop-start-label">Keep from</label><output>{{cropMin}}</output></div>
      <Slider aria-labelledby="crop-start-label" :model-value="[Number(cropMin)]" :min="-100" :max="99" :disabled="!ready||busy||saving||fills.length>0" @update:model-value="cropMin=$event[0]" />
      <div class="section-heading"><label id="crop-end-label">Keep to</label><output>{{cropMax}}</output></div>
      <Slider aria-labelledby="crop-end-label" :model-value="[Number(cropMax)]" :min="-99" :max="100" :disabled="!ready||busy||saving||fills.length>0" @update:model-value="cropMax=$event[0]" />
      <Button variant="outline" type="button" :disabled="!ready || busy || saving || fills.length>0" @click="crop">Crop outside range</Button>
     </div>
    </details>
   </aside>
  </div>
  <div class="region-savebar"><p>{{partCount}} customizable parts. At least two required.<span v-if="fills.length"> Apply or clear pending fills before saving.</span></p><Button type="button" :disabled="!ready || busy || saving || fills.length>0 || partCount<2" @click="finish">{{busy?'Preparing model…':saving?'Saving model…':'Use these parts'}}</Button></div>
 </div>
</template>
<style scoped>
.region-editor { --primary:#292b2d; --primary-foreground:#fff; display:grid; gap:16px; min-width:0; }
.editor-heading,.section-heading,.region-savebar { display:flex; align-items:center; justify-content:space-between; gap:16px; }
.editor-heading h3 { font-size:18px; font-weight:600; }
.editor-heading p,.canvas-help,.region-savebar p,.region-inspector p { color:var(--muted-foreground); font-size:13px; line-height:1.5; }
.region-layout { display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:20px; align-items:start; }
.canvas-column { min-width:0; display:grid; gap:8px; }
.scan-canvas { position:relative; height:var(--painting-height,clamp(280px,calc(100dvh - 470px),620px)); width:100%; overflow:hidden; border:1px solid var(--border); border-radius:6px; touch-action:none; background:#f4f5f3; }
.scan-canvas :deep(canvas) { display:block; }
.scan-canvas.brush-active :deep(canvas) { cursor:none; }
.scan-canvas.fill-active :deep(canvas) { cursor:crosshair; }
.canvas-status { position:absolute; inset:0; display:grid; place-items:center; pointer-events:none; font-size:14px; }
.brush-cursor { position:absolute; z-index:2; pointer-events:none; box-sizing:border-box; border:2px solid; border-radius:50%; box-shadow:0 0 0 1px #202220,inset 0 0 0 1px #fff; transform:translate(-50%,-50%); }
.erase-cursor { border-style:dashed; }
.fill-cursor { position:absolute; z-index:2; pointer-events:none; transform:translate(-50%,-50%); color:#fff; text-shadow:1px 1px #202220,-1px -1px #202220; font:24px monospace; }
.scan-canvas:focus-visible { outline:2px solid var(--ring); outline-offset:2px; }
.scan-toolbar,.inspector-actions { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
.scan-toolbar button[aria-pressed=true] { background:var(--primary); border-color:var(--primary); color:var(--primary-foreground); }
.scan-toolbar button:last-child { margin-left:auto; }
.region-inspector { border:1px solid var(--border); border-radius:6px; max-height:var(--painting-height,clamp(280px,calc(100dvh - 470px),620px)); overflow:auto; }
.inspector-section { padding:14px; display:grid; gap:12px; border-bottom:1px solid var(--border); }
.inspector-section:last-child { border-bottom:0; }
.section-heading h4 { font-size:14px; font-weight:600; }
.section-heading span,.section-heading output { font-size:12px; color:var(--muted-foreground); white-space:nowrap; }
.part-row { display:flex; align-items:center; gap:4px; }
.part-row label { flex:1; min-width:0; }
.unassigned-option { display:flex; align-items:center; gap:8px; font-size:13px; }
.part-list { display:grid; gap:2px; }
.part-list label { display:flex; align-items:center; gap:8px; padding:7px 6px; border-radius:4px; font-size:13px; font-weight:400; cursor:pointer; }
.part-list label.selected { background:var(--muted); font-weight:600; }
.part-list label:has(input:disabled) { cursor:default; }
.part-list input { accent-color:var(--primary); }
.part-swatch { width:10px; height:10px; border-radius:2px; flex-shrink:0; }
.part-list span { font-size:11px; font-weight:400; color:var(--muted-foreground); margin-left:auto; }
.charm-controls select { width:100%; border:1px solid var(--input); border-radius:6px; padding:6px; background:var(--card); }
.charm-controls label { font-size:13px; }
.test-color { display:flex; align-items:center; justify-content:space-between; }
input[type=color] { width:36px; height:30px; padding:2px; border:1px solid var(--input); border-radius:4px; }
.fill-list { max-height:132px; overflow:auto; list-style:none; padding:0; display:grid; gap:4px; font-size:12px; }
.fill-list li { display:flex; justify-content:space-between; align-items:center; gap:8px; }
.region-inspector summary { cursor:pointer; font-size:13px; font-weight:600; }
.crop-settings { display:grid; gap:12px; margin-top:16px; }
.crop-settings select { border:1px solid var(--input); border-radius:6px; padding:6px; background:var(--card); }
.region-savebar { padding-top:12px; border-top:1px solid var(--border); }
.scan-error { position:absolute; left:12px; right:12px; bottom:12px; z-index:3; margin:0; pointer-events:none; color:var(--destructive); background:#fff0eb; border-radius:6px; padding:12px; font-size:14px; }
.region-editor:fullscreen { background:var(--card); padding:24px; overflow:auto; color:var(--foreground); align-content:start; }
.region-editor:fullscreen .scan-canvas,.region-editor:fullscreen .region-inspector { height:calc(100dvh - 235px); max-height:none; min-height:360px; }
@media(max-width:900px) { .region-layout { grid-template-columns:minmax(0,1fr); } .region-inspector { max-height:none; } .scan-toolbar button:last-child { margin-left:0; } .region-savebar { flex-wrap:wrap; } }
</style>
