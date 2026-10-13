import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..')
function fixture(file,edit=()=>{}) {
 const raw=readFileSync(path.join(root,'public/models/shoe-soleview-final.glb')),length=raw.readUInt32LE(12)
 const json=JSON.parse(raw.subarray(20,20+length)),bin=raw.subarray(28+length)
 json.materials=[{pbrMetallicRoughness:{baseColorTexture:{index:0}}}]
 for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0
 edit(json)
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)])
 const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+bin.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16)
 const chunk=Buffer.alloc(8);chunk.writeUInt32LE(bin.length);chunk.writeUInt32LE(0x004e4942,4)
 writeFileSync(file,Buffer.concat([header,padded,chunk,bin]))
}
function validate(file,allowSingle=false){return JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',`require ${JSON.stringify(root+'/api/products/common.php')};try{echo json_encode(['names'=>productMaterialNames(${JSON.stringify(file)},${allowSingle?'true':'false'})]);}catch(Throwable $e){echo json_encode(['error'=>$e->getMessage()]);}`],{encoding:'utf8'}))}
test('single-material upload becomes an unpainted draft, including unnamed material; publication still rejects it',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'kc-single-upload-')),file=path.join(dir,'shoe.glb')
 try {
  fixture(file);assert.deepEqual(validate(file,true),{names:[]})
  assert.ok(validate(file).error,'unpainted surface cannot pass publication material check')
  fixture(file,json=>{delete json.materials[0].pbrMetallicRoughness.baseColorTexture})
  assert.ok(validate(file,true).error,'painting needs embedded base texture')
  fixture(file,json=>{json.images[0].uri='https://outside.invalid/private.png'})
  assert.ok(validate(file,true).error,'single-material mode must preserve resource validation')
  assert.equal(validate(path.join(root,'public/models/shoe-soleview-final.glb'),true).names.length,8)
 }finally{rmSync(dir,{recursive:true,force:true})}
})

test('saving first painted regions selects a real part and retains private draft state',async()=>{
 const source=readFileSync(path.join(root,'src/components/SellerProductEditor.vue'),'utf8')
 const code=source.slice(source.indexOf('async function saveParts('),source.indexOf('\nasync function shareTemplate('))
 const form={id:'upload',glbPath:'/models/uploads/raw.glb',parts:[]},activePart={value:undefined},painting={value:{shoe:{glbPath:form.glbPath}}},ready={value:true},busy={value:false},error={value:''},message={value:''},events=[]
 const shoe={glbPath:'/models/uploads/painted.glb',parts:[{id:'upper',label:'Upper',material:'KCScan_UpperMaterial'},{id:'outsole',label:'Outsole',material:'KCScan_OutsoleMaterial'}],publicationState:'draft'}
 const api=async (endpoint,{body})=>{assert.equal(endpoint,'products/regions.php');assert.equal(body.get('expectedModel'),'/models/uploads/raw.glb');return {shoe}}
 const saveParts=new Function('form','activePart','painting','ready','busy','error','message','api','emit',code+';return saveParts')(form,activePart,painting,ready,busy,error,message,api,(...args)=>events.push(args))
 const png=new Blob(['fixture'],{type:'image/png'})
 await saveParts({payload:{glb:new ArrayBuffer(8),neutralTexture:png,thumbnail:png},charmPoint:null,charmSettings:{size:1,rotation:[0,0,0]}})
 assert.equal(error.value,'');assert.equal(activePart.value,'upper');assert.equal(form.publicationState,'draft');assert.equal(form.parts.length,2);assert.equal(painting.value,null);assert.equal(ready.value,false);assert.equal(busy.value,false);assert.equal(events[0][0],'saved')
})
