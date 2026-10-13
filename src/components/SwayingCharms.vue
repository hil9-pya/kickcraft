<script setup>
import {computed,onMounted,onBeforeUnmount,shallowRef,watch} from 'vue'
import {charmScale} from '../customization.js'
import {addCharmSway,attachCharmSway} from '../charm-sway.js'
const props=defineProps({viewer:{default:null},charms:{type:Array,required:true},selected:{type:String,required:true},offset:{default:null},scale:{type:String,default:'1 1 1'}})
const prepared=shallowRef(new Map())
const models=computed(()=>props.charms.map(charm=>({...charm,src:prepared.value.get(charm.src)||charm.src,animated:prepared.value.has(charm.src)})))
let abort,disposed=false,stop=()=>{},urls=[]
onMounted(()=>{
 watch(()=>props.charms.map(charm=>charm.src),async sources=>{
  abort?.abort();abort=new AbortController();const signal=abort.signal,next=[]
  const entries=await Promise.all(sources.map(async source=>{
   try{
    if(!source.startsWith('/models/')||source.includes('..'))throw new Error('Unsupported charm source.')
    const response=await fetch(source,{signal});if(!response.ok)throw new Error('Charm unavailable.')
    const blob=new Blob([addCharmSway(await response.arrayBuffer())],{type:'model/gltf-binary'}),url=URL.createObjectURL(blob);next.push(url);return [source,url]
   }catch{return null} // Keep original static charm if local animation preparation fails.
  }))
  if(disposed||signal.aborted){next.forEach(url=>URL.revokeObjectURL(url));return}
  const previous=urls;urls=next;prepared.value=new Map(entries.filter(Boolean));previous.forEach(url=>URL.revokeObjectURL(url))
 },{immediate:true})
 watch([()=>props.viewer,()=>props.selected,models],()=>{
  stop();stop=()=>{}
  const index=models.value.findIndex(charm=>charm.id===props.selected&&charm.animated)
  if(props.viewer&&index>=0)stop=attachCharmSway(props.viewer,index+1)
 },{immediate:true,flush:'post'})
})
onBeforeUnmount(()=>{disposed=true;abort?.abort();stop();urls.forEach(url=>URL.revokeObjectURL(url))})
</script>
<template>
 <extra-model v-for="charm in models" :key="charm.id" :src="charm.src" :offset="offset" :scale="charmScale(charm.id,selected,scale)" />
</template>
