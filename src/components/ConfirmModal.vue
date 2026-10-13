<script setup>
import { ref, watch } from 'vue'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  confirmText: {
    type: String,
    default: 'Confirm',
  },
  cancelText: {
    type: String,
    default: 'Cancel',
  },
  variant: {
    type: String,
    default: 'default',
    validator: value => ['danger', 'warning', 'default'].includes(value),
  },
  icon: {
    type: String,
    default: 'warning',
    validator: value => ['logout', 'trash', 'reset', 'warning'].includes(value),
  },
})


const emit = defineEmits(['confirm', 'cancel'])
const cancelButtonRef = ref(null)
let previousFocus
watch(() => props.show, open => { if (open && typeof document !== 'undefined') previousFocus = document.activeElement }, { immediate: true })
function restoreFocus() { if (previousFocus?.isConnected) previousFocus.focus() }
</script>

<template>
  <Dialog :open="show" @update:open="open => { if (!open) emit('cancel') }">
    <DialogContent class="max-w-md sm:max-w-md" :show-close-button="false" @open-auto-focus.prevent="cancelButtonRef?.$el?.focus()" @close-auto-focus.prevent="restoreFocus">
      <DialogHeader>
        <div class="mb-2 text-primary [&_svg]:size-6" aria-hidden="true">
          <svg
            v-if="icon === 'logout'"
            class="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>

          <!-- Trash / Danger Icon -->
          <svg
            v-else-if="icon === 'trash'"
            class="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>

          <!-- Reset Icon -->
          <svg
            v-else-if="icon === 'reset'"
            class="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <polyline points="3 3 3 8 8 8" />
          </svg>

          <!-- Warning / Default Alert Icon -->
          <svg
            v-else
            class="size-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <DialogTitle class="font-display text-xl">{{ title }}</DialogTitle>
        <DialogDescription class="text-sm leading-6">{{ message }}</DialogDescription>
      </DialogHeader>
      <DialogFooter class="mt-2">
        <Button ref="cancelButtonRef" type="button" variant="outline" @click="emit('cancel')">{{ cancelText }}</Button>
        <Button type="button" :variant="variant === 'danger' ? 'destructive' : 'default'" @click="emit('confirm')">{{ confirmText }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
