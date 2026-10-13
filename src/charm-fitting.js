import {Euler,Quaternion,MathUtils} from 'three'
const originals=new WeakMap()
export function fitCharmPreview(root,point,settings){
 if(!originals.has(root))originals.set(root,{rotation:root.quaternion.clone(),scale:root.scale.clone()})
 const saved=originals.get(root)
 root.visible=!!point
 if(!point)return
 root.position.fromArray(point)
 const rotation=new Quaternion().setFromEuler(new Euler(...settings.rotation.map(MathUtils.degToRad)))
 root.quaternion.copy(saved.rotation).premultiply(rotation)
 root.scale.copy(saved.scale).multiplyScalar(settings.size)
 root.updateMatrixWorld(true)
}
