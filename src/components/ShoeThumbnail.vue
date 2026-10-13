<script setup>
import {ref,watch} from 'vue'
const props=defineProps({src:String,image:String,alt:{type:String,required:true}})
const failed=ref(false)
watch(()=>props.src,()=>{failed.value=false})
</script>
<template>
 <div class="product-image shoe-thumbnail">
  <model-viewer v-if="src&&!failed" :src="src" :alt="alt" camera-orbit="45deg 70deg 110%" loading="lazy" interaction-prompt="none" tabindex="-1" @error="failed=true"></model-viewer>
  <img v-else-if="image" :src="image" :alt="alt" loading="lazy">
  <span v-else role="img" :aria-label="alt">Preview unavailable</span>
 </div>
</template>
<style scoped>
.shoe-thumbnail{overflow:hidden;display:grid;place-items:center}
.shoe-thumbnail model-viewer,.shoe-thumbnail img{width:100%;height:100%;min-height:0;object-fit:contain;border-radius:0}
.shoe-thumbnail span{font-size:13px;color:var(--muted-foreground)}
</style>
