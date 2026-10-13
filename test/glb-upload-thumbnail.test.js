import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {validateEmbeddedGlb} from '../src/glb-thumbnail.js'
function glb(json){const text=Buffer.from(JSON.stringify(json));const padded=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);return Uint8Array.from(Buffer.concat([header,padded])).buffer}
function method(name,end,bindings){const code=readFileSync(new URL('../src/components/SellerDashboard.vue',import.meta.url),'utf8');const start=code.indexOf('async function '+name+'(');return new Function(...Object.keys(bindings),code.slice(start,code.indexOf(end,start))+';return '+name)(...Object.values(bindings))}
test('thumbnail loader rejects malformed or externally referenced GLBs before loading resources',()=>{
 assert.doesNotThrow(()=>validateEmbeddedGlb(glb({asset:{version:'2.0'},buffers:[{byteLength:0}],images:[{bufferView:0,mimeType:'image/png'}]})))
 for(const json of [{buffers:[{uri:'https://external.invalid/model.bin'}]},{images:[{uri:'file:///private.png'}]},{images:[{uri:'data:image/png;base64,abc'}]}])assert.throws(()=>validateEmbeddedGlb(glb(json)),/embedded/)
 assert.throws(()=>validateEmbeddedGlb(new ArrayBuffer(4)),/valid GLB/)
})
test('GLB upload sends automatic thumbnail without requiring a custom file',async()=>{
 const auto=new Blob(['automatic'],{type:'image/png'}),custom=new Blob(['custom'],{type:'image/png'})
 const thumbnail={value:null},busy={value:false},error={value:''},editing={value:null},uploading={value:true}
 let submitted=0,cleared=0
 const bindings={glb:{value:new Blob(['glb'])},thumbnail,autoThumbnail:{value:auto},thumbnailPreparing:{value:false},busy,error,editing,uploading,FormData,api:async(path,{body})=>{assert.equal(path,'products/upload.php');assert.equal(await body.get('thumbnail').text(),thumbnail.value?'custom':'automatic');submitted++;return {shoe:{id:'uploaded'}}},clearUploadThumbnail(){cleared++},refresh:async()=>{}}
 await method('upload','async function saveStore(',bindings)()
 assert.equal(submitted,1);assert.equal(editing.value.id,'uploaded');assert.equal(cleared,1)
 bindings.glb.value=new Blob(['glb']);thumbnail.value=custom
 await method('upload','async function saveStore(',bindings)()
 assert.equal(submitted,2)
 bindings.glb.value=new Blob(['glb']);bindings.autoThumbnail.value=null
 await method('upload','async function saveStore(',bindings)()
 assert.equal(submitted,2);assert.match(error.value,/thumbnail/i)
})

test('late thumbnail result cannot replace a newer selection',async()=>{
 let resolveCapture,shown=0
 const uploadSelection={value:0},thumbnailPreparing={value:false},autoThumbnail={value:null},error={value:''}
 const bindings={glb:{value:null},thumbnail:{value:null},autoThumbnail,thumbnailPreparing,uploadSelection,error,closed:false,clearUploadThumbnail(){uploadSelection.value++;autoThumbnail.value=null},thumbnailFromGlb:()=>new Promise(resolve=>{resolveCapture=resolve}),showUploadThumbnail(){shown++}}
 const pending=method('chooseGlb','function chooseThumbnail(',bindings)({target:{files:[{name:'shoe.glb',size:100}]}})
 uploadSelection.value++;resolveCapture(new Blob(['old']))
 await pending;assert.equal(shown,0);assert.equal(autoThumbnail.value,null)
})
test('capture failure gives custom PNG fallback and ends loading state',async()=>{
 const error={value:''},thumbnailPreparing={value:false}
 const bindings={glb:{value:null},thumbnail:{value:null},autoThumbnail:{value:null},uploadSelection:{value:1},thumbnailPreparing,error,closed:false,clearUploadThumbnail(){},thumbnailFromGlb:async()=>{throw Error('WebGL unavailable')},showUploadThumbnail(){throw Error('Must not show failed preview')}}
 await method('chooseGlb','function chooseThumbnail(',bindings)({target:{files:[{name:'shoe.glb',size:100}]}})
 assert.equal(thumbnailPreparing.value,false);assert.match(error.value,/custom PNG/)
})
