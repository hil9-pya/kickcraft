import {api} from './api.js'
const headers={'X-Requested-With':'KickCraftScan'}
export async function uploadTripoCapture(entries,onProgress,existing=null) {
 let job=existing
 try {
  if(!job)job=(await api('scans/create.php',{method:'POST',headers,body:{engine:'tripo'}})).job
  if(job.engine!=='tripo' || job.state!=='uploading')throw new Error('Start a new photo capture to upload photos.')
  onProgress(job,0,entries.length)
  for(const [index,{view,file}] of entries.entries()) {
   const body=new FormData();body.append('id',job.id);body.append('view',view);body.append('file',file)
   job=(await api('scans/upload.php',{method:'POST',headers,body})).job;onProgress(job,index+1,entries.length)
  }
  return job
 }catch(error){if(job)error.jobId=job.id;throw error}
}
export async function startTripoScan(id,useMasks=false) {return (await api('scans/start.php',{method:'POST',headers,body:{id,confirmCloud:true,maxCredits:30,useMasks}})).job}
