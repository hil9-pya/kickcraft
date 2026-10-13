import {Box3,Vector3,PerspectiveCamera,Scene,WebGLRenderer,HemisphereLight,DirectionalLight} from 'three'

export function thumbnailCamera(bounds,aspect=4/3) {
 if(bounds.isEmpty() || ![...bounds.min,...bounds.max].every(Number.isFinite)) throw new Error('Invalid shoe thumbnail bounds.')
 if(!Number.isFinite(aspect) || aspect<=0) throw new Error('Invalid thumbnail aspect ratio.')
 const radius=bounds.getSize(new Vector3()).length()/2
 if(radius<=0) throw new Error('Invalid shoe thumbnail bounds.')
 const vertical=Math.PI/9,horizontal=Math.atan(Math.tan(vertical)*aspect)
 const center=bounds.getCenter(new Vector3()),direction=new Vector3(1,0.65,1).normalize()
 const camera=new PerspectiveCamera(40,aspect)
 camera.position.copy(center).add(direction);camera.lookAt(center)
 const inverse=camera.quaternion.clone().invert()
 let distance=0
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
  const corner=new Vector3(x,y,z).sub(center).applyQuaternion(inverse)
  distance=Math.max(distance,corner.z+Math.max(Math.abs(corner.x)/Math.tan(horizontal),Math.abs(corner.y)/Math.tan(vertical))/0.85)
 }
 camera.near=radius*0.001;camera.far=distance+radius*4
 camera.position.copy(center).addScaledVector(direction,distance)
 camera.updateMatrixWorld();camera.updateProjectionMatrix()
 return camera
}

export async function captureShoeThumbnail(object) {
 object.updateWorldMatrix(true,true)
 const shoe=object.clone(true)
 shoe.matrix.copy(object.matrixWorld);shoe.matrixAutoUpdate=false;shoe.visible=true
 const scene=new Scene();scene.add(shoe)
 const camera=thumbnailCamera(new Box3().setFromObject(shoe))
 scene.add(new HemisphereLight(0xffffff,0x777777,3))
 const key=new DirectionalLight(0xffffff,2);key.position.set(1,2,3);scene.add(key)
 const renderer=new WebGLRenderer({antialias:true,alpha:true})
 try {
  renderer.setPixelRatio(1);renderer.setSize(768,576);renderer.setClearColor(0,0)
  renderer.render(scene,camera)
  return await new Promise((resolve,reject)=>renderer.domElement.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not capture the shoe thumbnail.')),'image/png'))
 }finally{renderer.dispose()}
}
