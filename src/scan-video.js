export function validateVideoInput(file,metadata) {
 if(!file || !['video/mp4','video/webm','video/quicktime'].includes(file.type))return 'Choose an MP4, WebM, or MOV video your browser can play.'
 if(!file.size || file.size>300*1024*1024)return 'Video must be at most 300 MB.'
 if(metadata){
  const {duration,width,height}=metadata
  if(!Number.isFinite(duration) || duration<15 || duration>180)return 'Record 15–180 seconds. Aim for 45–90 seconds around all sides and heights.'
  if(!Number.isFinite(width) || !Number.isFinite(height) || width<640 || height<640 || width*height>12000000)return 'Use a clear video with both dimensions at least 640 pixels and at most 12 megapixels per frame.'
 }
 return null
}

export function analyzeVideoFrame({data,width,height}) {
 if(width<16 || height<16 || data.length!==width*height*4)throw new Error('Invalid decoded video frame.')
 const gray=new Float32Array(width*height),signature=new Uint8Array(256)
 let sum=0,squares=0,clipped=0,lapSum=0,lapSquares=0
 for(let i=0;i<gray.length;i++){
  const value=data[i*4]*.2126+data[i*4+1]*.7152+data[i*4+2]*.0722
  gray[i]=value;sum+=value;squares+=value*value;if(value<5 || value>250)clipped++
 }
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x,lap=gray[i-1]+gray[i+1]+gray[i-width]+gray[i+width]-4*gray[i]
  lapSum+=lap;lapSquares+=lap*lap
 }
 for(let by=0;by<16;by++)for(let bx=0;bx<16;bx++){
  let total=0,count=0
  for(let y=Math.floor(by*height/16);y<Math.floor((by+1)*height/16);y++)for(let x=Math.floor(bx*width/16);x<Math.floor((bx+1)*width/16);x++){total+=gray[y*width+x];count++}
  signature[by*16+bx]=Math.round(total/count)
 }
 const mean=sum/gray.length,n=(width-2)*(height-2)
 return {mean,contrast:Math.sqrt(Math.max(0,squares/gray.length-mean*mean)),clipped:clipped/gray.length,sharpness:Math.max(0,lapSquares/n-(lapSum/n)**2),signature}
}
function difference(a,b){let total=0;for(let i=0;i<256;i++)total+=Math.abs(a[i]-b[i]);return total/256}
export function selectVideoFrames(candidates,duration,maxFrames=60) {
 const count=Math.min(60,Math.floor(maxFrames))
 if(!Number.isFinite(count) || count<30)throw new Error('Make room for at least 30 video frames; remove selected photos or start a new capture.')
 const bins=Array.from({length:count},()=>[])
 for(const frame of candidates){
  if(!Number.isFinite(frame.time) || frame.time<0 || frame.time>=duration || !Number.isFinite(frame.sharpness) || frame.sharpness<8 || frame.mean<18 || frame.mean>238 || frame.contrast<8 || frame.clipped>.98 || frame.signature?.length!==256)continue
  bins[Math.min(count-1,Math.floor(frame.time/duration*count))].push(frame)
 }
 const picked=[];let gap=0,longestGap=0
 for(const bin of bins){
  const frame=bin.sort((a,b)=>b.sharpness-a.sharpness).find(frame=>picked.every(other=>difference(frame.signature,other.signature)>=2.5))
  if(frame){picked.push(frame);gap=0}else{gap++;longestGap=Math.max(longestGap,gap)}
 }
 if(picked.length<30)throw new Error(`Only ${picked.length} sharp, distinct frames found. Recapture slowly in good light, moving around a stationary shoe.`)
 if(longestGap>Math.max(3,Math.ceil(count*.1)))throw new Error('Large gaps in usable video coverage. Recapture slowly with sharp views throughout all three rings.')
 return picked.sort((a,b)=>a.time-b.time)
}
function checkAbort(signal){if(signal?.aborted)throw new DOMException('Frame selection canceled.','AbortError')}
function videoEvent(video,event,signal) {
 return new Promise((resolve,reject)=>{
  let timeout
  const clean=()=>{clearTimeout(timeout);video.removeEventListener(event,done);video.removeEventListener('error',failed);signal?.removeEventListener('abort',aborted)}
  const done=()=>{clean();resolve()}
  const failed=()=>{clean();reject(new Error('Browser cannot decode this video. Export MP4 with H.264, or choose original photos.'))}
  const aborted=()=>{clean();reject(new DOMException('Frame selection canceled.','AbortError'))}
  video.addEventListener(event,done,{once:true});video.addEventListener('error',failed,{once:true});signal?.addEventListener('abort',aborted,{once:true})
  timeout=setTimeout(failed,15000)
  if(signal?.aborted)aborted()
 })
}
async function seek(video,time,signal) {
 checkAbort(signal)
 if(Math.abs(video.currentTime-time)<.001 && video.readyState>=2)return
 const waiting=videoEvent(video,'seeked',signal);video.currentTime=time;await waiting;checkAbort(signal)
}
export async function extractVideoFrames(file,{signal,onProgress=()=>{},maxFrames=60}={}) {
 const invalid=validateVideoInput(file);if(invalid)throw new Error(invalid)
 checkAbort(signal)
 const video=document.createElement('video'),url=URL.createObjectURL(file)
 video.muted=true;video.playsInline=true;video.preload='auto'
 try {
  const loaded=videoEvent(video,'loadedmetadata',signal);video.src=url;video.load();await loaded;checkAbort(signal)
  const metadata={duration:video.duration,width:video.videoWidth,height:video.videoHeight},message=validateVideoInput(file,metadata)
  if(message)throw new Error(message)
  const count=Math.min(60,Math.floor(maxFrames));if(count<30)throw new Error('Make room for at least 30 video frames.')
  const quality=document.createElement('canvas');quality.width=160;quality.height=160
  const qualityContext=quality.getContext('2d',{willReadFrequently:true});if(!qualityContext)throw new Error('Browser cannot read video frames.')
  const candidates=[],samples=count*3
  for(let i=0;i<samples;i++){
   const time=metadata.duration*(i+.5)/samples;await seek(video,time,signal)
   qualityContext.drawImage(video,metadata.width*.1,metadata.height*.1,metadata.width*.8,metadata.height*.8,0,0,160,160)
   candidates.push({time,...analyzeVideoFrame(qualityContext.getImageData(0,0,160,160))})
   onProgress({stage:'Checking sharpness and movement',done:i+1,total:samples})
  }
  const selected=selectVideoFrames(candidates,metadata.duration,count),canvas=document.createElement('canvas')
  const scale=Math.min(1,1920/Math.max(metadata.width,metadata.height));canvas.width=Math.round(metadata.width*scale);canvas.height=Math.round(metadata.height*scale)
  const context=canvas.getContext('2d');if(!context)throw new Error('Browser cannot prepare video frames.')
  const files=[],name=file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,35)||'shoe'
  for(const [index,frame] of selected.entries()){
   await seek(video,frame.time,signal);context.drawImage(video,0,0,canvas.width,canvas.height)
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));checkAbort(signal)
   if(!blob || blob.size>10*1024*1024)throw new Error('Cannot prepare a video frame within the 10 MB photo limit.')
   files.push(new File([blob],`video-${name}-${String(index+1).padStart(3,'0')}-${frame.time.toFixed(2)}s.jpg`,{type:'image/jpeg'}))
   onProgress({stage:'Preparing selected frames',done:index+1,total:selected.length})
  }
  return {files,...metadata}
 }finally{video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(url)}
}
