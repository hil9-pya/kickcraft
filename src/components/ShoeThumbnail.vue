<script setup>
import {ref,computed,watch,onMounted,onBeforeUnmount} from 'vue'
const props=defineProps({src:String,image:String,alt:{type:String,required:true}})
const host=ref(null),failed=ref(false),visited=ref(false),ready=ref(false),motion=ref(false),hovered=ref(false),focused=ref(false)
const active=computed(()=>motion.value&&(hovered.value||focused.value))
const orbit=computed(()=>active.value&&ready.value?'5deg 70deg 110%':'45deg 70deg 110%')
let card,media
function enter(){hovered.value=true;if(motion.value)visited.value=true}
function leave(){hovered.value=false}
function focus(){focused.value=true;if(motion.value)visited.value=true}
function blur(event){if(!card?.contains(event.relatedTarget))focused.value=false}
function updateMotion(){motion.value=media.matches}
watch(()=>props.src,()=>{failed.value=false;ready.value=false;visited.value=active.value})
onMounted(()=>{
 media=window.matchMedia('(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)')
 updateMotion();media.addEventListener('change',updateMotion)
 card=host.value.closest('button.kc-catalog-card, article')||host.value
 for(const [event,handler] of [['mouseenter',enter],['mouseleave',leave],['focusin',focus],['focusout',blur]])card.addEventListener(event,handler)
})
onBeforeUnmount(()=>{
 media?.removeEventListener('change',updateMotion)
 for(const [event,handler] of [['mouseenter',enter],['mouseleave',leave],['focusin',focus],['focusout',blur]])card?.removeEventListener(event,handler)
})
</script>
<template>
 <div ref="host" class="product-image shoe-thumbnail thumbnail-stage" :data-active="active">
  <model-viewer v-if="src&&!failed&&(visited||!image)" :src="src" :poster="image" :alt="alt" :camera-orbit="orbit" :interpolation-decay="motion?(active?180:130):0" :loading="visited?'eager':'lazy'" interaction-prompt="none" tabindex="-1" @load="ready=true" @error="failed=true"></model-viewer>
  <img v-else-if="image" :src="image" :alt="alt" loading="lazy">
  <span v-else role="img" :aria-label="alt">Preview unavailable</span>
 </div>
</template>
<style scoped>
.shoe-thumbnail{overflow:hidden;display:grid;place-items:center}
.shoe-thumbnail model-viewer,.shoe-thumbnail img{width:100%;height:100%;min-height:0;object-fit:contain;border-radius:0;pointer-events:none}
.shoe-thumbnail span{font-size:13px;color:var(--muted-foreground)}
</style>
