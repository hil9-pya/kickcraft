import test from 'node:test'
import assert from 'node:assert/strict'
import {BufferGeometry,Float32BufferAttribute,Mesh,MeshStandardMaterial} from 'three'
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
