<script setup>
import { Button } from './ui/button'
defineProps({ modelValue: { type: String, default: 'parts' } })
const emit = defineEmits(['update:modelValue'])
const sections = [{id:'parts',label:'Parts & colors'},{id:'charms',label:'Charms'},{id:'size',label:'Size'}]
</script>
<template>
  <div class="studio-sections" role="group" aria-label="Customization sections">
    <Button v-for="section in sections" :key="section.id" type="button" variant="ghost" :aria-pressed="modelValue === section.id" :class="modelValue === section.id ? 'bg-secondary text-foreground' : 'text-muted-foreground'" @click="emit('update:modelValue', section.id)">{{ section.label }}</Button>
  </div>
</template>
