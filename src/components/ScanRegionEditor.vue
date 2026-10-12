<script setup>
import {ref,onMounted,onBeforeUnmount,computed} from 'vue'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {PARTS} from '../customization.js'
import {createRegionState,paintFaces,cropFaces,undoStroke,exportScanRegions,buildRegionGroups,neutralDetailTexture} from '../scan-regions.js'
const props=defineProps({previewUrl:{type:String,required:true},saving:{type:Boolean,default:false}})
const emit=defineEmits(['complete'])
const host=ref(null),error=ref(''),ready=ref(false),busy=ref(false)
const mode=ref('rotate'),region=ref('upper'),radius=ref(16),revision=ref(0),charm=ref(null),testColor=ref('#ffffff')
let previewMesh,neutralMap
const previewColors={}
const cropMin=ref(-100),cropMax=ref(100),cropAxis=ref('y')
let renderer,scene,camera,controls,mesh,overlay,state,frame,observer,disposed=false,painting=false
const pending=new Set(),raycaster=new THREE.Raycaster(),point=new THREE.Vector2()
const swatches=['#e87558','#e9c460','#809c75','#b99bd0','#7fbed0','#cc8cad','#abb9c2','#b7a176']
const counts=computed(()=>{revision.value;return Object.fromEntries(PARTS.map(part=>[part.id,state?.assignments.filter(id=>id===part.id).length || 0]))})
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
 overlay.visible=['paint','erase'].includes(mode.value)
 revision.value++
}
function pick(clientX,clientY) {
 const rect=renderer.domElement.getBoundingClientRect()
 point.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1)
 raycaster.setFromCamera(point,camera)
 return raycaster.intersectObject(mesh,false).find(hit=>state.assignments[hit.faceIndex]!=='removed')
}
function brush(event) {
 const r=Number(radius.value)
 for(let x=-r;x<=r;x+=Math.max(4,r/3)) for(let y=-r;y<=r;y+=Math.max(4,r/3)) if(x*x+y*y<=r*r) {
  const hit=pick(event.clientX+x,event.clientY+y)
  if(hit) pending.add(hit.faceIndex)
 }
 refresh()
}
function down(event) {
 if(!ready.value || ['rotate','preview'].includes(mode.value) || busy.value || props.saving || event.button!==0) return
 renderer.domElement.setPointerCapture(event.pointerId)
 if(mode.value==='charm') {
  const hit=pick(event.clientX,event.clientY)
  if(hit) charm.value=mesh.worldToLocal(hit.point.clone()).toArray()
  return
 }
 painting=true;pending.clear();brush(event)
}
function move(event) {if(painting) brush(event)}
function up() {
 if(!painting) return
 painting=false;paintFaces(state,[...pending],mode.value==='erase'?null:region.value)
 pending.clear();refresh()
}
function setMode(value) {up();mode.value=value;if(controls) controls.enabled=['rotate','preview'].includes(value);refresh()}
function undo() {if(state){undoStroke(state);setMode('rotate')}}
function rotate(axis) {
 if(!mesh)return
 up();const rotation=new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0),Math.PI/2)
 state.geometry.applyMatrix4(rotation);mesh.geometry.applyMatrix4(rotation);overlay.geometry.applyMatrix4(rotation)
 if(charm.value) charm.value=new THREE.Vector3(...charm.value).applyMatrix4(rotation).toArray()
 setMode('rotate')
}
function crop() {
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
 if(!state || !mesh || busy.value)return
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
 try {
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#f4f5f3')
  host.value.appendChild(renderer.domElement)
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(40,1,0.001,20)
  scene.add(new THREE.HemisphereLight(0xffffff,0x777777,3))
  const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(1,2,3);scene.add(key)
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true
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
 disposed=true;cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose()
 scene?.traverse(o=>{o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(mat){for(const value of Object.values(mat))if(value?.isTexture)value.dispose();mat.dispose()}}})
 renderer?.dispose()
})
</script>
<template>
 <div class="region-editor">
  <p>Choose a part, paint its visible surface, then rotate to paint the other side. Unpainted faces keep their photographed appearance.</p>
  <p v-if="error" role="alert" class="scan-error">{{error}}</p>
  <div class="region-layout">
   <div>
    <div ref="host" class="scan-canvas" :aria-busy="!ready" aria-label="Interactive shoe region editor"></div>
    <div class="scan-toolbar">
     <button v-for="tool in ['rotate','paint','erase','charm']" :key="tool" type="button" :aria-pressed="mode===tool" :disabled="!ready || busy" @click="setMode(tool)">{{tool==='charm'?'Place charm':tool[0].toUpperCase()+tool.slice(1)}}</button>
     <button type="button" :disabled="!ready || busy" @click="undo">Undo stroke / crop</button>
    </div>
    <label>Brush size <input v-model="radius" type="range" min="6" max="40" :disabled="busy"></label>
    <p v-if="mode==='charm'">Click the shoe where charms should attach. <button type="button" @click="charm=null">Disable charms</button></p>
    <p v-if="charm">Charm position selected.</p>
    <div class="scan-toolbar">
     <label>Test {{PARTS.find(part=>part.id===region)?.label}} color <input v-model="testColor" type="color" :disabled="!ready || busy || !counts[region]" @input="previewColor()"></label>
     <button type="button" :disabled="!ready || busy" @click="previewColor(true)">Restore selected part</button>
    </div>
    <details>
     <summary>Orient or crop surroundings</summary>
     <div class="scan-toolbar"><button v-for="axis in ['x','y','z']" type="button" :key="axis" @click="rotate(axis)" :disabled="!ready || busy">Rotate {{axis.toUpperCase()}} 90°</button></div>
     <label>Crop axis <select v-model="cropAxis"><option>x</option><option>y</option><option>z</option></select></label>
     <label>Keep from <input v-model="cropMin" type="range" min="-100" max="99">{{cropMin}}</label>
     <label>Keep to <input v-model="cropMax" type="range" min="-99" max="100">{{cropMax}}</label>
     <button type="button" :disabled="!ready || busy" @click="crop">Crop outside range</button>
    </details>
   </div>
   <div class="part-list">
    <label v-for="(part,index) in PARTS" :key="part.id" :style="{'border-left-color':swatches[index]}">
     <input v-model="region" type="radio" name="scan-part" :value="part.id" @change="setMode('paint')" :disabled="busy">{{part.label}} <span>{{counts[part.id]}} faces</span>
    </label>
    <p>{{partCount}} customizable parts. At least two required.</p>
    <button type="button" :disabled="!ready || busy || partCount<2" @click="finish">{{busy?'Preparing model…':'Use these parts'}}</button>
   </div>
  </div>
 </div>
</template>
<style scoped>
.region-editor{display:grid;gap:16px}.region-layout{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:20px}.scan-canvas{height:440px;width:100%;overflow:hidden;border:1px solid #ccc;touch-action:none}.scan-canvas :deep(canvas){display:block}.scan-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}button,select{border:1px solid #8c918a;padding:8px 12px;background:white;color:#202220}button[aria-pressed=true]{background:#202220;color:white}button:disabled{opacity:.45;cursor:not-allowed}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #b94d27;outline-offset:2px}.part-list{display:grid;align-content:start;gap:8px}.part-list label{border-left:5px solid;padding:8px;display:flex;gap:8px;align-items:center;background:#f4f5f3}.part-list span{font-size:12px;margin-left:auto}label{display:flex;gap:8px;align-items:center;margin:6px 0}.scan-error{color:#a92d17;background:#fff0eb;padding:12px}details{margin-top:16px}summary{cursor:pointer}@media(max-width:760px){.region-layout{grid-template-columns:1fr}.scan-canvas{height:340px}.part-list{grid-template-columns:1fr 1fr}.part-list>p,.part-list>button{grid-column:1/-1}}
</style>

