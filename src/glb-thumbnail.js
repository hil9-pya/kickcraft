import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {captureShoeThumbnail} from './scan-thumbnail.js'

export function validateEmbeddedGlb(bytes){
 if(bytes.byteLength<20)throw new Error('Choose a valid GLB model.')
 const view=new DataView(bytes),length=view.getUint32(12,true)
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||view.getUint32(16,true)!==0x4e4f534a||length>bytes.byteLength-20)throw new Error('Choose a valid GLB model.')
 let json
 try{json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,length)))}catch{throw new Error('Choose a valid GLB model.')}
 if([...json.buffers||[],...json.images||[]].some(resource=>resource.uri!==undefined))throw new Error('Use a GLB with embedded textures and resources.')
}
export async function thumbnailFromGlb(file){
 if(!file.size||file.size>20*1024*1024)throw new Error('GLB limit: 20 MB.')
 const bytes=await file.arrayBuffer();validateEmbeddedGlb(bytes)
 const {scene}=await new GLTFLoader().parseAsync(bytes,'')
 try{return await captureShoeThumbnail(scene)}
 finally{scene.traverse(object=>{object.geometry?.dispose();for(const material of Array.isArray(object.material)?object.material:[object.material])if(material){for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose()}})}
}
