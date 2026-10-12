// Foreground is white (255); background is black (0), matching AliceVision masks.
export function createForegroundMask(rgba,width,height,background,tolerance=80) {
 const mask=new Uint8Array(width*height).fill(255),queue=new Int32Array(mask.length)
 let head=0,tail=0
 function visit(index) {
  if(mask[index]===0)return
  const offset=index*4
  const distance=(rgba[offset]-background[0])**2+(rgba[offset+1]-background[1])**2+(rgba[offset+2]-background[2])**2
  if(rgba[offset+3]!==0 && distance>tolerance*tolerance)return
  mask[index]=0;queue[tail++]=index
 }
 for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x)}
 for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1)}
 while(head<tail){
  const index=queue[head++],x=index%width,y=Math.floor(index/width)
  if(x>0)visit(index-1);if(x<width-1)visit(index+1)
  if(y>0)visit(index-width);if(y<height-1)visit(index+width)
 }
 return mask
}
export function paintMask(mask,width,height,x,y,radius,keep) {
 for(let py=Math.max(0,Math.floor(y-radius));py<=Math.min(height-1,Math.ceil(y+radius));py++)
  for(let px=Math.max(0,Math.floor(x-radius));px<=Math.min(width-1,Math.ceil(x+radius));px++)
   if((px-x)**2+(py-y)**2<=radius*radius)mask[py*width+px]=keep?255:0
}
export function resizeMask(mask,width,height,targetWidth,targetHeight) {
 const result=new Uint8Array(targetWidth*targetHeight)
 for(let y=0;y<targetHeight;y++)for(let x=0;x<targetWidth;x++)
  result[y*targetWidth+x]=mask[Math.floor(y*height/targetHeight)*width+Math.floor(x*width/targetWidth)]
 return result
}
export function rawMask(mask,width,height,orientation=1) {
 const swapped=orientation>=5,rawWidth=swapped?height:width,rawHeight=swapped?width:height,result=new Uint8Array(mask.length)
 for(let y=0;y<rawHeight;y++)for(let x=0;x<rawWidth;x++){
  let dx=x,dy=y
  if(orientation===2)dx=rawWidth-1-x
  if(orientation===3){dx=rawWidth-1-x;dy=rawHeight-1-y}
  if(orientation===4)dy=rawHeight-1-y
  if(orientation===5){dx=y;dy=x}
  if(orientation===6){dx=rawHeight-1-y;dy=x}
  if(orientation===7){dx=rawHeight-1-y;dy=rawWidth-1-x}
  if(orientation===8){dx=y;dy=rawWidth-1-x}
  result[y*rawWidth+x]=mask[dy*width+dx]
 }
 return result
}
export function maskCoverage(mask) {
 let kept=0;for(const value of mask)if(value===255)kept++
 return kept/mask.length
}
export async function encodeMaskPng(mask,width,height) {
 if(mask.length!==width*height)throw new Error('Mask dimensions do not match photo.')
 const rows=new Uint8Array((width+1)*height)
 for(let y=0;y<height;y++)rows.set(mask.subarray(y*width,(y+1)*width),y*(width+1)+1)
 const compressed=new Uint8Array(await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer())
 function chunk(type,data) {
  const bytes=new Uint8Array(data.length+12),view=new DataView(bytes.buffer)
  view.setUint32(0,data.length);bytes.set(new TextEncoder().encode(type),4);bytes.set(data,8)
  let crc=0xffffffff
  for(let i=4;i<bytes.length-4;i++){crc^=bytes[i];for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}
  view.setUint32(bytes.length-4,(crc^0xffffffff)>>>0)
  return bytes
 }
 const header=new Uint8Array(13),view=new DataView(header.buffer)
 view.setUint32(0,width);view.setUint32(4,height);header[8]=8
 return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',compressed),chunk('IEND',new Uint8Array())],{type:'image/png'})
}

export function displayMask(mask,width,height,orientation=1) {
 return rawMask(mask,width,height,orientation===6?8:orientation===8?6:orientation)
}
export async function readPhotoPixels(image) {
 const photo=new Image();photo.src=image.previewUrl;await photo.decode()
 const canvas=document.createElement('canvas'),ratio=Math.min(1,1600/Math.max(photo.naturalWidth,photo.naturalHeight))
 canvas.width=Math.max(1,Math.round(photo.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(photo.naturalHeight*ratio))
 const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(photo,0,0,canvas.width,canvas.height)
 return {canvas,pixels:context.getImageData(0,0,canvas.width,canvas.height).data}
}
export async function photoMaskPng(mask,width,height,image) {
 const orientation=image.orientation || 1,swapped=orientation>=5
 const upright=resizeMask(mask,width,height,swapped?image.height:image.width,swapped?image.width:image.height)
 return encodeMaskPng(rawMask(upright,swapped?image.height:image.width,swapped?image.width:image.height,orientation),image.width,image.height)
}
export async function createPhotoMask(image,background,tolerance) {
 const {canvas,pixels}=await readPhotoPixels(image)
 const mask=createForegroundMask(pixels,canvas.width,canvas.height,background,tolerance)
 const coverage=maskCoverage(mask)
 if(coverage===0 || coverage===1)throw new Error('Choose a contrasting background color or brush the mask by hand.')
 return photoMaskPng(mask,canvas.width,canvas.height,image)
}
