import {validateEmbeddedGlb} from './glb-thumbnail.js'
const LIMIT=Math.PI/9
export function addCharmSway(bytes) {
 validateEmbeddedGlb(bytes)
 const header=new DataView(bytes),length=header.getUint32(12,true),offset=20+length
 if(offset+8>bytes.byteLength||header.getUint32(offset+4,true)!==0x004e4942)throw new Error('Invalid charm GLB buffer.')
 const gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)))
 const root=gltf.nodes?.find(node=>node.name==='CharmRoot'),ring=gltf.nodes?.findIndex(node=>node.name==='ConnectorRing')
 if(!root?.children?.includes(ring)||root.children.length<2||gltf.buffers?.length!==1||gltf.animations?.length)throw new Error('Charm has no supported fixed-ring attachment.')
 const binLength=header.getUint32(offset,true)
 if(offset+8+binLength!==bytes.byteLength)throw new Error('Invalid charm GLB length.')
 const pivot=gltf.nodes.length
 gltf.nodes.push({name:'KCCharmSwing',children:root.children.filter(index=>index!==ring)})
 root.children=[ring,pivot]
 const bin=new Uint8Array(binLength+40);bin.set(new Uint8Array(bytes,offset+8,binLength))
 const floats=new DataView(bin.buffer);[0,1,0,0,-Math.sin(LIMIT/2),Math.cos(LIMIT/2),0,0,Math.sin(LIMIT/2),Math.cos(LIMIT/2)].forEach((value,index)=>floats.setFloat32(binLength+index*4,value,true))
 const timeView=gltf.bufferViews.length;gltf.bufferViews.push({buffer:0,byteOffset:binLength,byteLength:8},{buffer:0,byteOffset:binLength+8,byteLength:32})
 const timeAccessor=gltf.accessors.length;gltf.accessors.push({bufferView:timeView,componentType:5126,count:2,type:'SCALAR',min:[0],max:[1]},{bufferView:timeView+1,componentType:5126,count:2,type:'VEC4'})
 gltf.buffers[0].byteLength=bin.length
 gltf.animations=[{name:'KCCharmSway',samplers:[{input:timeAccessor,output:timeAccessor+1,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:pivot,path:'rotation'}}]}]
 const text=new TextEncoder().encode(JSON.stringify(gltf)),padded=Math.ceil(text.length/4)*4,output=new Uint8Array(28+padded+bin.length),view=new DataView(output.buffer)
 ;[0x46546c67,2,output.length,padded,0x4e4f534a].forEach((value,index)=>view.setUint32(index*4,value,true))
 output.fill(32,20,20+padded);output.set(text,20);view.setUint32(20+padded,bin.length,true);view.setUint32(24+padded,0x004e4942,true);output.set(bin,28+padded)
 return output.buffer
}
export function stepCharmSway(state,seconds,impulse=0) {
 state.velocity=Math.max(-4,Math.min(4,state.velocity+impulse))
 let remaining=Math.max(0,Math.min(0.05,seconds))
 while(remaining>0){const dt=Math.min(remaining,1/120);state.velocity+=(-90*state.angle-7*state.velocity)*dt;state.angle+=state.velocity*dt;if(Math.abs(state.angle)>LIMIT){state.angle=Math.sign(state.angle)*LIMIT;state.velocity*=0.25}remaining-=dt}
 return state
}
export function attachCharmSway(viewer,modelIndex,environment=window) {
 const media=environment.matchMedia('(prefers-reduced-motion: reduce)'),document=environment.document,state={angle:0,velocity:0}
 let orbit=viewer.getCameraOrbit(),frame=null,last=0
 const supported=()=>viewer.availableAnimations?.includes('KCCharmSway')
 function reset(){if(frame!==null)environment.cancelAnimationFrame(frame);frame=null;state.angle=state.velocity=0;orbit=viewer.getCameraOrbit();if(supported()){viewer.detachAnimation('KCCharmSway',{modelIndex,fade:false});viewer.pause({modelIndex})}}
 function animate(time){
  frame=null
  if(media.matches||document.hidden){reset();return}
  stepCharmSway(state,(time-last)/1000);last=time
  const resting=Math.abs(state.angle)<0.0005&&Math.abs(state.velocity)<0.003
  viewer.appendAnimation('KCCharmSway',{modelIndex,time:resting?0.5:0.5+state.angle/(2*LIMIT),timeScale:0,weight:1,fade:false,repetitions:1})
  if(resting){state.angle=state.velocity=0;viewer.pause({modelIndex})}
  else frame=environment.requestAnimationFrame(animate)
 }
 function changed(event){
  const next=viewer.getCameraOrbit(),yaw=Math.atan2(Math.sin(next.theta-orbit.theta),Math.cos(next.theta-orbit.theta)),pitch=next.phi-orbit.phi;orbit=next
  if(event.detail?.source!=='user-interaction'||media.matches||document.hidden||!supported()||Math.abs(yaw)+Math.abs(pitch)<0.0001)return
  stepCharmSway(state,0,yaw*12+pitch*6)
  if(frame===null){last=environment.performance.now();frame=environment.requestAnimationFrame(animate)}
 }
 function visibility(){if(document.hidden)reset();else orbit=viewer.getCameraOrbit()}
 viewer.addEventListener('camera-change',changed);viewer.addEventListener('load',reset);media.addEventListener('change',reset);document.addEventListener('visibilitychange',visibility)
 return ()=>{viewer.removeEventListener('camera-change',changed);viewer.removeEventListener('load',reset);media.removeEventListener('change',reset);document.removeEventListener('visibilitychange',visibility);reset()}
}
