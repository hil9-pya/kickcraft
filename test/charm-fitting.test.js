import test from 'node:test'
import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import {fitCharmPreview} from '../src/charm-fitting.js'
const root=path.resolve(import.meta.dirname,'..')
function php(code){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',`require ${JSON.stringify(root+'/api/scans/common.php')};try{${code}}catch(Throwable $e){echo json_encode(['code'=>$e->getCode()]);}`],{encoding:'utf8'}))}
test('charm fitting validates bounded size and rotation without accepting malformed values',()=>{
 assert.deepEqual(php('echo json_encode(scanCharmSettings(null));'),{size:1,rotation:[0,0,0]})
 for(const input of [{size:0,rotation:[0,0,0]},{size:4,rotation:[0,0,0]},{size:1,rotation:[181,0,0]},{size:1,rotation:['oops',0,0]},{size:1,rotation:[0,0]},[]])assert.equal(php(`echo json_encode(scanCharmSettings(${JSON.stringify(JSON.stringify(input))}));`).code,422)
})
test('fitted charm root matches Three preview and attachment point stays fixed when scaling and rotating',()=>{
 const point=[.03,.08,-.04],settings={size:1.7,rotation:[35,-60,90]}
 for(const slug of ['star','lightning','k-tag']){
  const bytes=readFileSync(path.join(root,'public/models/charms/'+slug+'-charm.glb'))
  const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)))
  const before=gltf.nodes.find(n=>n.name==='CharmRoot')
  const fitted=php(`$json=json_decode(${JSON.stringify(JSON.stringify(gltf))},true);echo json_encode(scanFitCharm($json,${JSON.stringify(point).replace(/\[/g,'[')},json_decode(${JSON.stringify(JSON.stringify(settings))},true)));`)
  const node=fitted.nodes.find(n=>n.name==='CharmRoot')
  assert.deepEqual(node.translation,point);assert.deepEqual(node.scale,[1.7,1.7,1.7])
  const expected=new THREE.Quaternion().setFromEuler(new THREE.Euler(...settings.rotation.map(THREE.MathUtils.degToRad))).multiply(new THREE.Quaternion(...before.rotation))
  node.rotation.forEach((v,i)=>assert.ok(Math.abs(v-expected.toArray()[i])<1e-10))
  assert.deepEqual(fitted.meshes,gltf.meshes);assert.deepEqual(fitted.bufferViews,gltf.bufferViews)
 }
})

test('live preview changes size and rotation without accumulating transforms',()=>{
 const root=new THREE.Object3D();root.position.set(1,2,3);root.rotation.set(.2,-.5,.4)
 const original=root.quaternion.clone(),point=[.1,.2,.3]
 fitCharmPreview(root,point,{size:2,rotation:[0,90,0]})
 assert.deepEqual(root.position.toArray(),point);assert.deepEqual(root.scale.toArray(),[2,2,2])
 fitCharmPreview(root,point,{size:.5,rotation:[0,0,0]})
 assert.deepEqual(root.position.toArray(),point);assert.deepEqual(root.scale.toArray(),[.5,.5,.5]);assert.ok(root.quaternion.angleTo(original)<1e-7)
 fitCharmPreview(root,null,{size:1,rotation:[0,0,0]});assert.equal(root.visible,false)
})
