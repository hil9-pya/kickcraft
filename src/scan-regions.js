import {BufferGeometry,BufferAttribute,Mesh,Scene} from 'three'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {PARTS} from './customization.js'

export function createRegionState(mesh) {
 const geometry=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
 const count=geometry.getAttribute('position')?.count
 if (!count || count%3 || count/3>50000) throw new Error('Scan must contain at most 50,000 triangles.')
 if (!geometry.getAttribute('uv') || !geometry.getAttribute('normal')) throw new Error('Scan needs texture coordinates and normals.')
 return {geometry,assignments:Array(count/3).fill(null),undoStack:[]}
}
export function paintFaces(state,faceIds,regionId) {
 if (regionId!==null && !PARTS.some(part=>part.id===regionId)) throw new Error('Unknown shoe part.')
 const ids=[...new Set(faceIds)]
 if (ids.some(id=>!Number.isInteger(id) || id<0 || id>=state.assignments.length)) throw new Error('Invalid face.')
 const changes=ids.filter(id=>state.assignments[id]!=='removed' && state.assignments[id]!==regionId).map(id=>[id,state.assignments[id]])
 if (!changes.length) return
 state.undoStack.push(changes)
 for (const [id] of changes) state.assignments[id]=regionId
}
export function cropFaces(state,ids) {
 if (ids.some(id=>!Number.isInteger(id) || id<0 || id>=state.assignments.length)) throw new Error('Invalid crop face.')
 const changes=ids.filter(id=>state.assignments[id]!=='removed').map(id=>[id,state.assignments[id]])
 if (changes.length) {state.undoStack.push(changes); for(const [id] of changes) state.assignments[id]='removed'}
}
export function undoStroke(state) {
 const changes=state.undoStack.pop()
 if (!changes) return false
 for(const [id,region] of changes) state.assignments[id]=region
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
