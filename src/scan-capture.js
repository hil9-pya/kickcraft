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
export async function fetchScanJob(id) {return (await api('scans/status.php?id='+encodeURIComponent(id))).job}
export async function generateScanMasks(id) {return (await api('scans/ai-masks.php',{method:'POST',headers,body:{id}})).job}
export async function finalizeScan(id,payload,charmPoint,charmSettings) {
 const body=new FormData()
 body.append('id',id);body.append('file',new Blob([payload.glb],{type:'model/gltf-binary'}),'scan.glb')
 body.append('neutralTexture',payload.neutralTexture,'neutral.png')
 body.append('thumbnail',payload.thumbnail,'thumbnail.png')
 if(charmSettings)body.append('charmSettings',JSON.stringify(charmSettings))
 body.append('regions',JSON.stringify(payload.parts));body.append('charmPoint',JSON.stringify(charmPoint))
 return (await api('scans/finalize.php',{method:'POST',headers,body})).draft
}

export async function discardScan(id) {return (await api('scans/discard.php',{method:'POST',headers,body:{id}})).job}

export async function saveScanMask(id,imageId,png,reviewed=true) {
 const body=new FormData();body.append('id',id);body.append('image',imageId);body.append('file',png,'mask.png');body.append('reviewed',reviewed?'1':'0')
 return (await api('scans/mask.php',{method:'POST',headers,body})).job
}
