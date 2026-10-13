import test from 'node:test'
import assert from 'node:assert/strict'
import {BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial,Vector3} from 'three'
import {createRegionState,paintFaces,undoStroke,buildRegionGroups,cropFaces} from '../src/scan-regions.js'
function fixture() {
 const geometry=new BufferGeometry()
 geometry.setAttribute('position',new Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0, 0,0,-1, 0,1,-1, 1,0,-1],3))
 geometry.setAttribute('uv',new Float32BufferAttribute([0,0, 1,0, 0,1, 0,0, 0,1, 1,0],2))
 geometry.computeVertexNormals()
 return new Mesh(geometry,new MeshStandardMaterial())
}
test('painting upper and outsole stays independent; erase and undo restore a stroke',()=>{
 const state=createRegionState(fixture())
 paintFaces(state,[0],'upper'); paintFaces(state,[1],'outsole')
 assert.deepEqual(state.assignments,['upper','outsole'])
 paintFaces(state,[0],null); assert.deepEqual(state.assignments,[null,'outsole'])
 assert.equal(undoStroke(state),true); assert.deepEqual(state.assignments,['upper','outsole'])
 assert.throws(()=>paintFaces(state,[2],'upper'))
 assert.throws(()=>paintFaces(state,[0],'unknown'))
})
test('material groups preserve UVs and normals, crop has undo, export needs two regions',()=>{
 const state=createRegionState(fixture())
 paintFaces(state,[0],'upper'); assert.throws(()=>buildRegionGroups(state,true),/two/)
 paintFaces(state,[1],'outsole')
 const {geometry,parts}=buildRegionGroups(state,true)
 assert.deepEqual(parts.map(p=>p.material),['KCScan_UpperMaterial','KCScan_OutsoleMaterial'])
 assert.equal(geometry.getAttribute('uv').count,6)
 assert.equal(geometry.getAttribute('normal').count,6)
 assert.equal(geometry.groups.length,2)
 cropFaces(state,[1]); assert.throws(()=>buildRegionGroups(state,true),/two/)
 undoStroke(state); assert.equal(buildRegionGroups(state,true).parts.length,2)
})


test('dense surface brush fills nearby faces without painting occluded surfaces; crop and undo refresh visibility',async()=>{
 const regions=await import('../src/scan-regions.js')
 assert.equal(typeof regions.surfaceBrushFaces,'function','dense brush helper must exist')
 const vertices=[]
 for(const z of [0,-0.02])for(let y=-8;y<8;y++)for(let x=-8;x<8;x++){
  const a=x/20,b=y/20,c=(x+1)/20,d=(y+1)/20
  vertices.push(a,b,z,c,b,z,a,d,z,c,b,z,c,d,z,a,d,z)
 }
 const geometry=new BufferGeometry()
 geometry.setAttribute('position',new Float32BufferAttribute(vertices,3))
 geometry.setAttribute('uv',new Float32BufferAttribute(Array(vertices.length/3*2).fill(0),2));geometry.computeVertexNormals()
 const state=createRegionState(new Mesh(geometry,new MeshStandardMaterial()))
 const point=new Vector3(0,0,0),camera=new Vector3(0,0,2)
 const faces=regions.surfaceBrushFaces(state,point,0.2,camera)
 assert.ok(faces.length>80,'all dense faces in patch should be selected, not sparse ray samples')
 assert.ok(faces.every(id=>id<512),'rear overlapping layer must stay unpainted')
 cropFaces(state,Array.from({length:512},(_,i)=>i))
 const behind=regions.surfaceBrushFaces(state,point,0.2,camera)
 assert.ok(behind.length>80);assert.ok(behind.every(id=>id>=512))
 undoStroke(state)
 assert.ok(regions.surfaceBrushFaces(state,point,0.2,camera).every(id=>id<512))
 state.geometry.rotateY(Math.PI)
 assert.deepEqual(regions.surfaceBrushFaces(state,point,0.2,camera),[],'rotated back faces should not be selected')
 assert.throws(()=>regions.surfaceBrushFaces(state,point,NaN,camera),/radius/)
})

function fillFixture() {
 const geometry=new BufferGeometry(),positions=[],uv=[]
 for(const x of [0,1,2,5]) {
  positions.push(x,0,0,x+1,0,0,x,1,0,x+1,0,0,x+1,1,0,x,1,0)
  uv.push(...Array.from({length:6},()=>[x<2?0.125:0.875,0.5]).flat())
 }
 geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
 geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.computeVertexNormals()
 return createRegionState(new Mesh(geometry,new MeshStandardMaterial()))
}
test('smart fill follows connected color regions, protects other parts, and commits as one undoable action',async()=>{
 const {smartFillFaces}=await import('../src/scan-regions.js')
 assert.equal(typeof smartFillFaces,'function')
 const state=fillFixture(),camera=new Vector3(1,0.5,10)
 const colors=new Float32Array([200,200,200,200,200,200,220,220,220,220,220,220,30,30,30,30,30,30,200,200,200,200,200,200])
 assert.deepEqual(smartFillFaces(state,0,colors,40,camera,'upper').sort((a,b)=>a-b),[0,1,2,3])
 assert.deepEqual(state.assignments,Array(8).fill(null),'suggestion must not mutate saved boundaries')
 assert.deepEqual(smartFillFaces(state,0,colors,10,camera,'upper').sort((a,b)=>a-b),[0,1])
 paintFaces(state,[2,3],'midsole')
 assert.deepEqual(smartFillFaces(state,0,colors,40,camera,'upper').sort((a,b)=>a-b),[0,1])
 paintFaces(state,smartFillFaces(state,0,colors,40,camera,'upper'),'upper')
 undoStroke(state);assert.deepEqual(state.assignments,[null,null,'midsole','midsole',null,null,null,null])
 cropFaces(state,[0]);assert.deepEqual(smartFillFaces(state,0,colors,40,camera,'upper'),[])
 assert.throws(()=>smartFillFaces(state,-1,colors,40,camera,'upper'),/face/i)
 assert.throws(()=>smartFillFaces(state,1,colors,NaN,camera,'upper'),/tolerance/i)
})
test('smart fill stops at sharp edges and occluded surfaces',async()=>{
 const {smartFillFaces}=await import('../src/scan-regions.js')
 const geometry=new BufferGeometry()
 geometry.setAttribute('position',new Float32BufferAttribute([0,0,0,1,0,0,0,1,0, 1,0,0,0,0,0,0,0,-1, 0,0,-0.02,1,0,-0.02,0,1,-0.02],3))
 geometry.setAttribute('uv',new Float32BufferAttribute(Array(18).fill(0.5),2));geometry.computeVertexNormals()
 const state=createRegionState(new Mesh(geometry,new MeshStandardMaterial())),colors=new Float32Array(9).fill(200)
 assert.deepEqual(smartFillFaces(state,0,colors,40,new Vector3(0.3,0.3,2),'upper'),[0])
 assert.deepEqual(smartFillFaces(state,2,colors,40,new Vector3(0.3,0.3,2),'upper'),[])
})
test('face color sampling follows texture UV transforms and flipY',async()=>{
 const {sampleFaceColors}=await import('../src/scan-regions.js')
 const {Texture}=await import('three')
 const state=fillFixture(),texture=new Texture();texture.flipY=false
 const pixels={width:2,height:1,data:new Uint8ClampedArray([200,100,50,255,20,30,40,255])}
 const colors=sampleFaceColors(state,texture,pixels)
 assert.deepEqual(Array.from(colors.slice(0,3)),[200,100,50]);assert.deepEqual(Array.from(colors.slice(12,15)),[20,30,40])
 texture.offset.x=0.5;texture.updateMatrix()
 assert.deepEqual(Array.from(sampleFaceColors(state,texture,pixels).slice(0,3)),[20,30,40])
 texture.offset.x=0;texture.updateMatrix();texture.flipY=true
 state.geometry.getAttribute('uv').setY(0,0.1);state.geometry.getAttribute('uv').setY(1,0.1);state.geometry.getAttribute('uv').setY(2,0.1)
 const vertical={width:1,height:2,data:new Uint8ClampedArray([200,100,50,255,20,30,40,255])}
 assert.deepEqual(Array.from(sampleFaceColors(state,texture,vertical).slice(0,3)),[20,30,40])
})


test('multiple overlapping fills apply together; removal and clearing a part remain undoable',()=>{
 const state=fillFixture(),fills=[[0,1,2],[2,3],[6,7]]
 fills.splice(1,1)
 paintFaces(state,fills.flat(),'upper')
 assert.deepEqual(state.assignments,['upper','upper','upper',null,null,null,'upper','upper'])
 undoStroke(state);assert.deepEqual(state.assignments,Array(8).fill(null))
 paintFaces(state,fills.flat(),'upper');paintFaces(state,[3,4],'midsole');cropFaces(state,[5])
 paintFaces(state,state.assignments.flatMap((part,id)=>part==='upper'?[id]:[]),null)
 assert.deepEqual(state.assignments,[null,null,null,'midsole','midsole','removed',null,null])
 undoStroke(state);assert.equal(state.assignments[6],'upper');assert.equal(state.assignments[5],'removed')
})


test('middle drag rotates camera in paint/fill tools; left drag stays available for selection',async()=>{
 const {OrbitControls}=await import('three/addons/controls/OrbitControls.js')
 const {PerspectiveCamera}=await import('three')
 const {setRegionControls}=await import('../src/scan-regions.js')
 const doc=new EventTarget(),canvas=new EventTarget();Object.assign(canvas,{style:{},ownerDocument:doc,clientWidth:800,clientHeight:600,getRootNode:()=>doc,setPointerCapture(){},releasePointerCapture(){}})
 const camera=new PerspectiveCamera(40,4/3,0.01,20);camera.position.set(0,0,3)
 const controls=new OrbitControls(camera,canvas)
 function event(target,type,button,x){const e=new Event(type);Object.assign(e,{pointerId:1,pointerType:'mouse',button,clientX:x,clientY:100,pageX:x,pageY:100,ctrlKey:false,metaKey:false,shiftKey:false});target.dispatchEvent(e)}
 function drag(button){event(canvas,'pointerdown',button,100);event(doc,'pointermove',button,180);event(doc,'pointerup',button,180)}
 try {
  for(const tool of ['paint','fill','erase','charm']){
   setRegionControls(controls,tool);const before=camera.position.clone();drag(0);assert.ok(before.distanceTo(camera.position)<1e-9,tool+' left drag must not orbit');drag(1);assert.ok(before.distanceTo(camera.position)>0.1,tool+' middle drag must orbit')
  }
  setRegionControls(controls,'rotate');const before=camera.position.clone();drag(0);assert.ok(before.distanceTo(camera.position)>0.1)
 }finally{controls.dispose()}
})
