import {api} from './api.js'
export const SCAN_STORAGE_KEY='kickcraft-admin-scan-job'
export function scanStorageKey(accountId) {return accountId ? `kickcraft-scan-job-${accountId}` : SCAN_STORAGE_KEY}
export function forgetCompletedScan(glbPath,accountId=null) {
 const key=scanStorageKey(accountId)
 try {
  const id=localStorage.getItem(key)
  if(id && glbPath===`/models/uploads/scan-${id}.glb`)localStorage.removeItem(key)
 }catch{}
}
const headers={'X-Requested-With':'KickCraftScan'}
export function validateCaptureFile(file,dimensions) {
 if (!['image/jpeg','image/png'].includes(file.type)) return 'Choose JPG or PNG photographs.'
 if (!file.size || file.size>10*1024*1024) return 'Each photo must be at most 10 MB.'
 if (!dimensions || dimensions.width<1 || dimensions.height<1 || dimensions.width*dimensions.height>24000000) return 'Each photo must be at most 24 megapixels.'
 return null
}
export async function uploadCapture(files,onProgress,jobId=null) {
 let job
 try {
  job=jobId ? await fetchScanJob(jobId) : (await api('scans/create.php',{method:'POST',headers,body:{}})).job
  onProgress(job,0,files.length)
  for(const [index,file] of files.entries()) {
   const body=new FormData();body.append('id',job.id);body.append('file',file)
   job=(await api('scans/upload.php',{method:'POST',headers,body})).job
   onProgress(job,index+1,files.length)
  }
  return job
 } catch(error) {if(job) error.jobId=job.id; throw error}
}
export async function fetchScanJob(id) {return (await api('scans/status.php?id='+encodeURIComponent(id))).job}
export async function generateScanMasks(id) {return (await api('scans/ai-masks.php',{method:'POST',headers,body:{id}})).job}
export async function startScan(id,experimental=false) {return (await api('scans/start.php',{method:'POST',headers,body:{id,experimental}})).job}
export async function finalizeScan(id,payload,charmPoint) {
 const body=new FormData()
 body.append('id',id);body.append('file',new Blob([payload.glb],{type:'model/gltf-binary'}),'scan.glb')
 body.append('neutralTexture',payload.neutralTexture,'neutral.png')
 body.append('thumbnail',payload.thumbnail,'thumbnail.png')
 body.append('regions',JSON.stringify(payload.parts));body.append('charmPoint',JSON.stringify(charmPoint))
 return (await api('scans/finalize.php',{method:'POST',headers,body})).draft
}

export async function discardScan(id) {return (await api('scans/discard.php',{method:'POST',headers,body:{id}})).job}

export async function saveScanMask(id,imageId,png,reviewed=true) {
 const body=new FormData();body.append('id',id);body.append('image',imageId);body.append('file',png,'mask.png');body.append('reviewed',reviewed?'1':'0')
 return (await api('scans/mask.php',{method:'POST',headers,body})).job
}

export async function uploadScanVideo(file,onProgress,jobId=null) {
 if(!['video/mp4','video/quicktime'].includes(file.type) || !/\.(mp4|mov)$/i.test(file.name) || !file.size || file.size>300*1024*1024)throw new Error('Choose an MP4 or MOV video up to 300 MB.')
 const identity=new Blob([JSON.stringify([file.name,file.size,file.lastModified]),file.slice(0,65536),file.slice(Math.max(0,file.size-65536))])
 const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await identity.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('')
 let job
 try {
  job=jobId?await fetchScanJob(jobId):(await api('scans/create.php',{method:'POST',headers,body:{engine:'realityscan'}})).job
  if(job.engine!=='realityscan')throw new Error('Start a new capture to switch to video scanning.')
  if(job.video && (job.video.key!==key || job.video.total!==file.size))throw new Error('Reselect the same video to resume, or start a new capture.')
  if(job.state!=='uploading')return job
  let offset=job.video?.received||0
  onProgress(job,offset,file.size)
  while(offset<file.size) {
   const body=new FormData();body.append('id',job.id);body.append('key',key);body.append('offset',String(offset));body.append('total',String(file.size));body.append('name',file.name)
   body.append('file',file.slice(offset,offset+8*1024*1024),'chunk.bin')
   job=(await api('scans/video.php',{method:'POST',headers,body})).job
   if(!job.video || job.video.received<=offset)throw new Error('Upload made no progress. Reselect the same video to resume.')
   offset=job.video.received;onProgress(job,offset,file.size)
  }
  return job
 }catch(error){
  if(job){error.jobId=job.id;try{const saved=await fetchScanJob(job.id);if(saved.video?.key===key && ['queued','processing'].includes(saved.state))return saved}catch{}}
  throw error
 }
}
