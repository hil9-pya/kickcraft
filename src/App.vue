<script setup>
import { computed, nextTick, ref } from 'vue'
import { PARTS, setMaterialColor } from './customization.js'

const sizes = [7, 8, 9, 10, 11]
const colors = [
  { name: 'Chalk', value: '#f1efe8' },
  { name: 'Graphite', value: '#292b2d' },
  { name: 'Cobalt', value: '#245fa8' },
  { name: 'Rust', value: '#b94d27' },
  { name: 'Moss', value: '#52684f' },
  { name: 'Burgundy', value: '#713741' },
]

const modelViewer = ref(null)
const selectedPartId = ref(PARTS[0].id)
const partColors = ref({})
const selectedSize = ref(9)
const modelReady = ref(false)
const modelError = ref('')
const reserved = ref(false)

const selectedPart = computed(() => PARTS.find(part => part.id === selectedPartId.value))
const customizedCount = computed(() => Object.keys(partColors.value).length)
const selectedColor = computed(() => partColors.value[selectedPartId.value])

function handleModelLoad() {
  const model = modelViewer.value?.model
  const missingPart = PARTS.find(part => !model?.getMaterialByName(part.material))

  if (missingPart) {
    modelError.value = 'This shoe model cannot be customized because a required part is missing.'
    return
  }

  modelReady.value = true
  modelError.value = ''
}

function handleModelError() {
  modelReady.value = false
  modelError.value = 'The 3D shoe could not be loaded. Check the model file, then refresh the page.'
}

function chooseColor(color) {
  if (!modelReady.value) return
  if (!setMaterialColor(modelViewer.value.model, selectedPart.value.material, color.value)) return

  partColors.value = { ...partColors.value, [selectedPartId.value]: color }
}

function resetDesign() {
  if (!modelReady.value) return
  if (PARTS.every(part => setMaterialColor(modelViewer.value.model, part.material, '#ffffff'))) {
    partColors.value = {}
  }
}

function openReservation() {
  reserved.value = false
  nextTick(() => document.querySelector('#reservation-dialog')?.showModal())
}

function closeReservation() {
  document.querySelector('#reservation-dialog')?.close()
}

function submitReservation() {
  reserved.value = true
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f6f4] text-[#292b2d]">
    <header class="border-b border-[#cfd2ce] bg-[#fcfdfb]">
      <div class="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
        <a href="#studio" class="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#245fa8]">
          <span class="grid size-8 place-items-center bg-[#292b2d] text-sm font-black text-white">S</span>
          <span class="font-display text-lg font-extrabold tracking-[-0.03em]">SoleView</span>
        </a>
        <nav class="flex items-center gap-6 text-sm font-semibold" aria-label="Main navigation">
          <a href="#studio" class="hidden border-b-2 border-[#b94d27] py-5 sm:block">Design studio</a>
          <button class="h-10 border border-[#aeb2ae] px-4 hover:border-[#292b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]" @click="openReservation">Reserve</button>
        </nav>
      </div>
    </header>

    <main id="studio" class="mx-auto max-w-[1480px] px-5 py-7 lg:px-8 lg:py-10">
      <div class="mb-7 grid gap-4 border-b border-[#cfd2ce] pb-7 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p class="mb-2 text-sm font-semibold text-[#6a6e6a]">Original concept / SoleView One</p>
          <h1 class="font-display max-w-4xl text-4xl font-black leading-[0.95] tracking-[-0.045em] text-[#202220] sm:text-5xl lg:text-6xl">Shape the color. Keep the character.</h1>
        </div>
        <p class="max-w-sm text-sm leading-6 text-[#5f635f] md:text-right">Select a shoe part, choose its finish, then rotate the model to inspect your design from every side.</p>
      </div>

      <section class="grid overflow-hidden border border-[#bfc3bf] bg-[#fcfdfb] lg:grid-cols-[minmax(0,1.55fr)_minmax(380px,.72fr)]">
        <div class="relative min-h-[430px] overflow-hidden border-b border-[#bfc3bf] bg-[#e9ece9] lg:min-h-[720px] lg:border-b-0 lg:border-r">
          <model-viewer
            ref="modelViewer"
            src="/models/shoe-soleview-final.glb"
            alt="Interactive customizable 3D SoleView concept shoe"
            camera-controls
            touch-action="pan-y"
            shadow-intensity="1"
            shadow-softness="1"
            exposure="1"
            environment-image="neutral"
            interaction-prompt="auto"
            @load="handleModelLoad"
            @error="handleModelError"
          />

          <div v-if="!modelReady && !modelError" class="pointer-events-none absolute inset-0 grid place-items-center bg-[#e9ece9]/90" role="status">
            <div class="flex items-center gap-3 border border-[#bfc3bf] bg-[#fcfdfb] px-4 py-3 text-sm font-semibold">
              <span class="size-3 animate-pulse bg-[#b94d27]" />
              Loading customizable shoe
            </div>
          </div>

          <div v-if="modelError" class="absolute inset-0 grid place-items-center bg-[#e9ece9] p-8" role="alert">
            <div class="max-w-md border-l-4 border-[#b94d27] bg-[#fcfdfb] p-5">
              <h2 class="font-display text-lg font-bold">3D model unavailable</h2>
              <p class="mt-2 text-sm leading-6 text-[#5f635f]">{{ modelError }}</p>
            </div>
          </div>

          <div class="pointer-events-none absolute left-4 top-4 flex items-center gap-2 bg-[#fcfdfb]/95 px-3 py-2 text-xs font-semibold">
            <span class="size-2" :class="modelReady ? 'bg-[#3f7652]' : 'bg-[#9b9f9b]'" />
            {{ modelReady ? '3D model ready' : 'Preparing model' }}
          </div>
          <div class="pointer-events-none absolute bottom-4 left-4 bg-[#292b2d]/90 px-3 py-2 text-xs font-semibold text-white">Drag to rotate · Scroll to zoom</div>
        </div>

        <div class="flex flex-col">
          <div class="border-b border-[#d9dcd8] p-6 lg:p-7">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="font-display text-3xl font-black tracking-[-0.04em] text-[#202220]">SoleView One</h2>
                <p class="mt-2 text-sm leading-6 text-[#626662]">Our first original customizable sneaker concept.</p>
              </div>
              <p class="shrink-0 text-xl font-black text-[#b94d27]">₱4,890</p>
            </div>
          </div>

          <div class="space-y-6 p-6 lg:p-7">
            <fieldset :disabled="!modelReady">
              <div class="mb-3 flex items-center justify-between gap-4">
                <legend class="font-display text-base font-bold">Customize part</legend>
                <span class="text-xs font-semibold text-[#696d69]">Editing: {{ selectedPart.label }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="part in PARTS"
                  :key="part.id"
                  type="button"
                  class="flex min-h-11 items-center justify-between border px-3 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                  :class="selectedPartId === part.id ? 'border-[#292b2d] bg-[#292b2d] text-white' : 'border-[#c5c9c5] bg-white hover:border-[#6f746f]'"
                  :aria-pressed="selectedPartId === part.id"
                  @click="selectedPartId = part.id"
                >
                  {{ part.label }}
                  <span class="size-3 border border-current/25" :style="{ backgroundColor: partColors[part.id]?.value || '#ffffff' }" />
                </button>
              </div>
            </fieldset>

            <fieldset :disabled="!modelReady">
              <div class="mb-3 flex items-center justify-between gap-4">
                <legend class="font-display text-base font-bold">Choose color</legend>
                <span class="text-xs font-semibold text-[#696d69]">{{ selectedColor?.name || 'Neutral' }}</span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="color in colors"
                  :key="color.name"
                  type="button"
                  class="flex min-h-12 items-center gap-2 border bg-white px-2.5 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                  :class="selectedColor?.value === color.value ? 'border-[#292b2d] ring-1 ring-[#292b2d]' : 'border-[#c5c9c5] hover:border-[#6f746f]'"
                  :aria-pressed="selectedColor?.value === color.value"
                  @click="chooseColor(color)"
                >
                  <span class="size-5 shrink-0 border border-black/15" :style="{ backgroundColor: color.value }" />
                  {{ color.name }}
                </button>
              </div>
            </fieldset>

            <div class="flex items-center justify-between border-y border-[#d9dcd8] py-3 text-sm">
              <span><strong>{{ customizedCount }}</strong> of {{ PARTS.length }} parts customized</span>
              <button
                type="button"
                class="font-semibold text-[#245fa8] underline underline-offset-4 disabled:cursor-not-allowed disabled:text-[#9b9f9b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                :disabled="!modelReady || customizedCount === 0"
                @click="resetDesign"
              >Reset design</button>
            </div>

            <fieldset>
              <div class="mb-3 flex items-center justify-between">
                <legend class="font-display text-base font-bold">Select size</legend>
                <span class="text-xs text-[#696d69]">US sizing</span>
              </div>
              <div class="grid grid-cols-5 gap-2">
                <button
                  v-for="size in sizes"
                  :key="size"
                  type="button"
                  class="h-11 border text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                  :class="selectedSize === size ? 'border-[#b94d27] bg-[#fff3ed] text-[#8f361b]' : 'border-[#c5c9c5] bg-white hover:border-[#6f746f]'"
                  :aria-pressed="selectedSize === size"
                  @click="selectedSize = size"
                >{{ size }}</button>
              </div>
            </fieldset>
          </div>

          <div class="mt-auto border-t border-[#d9dcd8] bg-[#f1f3f0] p-6 lg:p-7">
            <p class="mb-3 text-sm text-[#5f635f]">Pickup reservation · Your current colors and size are included.</p>
            <button type="button" class="h-12 w-full bg-[#b94d27] px-5 font-bold text-white hover:bg-[#963a20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]" @click="openReservation">Reserve this design</button>
          </div>
        </div>
      </section>

      <section class="grid border-x border-b border-[#bfc3bf] bg-[#292b2d] text-white sm:grid-cols-3" aria-label="Reservation process">
        <div class="border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><p class="font-display font-bold">1. Customize</p><p class="mt-1 text-sm text-white/65">Color any of the eight shoe parts.</p></div>
        <div class="border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><p class="font-display font-bold">2. Inspect</p><p class="mt-1 text-sm text-white/65">Rotate and zoom before choosing a size.</p></div>
        <div class="p-5"><p class="font-display font-bold">3. Reserve</p><p class="mt-1 text-sm text-white/65">Save the design for in-store pickup.</p></div>
      </section>
    </main>

    <dialog id="reservation-dialog" class="m-auto w-[calc(100%_-_32px)] max-w-md border border-[#8e938e] bg-[#fcfdfb] p-0 text-[#292b2d]">
      <div v-if="!reserved" class="p-6">
        <div class="flex items-start justify-between gap-4 border-b border-[#d9dcd8] pb-4">
          <div><h2 class="font-display text-xl font-black">Reserve your SoleView One</h2><p class="mt-1 text-sm text-[#626662]">Size {{ selectedSize }} · {{ customizedCount }} customized parts</p></div>
          <button class="grid size-9 place-items-center border border-[#bfc3bf] text-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]" aria-label="Close reservation" @click="closeReservation">×</button>
        </div>
        <form class="space-y-4 pt-5" @submit.prevent="submitReservation">
          <label class="block"><span class="mb-1.5 block text-sm font-bold">Full name</span><input required autocomplete="name" class="h-11 w-full border border-[#bfc3bf] bg-white px-3 outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]" /></label>
          <label class="block"><span class="mb-1.5 block text-sm font-bold">Email address</span><input required type="email" autocomplete="email" class="h-11 w-full border border-[#bfc3bf] bg-white px-3 outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]" /></label>
          <label class="block"><span class="mb-1.5 block text-sm font-bold">Pickup date</span><input required type="date" class="h-11 w-full border border-[#bfc3bf] bg-white px-3 outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]" /></label>
          <button class="h-12 w-full bg-[#b94d27] font-bold text-white hover:bg-[#963a20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]">Confirm reservation</button>
        </form>
      </div>
      <div v-else class="p-8 text-center">
        <div class="mx-auto grid size-12 place-items-center bg-[#3f7652] text-xl font-black text-white">✓</div>
        <h2 class="font-display mt-5 text-xl font-black">Reservation confirmed</h2>
        <p class="mt-2 text-sm leading-6 text-[#626662]">Your custom SoleView One in size {{ selectedSize }} is recorded for pickup.</p>
        <button class="mt-6 h-11 w-full border border-[#8e938e] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]" @click="closeReservation">Continue designing</button>
      </div>
    </dialog>
  </div>
</template>
