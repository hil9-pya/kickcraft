import test from 'node:test'
import assert from 'node:assert/strict'
import {Box3,Vector3} from 'three'
import {thumbnailCamera} from '../src/scan-thumbnail.js'

test('thumbnail framing keeps every bound inside padding for wide, tall and offset shoes',()=>{
 for(const size of [[3,1,1],[1,3,1],[1,1,4],[0.001,0.0003,0.0005],[100,20,40]])for(const aspect of [4/3,1,0.6]){
  const center=new Vector3(7,-3,2),half=new Vector3(...size).multiplyScalar(0.5)
  const box=new Box3(center.clone().sub(half),center.clone().add(half))
  const camera=thumbnailCamera(box,aspect)
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
   const point=new Vector3(x,y,z).project(camera)
   assert.ok(Math.abs(point.x)<0.88 && Math.abs(point.y)<0.88,'shoe must fit with padding')
   assert.ok(point.z>-1 && point.z<1,'shoe must fit between clipping planes')
  }
 }
})
test('empty or invalid thumbnail bounds fail instead of saving a blank image',()=>{
 assert.throws(()=>thumbnailCamera(new Box3(),4/3),/bounds/)
 assert.throws(()=>thumbnailCamera(new Box3(new Vector3(),new Vector3(1,1,1)),0),/aspect/)
})
