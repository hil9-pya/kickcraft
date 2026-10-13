import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {addCharmSway,stepCharmSway,attachCharmSway} from '../src/charm-sway.js'
function json(bytes){const view=new DataView(bytes);return JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,view.getUint32(12,true))))}
test('sway copies preserve fitted root, fixed ring, original geometry and animate pendant only',()=>{
 for(const slug of ['star','lightning','k-tag']){
  const raw=readFileSync(new URL('../public/models/charms/'+slug+'-charm.glb',import.meta.url)),input=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),original=json(input)
  const output=addCharmSway(input),animated=json(output),root=animated.nodes.find(n=>n.name==='CharmRoot'),ring=original.nodes.findIndex(n=>n.name==='ConnectorRing'),pivot=animated.nodes.findIndex(n=>n.name==='KCCharmSwing')
  assert.deepEqual(animated.nodes[ring],original.nodes[ring]);assert.ok(root.children.includes(ring));assert.ok(!animated.nodes[pivot].children.includes(ring))
  for(const key of ['translation','rotation','scale','matrix'])assert.deepEqual(root[key],original.nodes.find(n=>n.name==='CharmRoot')[key])
  assert.deepEqual(animated.meshes,original.meshes);assert.equal(animated.animations[0].channels[0].target.node,pivot);assert.equal(animated.animations[0].channels[0].target.path,'rotation')
  assert.ok(output.byteLength<input.byteLength+2000);assert.deepEqual(json(input),original,'input bytes must stay unchanged')
 }
 assert.throws(()=>addCharmSway(new ArrayBuffer(2)),/GLB/)
})
test('pendulum is bounded, direction-sensitive and settles even after long frame gaps',()=>{
 const state={angle:0,velocity:0};stepCharmSway(state,1/60,0.5);assert.ok(state.angle>0)
 for(let i=0;i<120;i++)stepCharmSway(state,1/60,10)
 assert.ok(Math.abs(state.angle)<=Math.PI/9);assert.ok(Number.isFinite(state.velocity))
 stepCharmSway(state,10)
 for(let i=0;i<600;i++)stepCharmSway(state,1/60)
 assert.ok(Math.abs(state.angle)<0.0005);assert.ok(Math.abs(state.velocity)<0.003)
 const reverse={angle:0,velocity:0};stepCharmSway(reverse,1/60,-0.5);assert.ok(reverse.angle<0)
})
test('sway responds only to rotation, settles to rest, obeys reduced motion and cleans listeners',()=>{
 const viewer=new EventTarget(),media=new EventTarget(),document=new EventTarget(),frames=new Map(),calls=[];let orbit={theta:0,phi:1,radius:1},time=0,id=0
 Object.assign(media,{matches:false});Object.assign(document,{hidden:false});Object.assign(viewer,{getCameraOrbit:()=>orbit,availableAnimations:['KCCharmSway'],appendAnimation:(...args)=>calls.push(['append',...args]),detachAnimation:(...args)=>calls.push(['detach',...args]),pause:(...args)=>calls.push(['pause',...args])})
 const environment={document,performance:{now:()=>time},matchMedia:()=>media,requestAnimationFrame:fn=>{frames.set(++id,fn);return id},cancelAnimationFrame:key=>frames.delete(key)}
 const dispose=attachCharmSway(viewer,2,environment)
 function change(source='user-interaction'){const e=new Event('camera-change');e.detail={source};viewer.dispatchEvent(e)}
 function tick(){time+=1000/60;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time))}
 orbit={theta:0,phi:1,radius:2};change();assert.equal(frames.size,0,'zoom alone must not swing charm')
 orbit={theta:0.2,phi:1,radius:2};change('none');assert.equal(frames.size,0,'programmatic framing must not swing charm')
 orbit={theta:0.4,phi:1,radius:2};change();tick();assert.ok(calls.some(([type,name,options])=>type==='append'&&name==='KCCharmSway'&&options.modelIndex===2&&options.time!==0.5))
 for(let i=0;i<600&&frames.size;i++)tick();assert.equal(frames.size,0,'idle animation loop must stop')
 assert.ok(calls.some(([type,options])=>type==='pause'&&options.modelIndex===2))
 media.matches=true;media.dispatchEvent(new Event('change'));calls.length=0;orbit.theta=0.8;change();assert.equal(frames.size,0)
 media.matches=false;media.dispatchEvent(new Event('change'));orbit.theta=1;change();tick();document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,0)
 dispose();calls.length=0;document.hidden=false;orbit.theta=1.5;change();assert.equal(frames.size,0);assert.equal(calls.length,0)
})

test('GLTF mixer rotates pendant geometry while connector ring and fitted root remain stationary',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'),{AnimationMixer,Vector3}=await import('three')
 for(const slug of ['star','lightning','k-tag']){
  const raw=readFileSync(new URL('../public/models/charms/'+slug+'-charm.glb',import.meta.url)),input=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)
  const {scene,animations}=await new GLTFLoader().parseAsync(addCharmSway(input),'')
  const ring=scene.getObjectByName('ConnectorRing'),root=scene.getObjectByName('CharmRoot'),link=scene.getObjectByName('ConnectorLink')
  root.position.set(.03,.08,-.04);root.scale.setScalar(1.7)
  scene.updateMatrixWorld(true);const ringMatrix=ring.matrixWorld.clone(),rootMatrix=root.matrixWorld.clone(),before=link.getWorldPosition(new Vector3())
  const mixer=new AnimationMixer(scene),action=mixer.clipAction(animations[0]);action.play();mixer.update(.75);scene.updateMatrixWorld(true)
  assert.deepEqual(ring.matrixWorld.elements,ringMatrix.elements);assert.deepEqual(root.matrixWorld.elements,rootMatrix.elements)
  assert.ok(link.getWorldPosition(new Vector3()).distanceTo(before)>0.001,'pendant must move around fixed ring')
  action.time=.5;mixer.update(0);scene.updateMatrixWorld(true);assert.ok(link.getWorldPosition(new Vector3()).distanceTo(before)<1e-7,'neutral animation pose must restore original placement')
 }
})

test('charm component uses temporary animated copies, falls back on malformed assets and releases copies',async()=>{
 const Vue=await import('vue'),{addCharmSway,attachCharmSway}=await import('../src/charm-sway.js')
 const source=readFileSync(new URL('../src/components/SwayingCharms.vue',import.meta.url),'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm,'')
 for(const valid of [true,false]){
  const raw=readFileSync(new URL('../public/models/charms/star-charm.glb',import.meta.url)),bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),mounted=[],cleanup=[],revoked=[]
  const props=Vue.reactive({viewer:null,charms:[{id:'star',src:'/models/charms/star-charm.glb'}],selected:'none',scale:'1 1 1',offset:null}),scope=Vue.effectScope()
  const values={computed:Vue.computed,onMounted:fn=>mounted.push(fn),onBeforeUnmount:fn=>cleanup.push(fn),shallowRef:Vue.shallowRef,watch:Vue.watch,defineProps:()=>props,charmScale:()=>'',addCharmSway,attachCharmSway,fetch:async()=>({ok:true,arrayBuffer:async()=>valid?bytes:new ArrayBuffer(2)}),URL:{createObjectURL:()=> 'blob:verified-charm',revokeObjectURL:url=>revoked.push(url)}}
  const state=scope.run(()=>new Function(...Object.keys(values),source+';return {models}')( ...Object.values(values)))
  scope.run(()=>mounted.forEach(fn=>fn()));await new Promise(setImmediate)
  assert.equal(state.models.value[0].src,valid?'blob:verified-charm':'/models/charms/star-charm.glb')
  assert.equal(props.charms[0].src,'/models/charms/star-charm.glb','source record must stay unchanged')
  cleanup.forEach(fn=>fn());scope.stop();assert.deepEqual(revoked,valid?['blob:verified-charm']:[])
 }
})
