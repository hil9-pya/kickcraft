import {BufferGeometry,BufferAttribute,Mesh,Scene,Vector2,Vector3,Triangle,Ray,Sphere,MOUSE} from 'three'
import {Octree} from 'three/addons/math/Octree.js'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {PARTS} from './customization.js'

export function setRegionControls(controls,tool) {
 controls.mouseButtons={LEFT:['rotate','preview'].includes(tool)?MOUSE.ROTATE:null,MIDDLE:MOUSE.ROTATE,RIGHT:MOUSE.PAN}
}

export function createRegionState(mesh) {
 const geometry=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
 const count=geometry.getAttribute('position')?.count
 if (!count || count%3 || count/3>50000) throw new Error('Scan must contain at most 50,000 triangles.')
 if (!geometry.getAttribute('uv') || !geometry.getAttribute('normal')) throw new Error('Scan needs texture coordinates and normals.')
 return {geometry,assignments:Array(count/3).fill(null),undoStack:[],redoStack:[],lockedParts:new Set(),unassignedOnly:false}
}
function surfaceData(state) {
 const positions=state.geometry.getAttribute('position')
 if (!state.brushSurface || state.brushSurface.version!==positions.version) {
  const octree=new Octree(),triangles=[],byTriangle=new Map(),byId=new Map(),edges=new Map(),neighbors=new Map()
  state.geometry.computeBoundingBox()
  const scale=Math.max(1e-9,state.geometry.boundingBox.getSize(new Vector3()).length()*1e-6)
  for(let id=0;id<state.assignments.length;id++) {
   if(state.assignments[id]==='removed')continue
   const vertices=[0,1,2].map(vertex=>new Vector3().fromBufferAttribute(positions,id*3+vertex))
   const triangle=new Triangle(...vertices),center=triangle.getMidpoint(new Vector3()),normal=triangle.getNormal(new Vector3())
   const face={id,triangle,center,normal};triangles.push(face);byTriangle.set(triangle,face);byId.set(id,face);neighbors.set(id,new Set());octree.addTriangle(triangle)
   const keys=vertices.map(vertex=>vertex.toArray().map(value=>Math.round(value/scale)).join(','))
   for(let edge=0;edge<3;edge++) {
    const key=[keys[edge],keys[(edge+1)%3]].sort().join('|'),linked=edges.get(key) || []
    for(const other of linked){neighbors.get(id).add(other);neighbors.get(other).add(id)}
    linked.push(id);edges.set(key,linked)
   }
  }
  octree.build();state.brushSurface={version:positions.version,triangles,byTriangle,byId,neighbors,octree}
 }
 return state.brushSurface
}
export function surfaceBrushFaces(state,point,radius,cameraPosition) {
 if (!Number.isFinite(radius) || radius<=0) throw new Error('Invalid brush radius.')
 const surface=surfaceData(state),faces=[],ray=new Ray(cameraPosition,new Vector3()),candidates=[]
 surface.octree.getSphereTriangles(new Sphere(point,radius),candidates)
 for(const triangle of candidates) {
  const {id,center}=surface.byTriangle.get(triangle)
  if(center.distanceToSquared(point)>radius*radius)continue
  ray.direction.copy(center).sub(cameraPosition).normalize()
  if(surface.octree.rayIntersect(ray)?.triangle===triangle)faces.push(id)
 }
 return faces
}
export function sampleFaceColors(state,texture,pixels) {
 const uv=state.geometry.getAttribute('uv'),colors=new Float32Array(state.assignments.length*3),point=new Vector2()
 texture.updateMatrix()
 for(let id=0;id<state.assignments.length;id++) {
  for(const weights of [[1/3,1/3,1/3],[0.6,0.2,0.2],[0.2,0.6,0.2],[0.2,0.2,0.6]]) {
   point.set(0,0)
   for(let v=0;v<3;v++){point.x+=uv.getX(id*3+v)*weights[v];point.y+=uv.getY(id*3+v)*weights[v]}
   texture.transformUv(point)
   const x=Math.max(0,Math.min(pixels.width-1,Math.floor(point.x*pixels.width))),y=Math.max(0,Math.min(pixels.height-1,Math.floor(point.y*pixels.height)))
   for(let channel=0;channel<3;channel++)colors[id*3+channel]+=pixels.data[(y*pixels.width+x)*4+channel]/4
  }
 }
 return colors
}
export function smartFillFaces(state,seed,colors,tolerance,cameraPosition,regionId) {
 if(!Number.isInteger(seed) || seed<0 || seed>=state.assignments.length)throw new Error('Invalid face.')
 if(!Number.isFinite(tolerance) || tolerance<0 || tolerance>255)throw new Error('Invalid fill tolerance.')
 if(colors.length!==state.assignments.length*3)throw new Error('Missing surface colors.')
 if(!PARTS.some(part=>part.id===regionId))throw new Error('Unknown shoe part.')
 const surface=surfaceData(state),queue=[seed],seen=new Set([seed]),faces=[],ray=new Ray(cameraPosition,new Vector3())
 const accepts=id=>{
  const face=surface.byId.get(id),assigned=state.assignments[id]
  if(!face || !canPaintFace(state,id,regionId) || (assigned!==null && assigned!==regionId))return false
  let distance=0
  for(let channel=0;channel<3;channel++)distance+=(colors[id*3+channel]-colors[seed*3+channel])**2
  if(distance>tolerance*tolerance)return false
  ray.direction.copy(face.center).sub(cameraPosition).normalize()
  return surface.octree.rayIntersect(ray)?.triangle===face.triangle
 }
 // shortcut: color and surface continuity suggest visible regions, not semantic shoe parts; use local AI when diverse captures justify it.
 if(!accepts(seed))return faces
 for(let index=0;index<queue.length;index++) {
  const id=queue[index];faces.push(id)
  for(const next of surface.neighbors.get(id)) {
   if(seen.has(next) || surface.byId.get(id).normal.dot(surface.byId.get(next).normal)<Math.SQRT1_2)continue
   seen.add(next);if(accepts(next))queue.push(next)
  }
 }
 return faces
}
export function brushStrokePoints(previous,current,radius) {
 if(!previous)return [{clientX:current.clientX,clientY:current.clientY}]
 const dx=current.clientX-previous.clientX,dy=current.clientY-previous.clientY
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/Math.max(1,radius/2)))
 return Array.from({length:steps},(_,index)=>({clientX:previous.clientX+dx*(index+1)/steps,clientY:previous.clientY+dy*(index+1)/steps}))
}
export function canPaintFace(state,id,regionId) {
 const assigned=state.assignments[id]
 return assigned!=='removed' && !state.lockedParts.has(assigned) && !state.lockedParts.has(regionId) && (!state.unassignedOnly || assigned===null)
}
export function paintFaces(state,faceIds,regionId) {
 if (regionId!==null && !PARTS.some(part=>part.id===regionId)) throw new Error('Unknown shoe part.')
 const ids=[...new Set(faceIds)]
 if (ids.some(id=>!Number.isInteger(id) || id<0 || id>=state.assignments.length)) throw new Error('Invalid face.')
 const changes=ids.filter(id=>canPaintFace(state,id,regionId) && state.assignments[id]!==regionId).map(id=>[id,state.assignments[id]])
 if (!changes.length) return
 state.undoStack.push(changes);state.redoStack=[]
 for (const [id] of changes) state.assignments[id]=regionId
}
export function cropFaces(state,ids) {
 if (ids.some(id=>!Number.isInteger(id) || id<0 || id>=state.assignments.length)) throw new Error('Invalid crop face.')
 const changes=ids.filter(id=>state.assignments[id]!=='removed' && !state.lockedParts.has(state.assignments[id])).map(id=>[id,state.assignments[id]])
 if (changes.length) {state.undoStack.push(changes);state.redoStack=[]; for(const [id] of changes) state.assignments[id]='removed';state.brushSurface=null}
}
export function undoStroke(state) {
 const changes=state.undoStack.pop()
 if (!changes) return false
 state.redoStack.push(changes.map(([id])=>[id,state.assignments[id]]))
 for(const [id,region] of changes) state.assignments[id]=region
 state.brushSurface=null
 return true
}
export function redoStroke(state) {
 const changes=state.redoStack.pop()
 if(!changes)return false
 state.undoStack.push(changes.map(([id])=>[id,state.assignments[id]]))
 for(const [id,region] of changes)state.assignments[id]=region
 state.brushSurface=null
 return true
}
export function buildRegionGroups(state,requireTwo=false) {
 const parts=PARTS.filter(part=>state.assignments.includes(part.id)).map(part=>({...part,material:'KCScan_'+part.material,customizable:true}))
 if (requireTwo && parts.length<2) throw new Error('Paint at least two nonempty shoe parts.')
 const keys=[null,...parts.map(part=>part.id)]
 const geometry=new BufferGeometry(); const order=[]
 for(const [materialIndex,key] of keys.entries()) {
  const start=order.length
  state.assignments.forEach((region,id)=>{if(region===key) order.push(id*3,id*3+1,id*3+2)})
  if(order.length>start) geometry.addGroup(start,order.length-start,materialIndex)
 }
 for(const [name,attribute] of Object.entries(state.geometry.attributes)) {
  if(name==='color') continue
  const data=new attribute.array.constructor(order.length*attribute.itemSize)
  order.forEach((old,index)=>{for(let k=0;k<attribute.itemSize;k++) data[index*attribute.itemSize+k]=attribute.array[old*attribute.itemSize+k]})
  geometry.setAttribute(name,new BufferAttribute(data,attribute.itemSize,attribute.normalized))
 }
 // GLTFExporter needs indexed geometry to preserve material groups.
 geometry.setIndex(order.map((_,index)=>index))
 return {geometry,parts}
}
export async function neutralDetailTexture(texture) {
 if (!texture?.image) throw new Error('Reconstruction has no photographed texture. Recapture before publishing.')
 const source=texture.image
 const canvas=document.createElement('canvas')
 canvas.width=Math.min(2048,source.width || source.naturalWidth)
 canvas.height=Math.min(2048,source.height || source.naturalHeight)
 const context=canvas.getContext('2d',{willReadFrequently:true})
 context.drawImage(source,0,0,canvas.width,canvas.height)
 const pixels=context.getImageData(0,0,canvas.width,canvas.height)
 let sum=0
 for(let i=0;i<pixels.data.length;i+=4) sum+=0.2126*pixels.data[i]+0.7152*pixels.data[i+1]+0.0722*pixels.data[i+2]
 const average=Math.max(1,sum/(pixels.data.length/4))
 for(let i=0;i<pixels.data.length;i+=4) {
  const luminance=0.2126*pixels.data[i]+0.7152*pixels.data[i+1]+0.0722*pixels.data[i+2]
  // shortcut: preserve moderate luminance detail, not calibrated albedo; upgrade with lighting calibration when physical captures justify it.
  const detail=Math.max(150,Math.min(255,230+45*(luminance/average-1)))
  pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=detail
 }
 context.putImageData(pixels,0,0)
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not prepare replacement texture.')),'image/png'))
}
export async function exportScanRegions(mesh,state) {
 const {geometry,parts}=buildRegionGroups(state,true)
 const original=Array.isArray(mesh.material)?mesh.material[0]:mesh.material
 const materials=[original.clone(),...parts.map(part=>{const material=original.clone(); material.name=part.material; return material})]
 materials[0].name='KCScan_Original'
 mesh.updateWorldMatrix(true,false)
 geometry.applyMatrix4(mesh.matrixWorld)
 const output=new Mesh(geometry,materials); output.name='ScannedShoe'
 const scene=new Scene(); scene.add(output)
 try {
  const neutralTexture=await neutralDetailTexture(original.map)
  const glb=await new GLTFExporter().parseAsync(scene,{binary:true,onlyVisible:true})
  if(glb.byteLength>20*1024*1024) throw new Error('Prepared model exceeds 20 MB. Crop unwanted surroundings first.')
  return {glb,parts,neutralTexture}
 } finally {geometry.dispose(); materials.forEach(material=>material.dispose())}
}

export function restoreRegionMesh(scene,parts) {
 const known=new Map(parts.map(part=>[part.material,part.id])),geometries=[],assignments=[]
 let original
 scene.updateWorldMatrix(true,true)
 try{
  scene.traverse(object=>{
   if(!object.isMesh)return
   const materials=Array.isArray(object.material)?object.material:[object.material]
   for(const material of materials){
    if(!material.map || (original && material.map!==original.map))throw new Error('Repainting needs one shared photographed texture.')
    original ||= material
   }
   const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone()
   geometries.push(geometry);geometry.applyMatrix4(object.matrixWorld)
   const faces=Array(geometry.getAttribute('position').count/3).fill(null)
   for(const group of geometry.groups.length?geometry.groups:[{start:0,count:geometry.getAttribute('position').count,materialIndex:0}]){
    const name=materials[group.materialIndex].name,id=known.get(name)
    if(!id && name!=='KCScan_Original')throw new Error('Saved part does not match this model.')
    for(let face=group.start/3;face<(group.start+group.count)/3;face++)faces[face]=id||null
   }
   assignments.push(...faces)
  })
  if(!geometries.length)throw new Error('Saved shoe has no surface.')
  const geometry=mergeGeometries(geometries)
  if(!geometry)throw new Error('Saved shoe regions have incompatible geometry.')
  const mesh=new Mesh(geometry,original.clone()),state=createRegionState(mesh)
  state.assignments=assignments
  return {mesh,state}
 }finally{geometries.forEach(geometry=>geometry.dispose())}
}
