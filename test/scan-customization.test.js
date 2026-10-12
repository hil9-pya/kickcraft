import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareScanMaterials,setMaterialColor,restoreMaterialColor} from '../src/customization.js'
function fixture() {
 const original={name:'original'},neutral={name:'neutral'}
 const textureInfo={texture:original,setTexture(value){this.texture=value}}
 const material={pbrMetallicRoughness:{baseColorFactor:[0.8,0.9,1,1],baseColorTexture:textureInfo,setBaseColorFactor(value){this.baseColorFactor=value}}}
 const model={getMaterialByName(name){return name==='KCScan_UpperMaterial'?material:null}}
 const viewer={model,createTexture:async()=>neutral}
 return {original,neutral,material,model,viewer,textureInfo}
}
test('scan white replaces its texture; reset restores photographed texture and factor',async()=>{
 const f=fixture()
 await prepareScanMaterials(f.viewer,[{material:'KCScan_UpperMaterial',recolorTexturePath:'/images/uploads/scan-neutral.png'}])
 assert.equal(setMaterialColor(f.model,'KCScan_UpperMaterial','#ffffff'),true)
 assert.equal(f.textureInfo.texture,f.neutral)
 assert.equal(f.material.pbrMetallicRoughness.baseColorFactor,'#ffffff')
 assert.equal(restoreMaterialColor(f.model,'KCScan_UpperMaterial'),true)
 assert.equal(f.textureInfo.texture,f.original)
 assert.deepEqual(f.material.pbrMetallicRoughness.baseColorFactor,[0.8,0.9,1,1])
 assert.equal(setMaterialColor(f.model,'missing','#ffffff'),false)
})
test('scan texture paths cannot reference remote services or another directory',async()=>{
 const f=fixture()
 for(const path of ['https://outside/texture.png','/images/uploads/../private.png']) await assert.rejects(prepareScanMaterials(f.viewer,[{material:'KCScan_UpperMaterial',recolorTexturePath:path}]))
})

test('scanned shoes without an attachment point offer no charm except none',async()=>{
 const {availableCharms}=await import('../src/customization.js')
 assert.deepEqual(availableCharms({charmsEnabled:false}).map(charm=>charm.id),['none'])
 assert.equal(availableCharms({charmsEnabled:true}).length,4)
 assert.equal(availableCharms({}).length,4)
})
