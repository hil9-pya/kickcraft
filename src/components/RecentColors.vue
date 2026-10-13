<script setup>
import {Button} from './ui/button'
import {recentColors,rememberColor} from '../color-history.js'
defineProps({disabled:{type:Boolean,default:false}})
const emit=defineEmits(['select'])
function select(color){rememberColor(color);emit('select',color)}
</script>
<template>
 <div v-if="recentColors.length" class="space-y-2" role="group" aria-label="Recent colors">
  <p class="text-xs font-semibold text-muted-foreground">Recent colors</p>
  <div class="flex flex-wrap gap-2"><Button v-for="color in recentColors" :key="color" type="button" variant="outline" class="h-8 w-8 p-1" :disabled="disabled" :title="color.toUpperCase()" :aria-label="'Use previous color '+color.toUpperCase()" @click="select(color)"><span class="h-full w-full border border-black/15" :style="{backgroundColor:color}" /></Button></div>
 </div>
</template>
