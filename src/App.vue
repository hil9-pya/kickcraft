<script setup>
import { computed, nextTick, ref } from 'vue'
import {
  CATALOG,
  CATEGORIES,
  CHARMS,
  SHOES,
  charmScale,
  charmSource,
  filterCatalog,
  setMaterialColor,
} from './customization.js'

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
const selectedShoeId = ref(SHOES[0].id)
const selectedShoe = computed(() => SHOES.find(shoe => shoe.id === selectedShoeId.value) || SHOES[0])
const selectedParts = computed(() => selectedShoe.value.parts)
const selectedPartId = ref(selectedParts.value[0].id)
const selectedCharmId = ref('none')
const partColors = ref({})
const selectedSize = ref(9)
const modelReady = ref(false)
const modelError = ref('')
const reserved = ref(false)

const selectedPart = computed(() => selectedParts.value.find(part => part.id === selectedPartId.value))
const selectedCharm = computed(() => CHARMS.find(charm => charm.id === selectedCharmId.value))
const customizedCount = computed(() => Object.keys(partColors.value).length)
const selectedColor = computed(() => partColors.value[selectedPartId.value])
const charmModels = computed(() => CHARMS
  .filter(charm => charm.src)
  .map(charm => ({ ...charm, src: charmSource(charm, selectedShoe.value) })))

const searchQuery = ref('')
const activeCategory = ref('all')

const filteredCatalog = computed(() => {
  return filterCatalog(CATALOG, searchQuery.value, activeCategory.value)
})

function clearFilters() {
  searchQuery.value = ''
  activeCategory.value = 'all'
}

function handleModelLoad() {
  const model = modelViewer.value?.model
  const missingPart = selectedParts.value.find(part => !model?.getMaterialByName(part.material))

  if (missingPart) {
    modelError.value = 'This shoe model cannot be customized because a required part is missing.'
    return
  }

  modelReady.value = true
  modelError.value = ''

  for (const [partId, color] of Object.entries(partColors.value)) {
    const part = selectedParts.value.find(p => p.id === partId)
    if (part && color?.value) {
      setMaterialColor(model, part.material, color.value)
    }
  }
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
  if (selectedParts.value.every(part => setMaterialColor(modelViewer.value.model, part.material, '#ffffff'))) {
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

// ── View routing ──────────────────────────────────────────────
const view = ref('shop') // 'shop' | 'studio'

function resetStudioState() {
  partColors.value = {}
  selectedCharmId.value = 'none'
  selectedPartId.value = selectedParts.value[0].id
  selectedSize.value = 9
  modelReady.value = false
  modelError.value = ''
  reserved.value = false
}

function goToStudio(shoeId) {
  selectedShoeId.value = shoeId
  resetStudioState()
  view.value = 'studio'
}

function goToShop() {
  selectedShoeId.value = SHOES[0].id
  resetStudioState()
  view.value = 'shop'
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="min-h-screen bg-[#f5f6f4] text-[#292b2d]">

    <!-- ── Header ───────────────────────────────────────────── -->
    <header class="border-b border-[#cfd2ce] bg-[#fcfdfb]">
      <div class="mx-auto flex h-16 max-w-[1480px] items-center justify-between px-5 lg:px-8">
        <button
          class="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#245fa8]"
          @click="goToShop"
        >
          <span class="grid size-8 place-items-center bg-[#292b2d] text-sm font-black text-white">K</span>
          <span class="font-display text-lg font-extrabold tracking-[-0.03em]">KickCraft</span>
        </button>
        <nav class="flex items-center gap-6 text-sm font-semibold" aria-label="Main navigation">
          <!-- Shop view nav -->
          <template v-if="view === 'shop'">
            <span class="hidden border-b-2 border-[#b94d27] py-5 sm:block">Shop</span>
          </template>
          <!-- Studio view nav -->
          <template v-else>
            <button
              class="hidden items-center gap-1.5 text-[#5f635f] hover:text-[#292b2d] sm:flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              @click="goToShop"
            >
              <svg class="size-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Back to shop
            </button>
            <span class="hidden border-b-2 border-[#b94d27] py-5 sm:block">Design studio</span>
            <button
              class="h-10 border border-[#aeb2ae] px-4 hover:border-[#292b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              @click="openReservation"
            >Order</button>
          </template>
        </nav>
      </div>
    </header>

    <!-- ══════════════════════════════════════════════════════ -->
    <!-- SHOP VIEW                                              -->
    <!-- ══════════════════════════════════════════════════════ -->
    <main v-if="view === 'shop'" class="mx-auto max-w-[1480px] px-5 py-10 lg:px-8 lg:py-14">

      <!-- Hero -->
      <div class="mb-10 border-b border-[#cfd2ce] pb-10">
        <p class="mb-2 text-sm font-semibold text-[#6a6e6a]">Original silhouettes / One design studio</p>
        <h1 class="font-display max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.045em] text-[#202220] sm:text-5xl lg:text-6xl">
          Shape the color.<br>Keep the character.
        </h1>
        <p class="mt-5 max-w-md text-sm leading-6 text-[#5f635f]">
          Design your own sneaker by recoloring its editable parts, attaching a 3D charm, and ordering it for in-store pickup.
        </p>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="mb-8 space-y-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <!-- Search input -->
          <div class="relative w-full sm:max-w-md">
            <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#6a6e6a]">
              <svg class="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
              </svg>
            </span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search styles by name or description…"
              class="h-11 w-full border border-[#bfc3bf] bg-[#fcfdfb] pl-10 pr-10 text-sm text-[#292b2d] placeholder-[#8e938e] outline-none transition-colors focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
              aria-label="Search styles by name or description"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute inset-y-0 right-0 flex items-center pr-3 text-[#6a6e6a] hover:text-[#292b2d] focus-visible:outline-none"
              aria-label="Clear search"
              @click="searchQuery = ''"
            >
              <svg class="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>

          <!-- Results counter -->
          <div class="text-xs font-semibold text-[#6a6e6a]">
            Showing <span class="font-bold text-[#202220]">{{ filteredCatalog.length }}</span> {{ filteredCatalog.length === 1 ? 'shoe' : 'shoes' }}
          </div>
        </div>

        <!-- Category pills -->
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Category filter pills">
          <button
            v-for="cat in CATEGORIES"
            :key="cat.id"
            type="button"
            class="px-3.5 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
            :class="activeCategory === cat.id ? 'bg-[#292b2d] text-white' : 'bg-[#fcfdfb] text-[#5f635f] border border-[#bfc3bf] hover:border-[#292b2d]'"
            :aria-pressed="activeCategory === cat.id"
            @click="activeCategory = cat.id"
          >
            {{ cat.label }}
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-if="filteredCatalog.length === 0"
        class="flex flex-col items-center justify-center border border-dashed border-[#bfc3bf] bg-[#fcfdfb] px-6 py-16 text-center"
      >
        <div class="mb-4 grid size-12 place-items-center rounded-full bg-[#f1f3f0] text-[#6a6e6a]">
          <svg class="size-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
          </svg>
        </div>
        <h3 class="font-display text-lg font-bold text-[#202220]">No styles match your search or filter.</h3>
        <p class="mt-1 max-w-sm text-xs text-[#6a6e6a]">Try adjusting your search terms or selecting a different category to explore available styles.</p>
        <button
          type="button"
          class="mt-5 border border-[#292b2d] bg-[#292b2d] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#404345] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
          @click="clearFilters"
        >
          Clear filters
        </button>
      </div>

      <!-- Catalog grid -->
      <div v-else class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <template v-for="card in filteredCatalog" :key="card.id">
          <!-- Live shoe card -->
          <button
            v-if="card.status === 'live'"
            type="button"
            class="group flex flex-col overflow-hidden border border-[#bfc3bf] bg-[#fcfdfb] text-left transition-all duration-200 hover:border-[#292b2d] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
            @click="goToStudio(card.shoeId)"
            :aria-label="`Customize and order ${card.name}`"
          >
            <!-- Thumbnail -->
            <div class="relative grid h-64 place-items-center overflow-hidden bg-[#e9ece9]">
              <img
                v-if="card.image"
                :src="card.image"
                :alt="`${card.name} customizable sneaker`"
                class="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <div v-else class="text-center text-[#6a6e6a]">
                <div class="mx-auto mb-3 grid size-16 place-items-center border border-[#bfc3bf] bg-[#fcfdfb] text-2xl">3D</div>
                <p class="text-xs font-bold uppercase tracking-widest">{{ card.name }}</p>
              </div>
              <!-- Hover overlay -->
              <div class="pointer-events-none absolute inset-0 bg-[#292b2d]/0 transition-colors duration-200 group-hover:bg-[#292b2d]/10" />
              <div class="pointer-events-none absolute left-3 top-3 bg-[#b94d27] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                Customize
              </div>
              <!-- Arrow hint that appears on hover -->
              <div class="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 bg-[#292b2d] px-3 py-1.5 text-xs font-bold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                Open studio
                <svg class="size-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>

            <!-- Card body -->
            <div class="flex flex-1 flex-col p-5">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="font-display text-xl font-black tracking-[-0.03em] text-[#202220]">{{ card.name }}</h2>
                  <p class="mt-0.5 text-xs text-[#6a6e6a]">{{ card.subtitle }}</p>
                </div>
                <p class="shrink-0 text-lg font-black text-[#b94d27]">{{ card.price }}</p>
              </div>

              <!-- Part color preview dots -->
              <div v-if="SHOES.find(s => s.id === card.shoeId)" class="mt-3 flex items-center gap-1">
                <span
                  v-for="part in SHOES.find(s => s.id === card.shoeId).parts"
                  :key="part.id"
                  class="size-3 border border-black/10"
                  :style="{ backgroundColor: selectedShoeId === card.shoeId ? partColors[part.id]?.value || '#e9ece9' : '#e9ece9' }"
                  :title="part.label"
                />
                <span class="ml-1.5 text-[10px] text-[#6a6e6a]">{{ selectedShoeId === card.shoeId && customizedCount > 0 ? customizedCount + ' parts styled' : 'Default colors' }}</span>
              </div>

              <!-- CTA row -->
              <div class="mt-5 mt-auto flex h-12 w-full items-center justify-between bg-[#292b2d] px-5 text-sm font-bold text-white transition-colors duration-200 group-hover:bg-[#404345]">
                Customize &amp; Order
                <svg class="size-4 transition-transform duration-200 group-hover:translate-x-1" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </button>

          <!-- Coming Soon card -->
          <div
            v-else
            class="flex flex-col overflow-hidden border border-[#bfc3bf] bg-[#fcfdfb] text-left opacity-90 transition-all duration-200"
          >
            <!-- Placeholder thumbnail area -->
            <div class="relative grid h-64 place-items-center overflow-hidden bg-[#ebeeed]">
              <div class="text-center text-[#8e938e]">
                <div class="mx-auto mb-2 grid size-16 place-items-center border border-dashed border-[#bfc3bf] bg-[#f5f6f4] text-xl font-bold tracking-wider text-[#6a6e6a]">
                  3D
                </div>
                <p class="text-[11px] font-bold uppercase tracking-widest text-[#7a7e7a]">Coming Soon</p>
              </div>
              <div class="pointer-events-none absolute left-3 top-3 bg-[#6a6e6a] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                Coming Soon
              </div>
            </div>

            <!-- Card body -->
            <div class="flex flex-1 flex-col p-5">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="font-display text-xl font-black tracking-[-0.03em] text-[#404345]">{{ card.name }}</h2>
                  <p class="mt-0.5 text-xs text-[#6a6e6a]">{{ card.subtitle }}</p>
                </div>
                <p class="shrink-0 text-lg font-bold text-[#6a6e6a]">{{ card.price }}</p>
              </div>

              <!-- Categories preview tags -->
              <div class="mt-3 flex flex-wrap items-center gap-1.5">
                <span
                  v-for="cat in card.categories"
                  :key="cat"
                  class="border border-[#cfd2ce] bg-[#f5f6f4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6a6e6a]"
                >
                  {{ cat }}
                </span>
              </div>

              <!-- Disabled indicator row -->
              <div class="mt-5 mt-auto flex h-12 w-full items-center justify-center border border-[#cfd2ce] bg-[#f1f3f0] px-5 text-sm font-semibold text-[#8e938e] select-none">
                Available Soon
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- How it works strip -->
      <section class="mt-10 grid border border-[#bfc3bf] bg-[#292b2d] text-white sm:grid-cols-3" aria-label="How KickCraft works">
        <div class="border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><p class="font-display font-bold">1. Customize</p><p class="mt-1 text-sm text-white/65">Color the editable parts.</p></div>
        <div class="border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><p class="font-display font-bold">2. Inspect</p><p class="mt-1 text-sm text-white/65">Rotate and zoom the 3D model before choosing a size.</p></div>
        <div class="p-5"><p class="font-display font-bold">3. Reserve</p><p class="mt-1 text-sm text-white/65">Save your design for in-store pickup.</p></div>
      </section>
    </main>

    <!-- ══════════════════════════════════════════════════════ -->
    <!-- STUDIO VIEW — viewport-locked, right panel scrollable  -->
    <!-- ══════════════════════════════════════════════════════ -->
    <div
      v-else
      class="mx-auto max-w-[1480px] flex-col px-5 py-5 lg:px-8 lg:py-6"
    >
      <!-- Compact title row -->
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div>
          <p class="text-xs font-semibold text-[#6a6e6a]">{{ selectedShoe.name }} · Design studio</p>
          <h1 class="font-display text-2xl font-black leading-tight tracking-[-0.04em] text-[#202220] sm:text-3xl">Shape the color. Keep the character.</h1>
        </div>
        <!-- Mobile back link -->
        <button
          class="flex items-center gap-1.5 text-sm text-[#5f635f] underline underline-offset-4 hover:text-[#292b2d] sm:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
          @click="goToShop"
        >← Back to shop</button>
      </div>

      <!-- Studio panel: 3D viewer + customization -->
      <section class="grid border border-[#bfc3bf] bg-[#fcfdfb] lg:grid-cols-[minmax(0,1.55fr)_minmax(360px,.72fr)]">

        <!-- 3D viewer — fixed tall height so the full shoe is always visible -->
        <div class="relative border-b border-[#bfc3bf] bg-[#e9ece9] lg:border-b-0 lg:border-r" style="height:580px;">
          <model-viewer
            ref="modelViewer"
            :src="selectedShoe.src"
            :alt="`Interactive customizable 3D ${selectedShoe.name}`"
            camera-controls
            touch-action="pan-y"
            shadow-intensity="1"
            shadow-softness="1"
            exposure="1"
            environment-image="neutral"
            interaction-prompt="auto"
            style="width:100%;height:100%;position:absolute;inset:0;"
            @load="handleModelLoad"
            @error="handleModelError"
          >
            <extra-model
              v-for="charm in charmModels"
              :key="charm.id"
              :src="charm.src"
              :offset="selectedShoe.charmOffset"
              :scale="charmScale(charm.id, selectedCharmId, selectedShoe.charmScale)"
            />
          </model-viewer>

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

        <!-- Right panel — customization controls -->
        <div class="flex flex-col">
          <!-- Product header -->
          <div class="shrink-0 border-b border-[#d9dcd8] p-5 lg:p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <h2 class="font-display text-2xl font-black tracking-[-0.04em] text-[#202220]">{{ selectedShoe.name }}</h2>
                <p class="mt-1 text-sm leading-6 text-[#626662]">{{ selectedShoe.description }}</p>
              </div>
              <p class="shrink-0 text-xl font-black text-[#b94d27]">{{ selectedShoe.price }}</p>
            </div>
          </div>

          <!-- Customization controls -->
          <div class="space-y-5 p-5 lg:p-6">
            <!-- Part selector -->
            <fieldset :disabled="!modelReady">
              <div class="mb-3 flex items-center justify-between gap-4">
                <legend class="font-display text-base font-bold">Customize part</legend>
                <span class="text-xs font-semibold text-[#696d69]">Editing: {{ selectedPart.label }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="part in selectedParts"
                  :key="part.id"
                  type="button"
                  class="flex min-h-10 items-center justify-between border px-3 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                  :class="selectedPartId === part.id ? 'border-[#292b2d] bg-[#292b2d] text-white' : 'border-[#c5c9c5] bg-white hover:border-[#6f746f]'"
                  :aria-pressed="selectedPartId === part.id"
                  @click="selectedPartId = part.id"
                >
                  {{ part.label }}
                  <span class="size-3 border border-current/25" :style="{ backgroundColor: partColors[part.id]?.value || '#ffffff' }" />
                </button>
              </div>
            </fieldset>

            <!-- Color picker -->
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
                  class="flex min-h-11 items-center gap-2 border bg-white px-2.5 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                  :class="selectedColor?.value === color.value ? 'border-[#292b2d] ring-1 ring-[#292b2d]' : 'border-[#c5c9c5] hover:border-[#6f746f]'"
                  :aria-pressed="selectedColor?.value === color.value"
                  @click="chooseColor(color)"
                >
                  <span class="size-5 shrink-0 border border-black/15" :style="{ backgroundColor: color.value }" />
                  {{ color.name }}
                </button>
              </div>
            </fieldset>

            <!-- Charm / accessory selector -->
            <fieldset :disabled="!modelReady">
              <div class="mb-3 flex items-center justify-between gap-4">
                <legend class="font-display text-base font-bold">Add accessory</legend>
                <span class="text-xs font-semibold text-[#696d69]">{{ selectedCharm.label }}</span>
              </div>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                <button
                  v-for="charm in CHARMS"
                  :key="charm.id"
                  type="button"
                  class="min-h-10 border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                  :class="selectedCharmId === charm.id ? 'border-[#292b2d] bg-[#292b2d] text-white' : 'border-[#c5c9c5] bg-white hover:border-[#6f746f]'"
                  :aria-pressed="selectedCharmId === charm.id"
                  @click="selectedCharmId = charm.id"
                >{{ charm.label }}</button>
              </div>
            </fieldset>

            <!-- Reset / summary row -->
            <div class="flex items-center justify-between border-y border-[#d9dcd8] py-3 text-sm">
              <span><strong>{{ customizedCount }}</strong> of {{ selectedParts.length }} parts · {{ selectedCharm.label }} accessory</span>
              <button
                type="button"
                class="font-semibold text-[#245fa8] underline underline-offset-4 disabled:cursor-not-allowed disabled:text-[#9b9f9b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                :disabled="!modelReady || customizedCount === 0"
                @click="resetDesign"
              >Reset design</button>
            </div>

            <!-- Size selector -->
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
                  class="h-10 border text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
                  :class="selectedSize === size ? 'border-[#b94d27] bg-[#fff3ed] text-[#8f361b]' : 'border-[#c5c9c5] bg-white hover:border-[#6f746f]'"
                  :aria-pressed="selectedSize === size"
                  @click="selectedSize = size"
                >{{ size }}</button>
              </div>
            </fieldset>
          </div>

          <!-- Order CTA — pinned to bottom of panel -->
          <div class="mt-auto shrink-0 border-t border-[#d9dcd8] bg-[#f1f3f0] p-5 lg:p-6">
            <p class="mb-3 text-sm text-[#5f635f]">Pickup order · Your colors, accessory, and size are included.</p>
            <button
              type="button"
              class="h-12 w-full bg-[#b94d27] px-5 font-bold text-white hover:bg-[#963a20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              @click="openReservation"
            >Order this design</button>
          </div>
        </div>
      </section>

      <!-- ── Marketing / product description ──────────────── -->
      <div class="mt-px grid gap-px border-x border-b border-[#bfc3bf] bg-[#bfc3bf] lg:grid-cols-2">

        <!-- About the shoe -->
        <div class="bg-[#fcfdfb] p-7 lg:p-9">
          <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#b94d27]">About this shoe</p>
          <h2 class="font-display mt-2 text-2xl font-black tracking-[-0.04em] text-[#202220] lg:text-3xl">Choose a look that fits you.</h2>
          <p class="mt-4 text-sm leading-7 text-[#5f635f]">
            {{ selectedShoe.name }} gives customers {{ selectedParts.length }} editable zones. The remaining shoe details stay fixed so the editing stays quick.
          </p>
          <p class="mt-3 text-sm leading-7 text-[#5f635f]">
            Rotate the model to inspect your color choices from every angle before you commit. Add a charm near the laces, choose a size, and place your order for pickup.
          </p>
        </div>

        <!-- Feature list -->
        <div class="bg-[#f5f6f4] p-7 lg:p-9">
          <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#b94d27]">What you're designing</p>
          <h2 class="font-display mt-2 text-2xl font-black tracking-[-0.04em] text-[#202220] lg:text-3xl">{{ selectedParts.length }} zones. Your combination.</h2>
          <ul class="mt-5 space-y-3">
            <li v-for="part in selectedParts" :key="part.id" class="flex items-center gap-3 text-sm">
              <span
                class="size-4 shrink-0 border border-black/10"
                :style="{ backgroundColor: partColors[part.id]?.value || '#e9ece9' }"
              />
              <span class="font-semibold text-[#292b2d]">{{ part.label }}</span>
              <span class="text-[#6a6e6a]">—</span>
              <span class="text-[#5f635f]">{{ partColors[part.id]?.name || 'Original color' }}</span>
            </li>
          </ul>
        </div>

      </div>

      <!-- ── Why KickCraft strip ──────────────────────────── -->
      <div class="grid border-x border-b border-[#bfc3bf] bg-[#292b2d] text-white sm:grid-cols-3">
        <div class="border-b border-white/20 p-6 sm:border-b-0 sm:border-r">
          <p class="font-display text-base font-bold">Fixed details</p>
          <p class="mt-1.5 text-sm leading-6 text-white/65">Style the editable zones while the remaining shoe details stay fixed.</p>
        </div>
        <div class="border-b border-white/20 p-6 sm:border-b-0 sm:border-r">
          <p class="font-display text-base font-bold">Live 3D preview</p>
          <p class="mt-1.5 text-sm leading-6 text-white/65">See your color choices applied in real time on the actual 3D model — not a flat mockup or a filtered photo.</p>
        </div>
        <div class="p-6">
          <p class="font-display text-base font-bold">In-store pickup</p>
          <p class="mt-1.5 text-sm leading-6 text-white/65">Order your exact design online and pick it up at the KickCraft store — no shipping wait, no surprises.</p>
        </div>
      </div>

    </div>

    <!-- ── Footer ───────────────────────────────────────────── -->
    <footer class="mt-20 border-t border-[#383a38] bg-[#202220] text-white">
      <div class="mx-auto max-w-[1480px] px-5 py-12 lg:px-8 lg:py-16">
        <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">

          <!-- Col 1: Brand & Studio Flagship -->
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <span class="grid size-8 place-items-center bg-[#b94d27] text-sm font-black text-white">K</span>
              <span class="font-display text-lg font-extrabold tracking-[-0.03em] text-white">KickCraft</span>
            </div>
            <p class="text-xs leading-6 text-white/70">
              Interactive 3D shoe customization and store pickup system. Directly recolor independent shoe parts, attach interchangeable 3D charms, and order your custom pair for pickup.
            </p>
            <div class="border-t border-white/10 pt-3 text-xs text-white/50">
              <p class="font-semibold text-white/80">KickCraft Flagship Studio</p>
              <p class="mt-0.5">Mon–Sat · 10:00 AM – 8:00 PM</p>
            </div>
          </div>

          <!-- Col 2: Silhouettes / Catalog -->
          <div>
            <h3 class="font-display text-xs font-bold uppercase tracking-widest text-[#b94d27]">Silhouettes</h3>
            <ul class="mt-4 space-y-2 text-xs font-semibold">
              <li>
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-white/75 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#b94d27]"
                  @click="goToStudio('kickcraft-one'); scrollToTop()"
                >
                  <span>KickCraft One</span>
                  <span class="bg-[#b94d27] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Live</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-white/75 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-[#b94d27]"
                  @click="goToStudio('nike-air-max'); scrollToTop()"
                >
                  <span>Nike Air Max</span>
                  <span class="bg-[#b94d27] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Live</span>
                </button>
              </li>
              <li class="text-white/40">KickCraft Hoop <span class="ml-1 text-[10px] uppercase">(Basketball)</span></li>
              <li class="text-white/40">KickCraft Stride <span class="ml-1 text-[10px] uppercase">(Running)</span></li>
              <li class="text-white/40">KickCraft Luxe <span class="ml-1 text-[10px] uppercase">(Fashion)</span></li>
            </ul>
          </div>

          <!-- Col 3: 3D Studio Features -->
          <div>
            <h3 class="font-display text-xs font-bold uppercase tracking-widest text-[#b94d27]">3D Studio</h3>
            <ul class="mt-4 space-y-2 text-xs text-white/75">
              <li>Independently Addressable Mesh Parts</li>
              <li>Interchangeable Metal 3D Charms</li>
              <li>Interactive 3D Orbit &amp; Zoom Preview</li>
              <li>US Sizes 7 through 11 Available</li>
              <li>Direct Store Pickup Assembly</li>
            </ul>
          </div>

          <!-- Col 4: Store Pickup & Support -->
          <div>
            <h3 class="font-display text-xs font-bold uppercase tracking-widest text-[#b94d27]">In-Store Pickup</h3>
            <ul class="mt-4 space-y-2.5 text-xs text-white/75">
              <li>
                <span class="block font-semibold text-white/90">KickCraft Pickup Counter</span>
                <span class="text-white/60">123 Craft Studio Way, Manila</span>
              </li>
              <li>
                <span class="block font-semibold text-white/90">Customer Support</span>
                <span class="text-white/60">support@kickcraft.local</span>
              </li>
              <li class="pt-1 text-[11px] text-white/50">
                Zero shipping wait. Each custom design is inspected and assembled on-site.
              </li>
            </ul>
          </div>

        </div>

        <!-- Bottom bar -->
        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/50 sm:flex-row">
          <p>© 2026 KickCraft. All rights reserved.</p>
          <div class="flex items-center gap-6">
            <button type="button" class="hover:text-white" @click="goToShop(); scrollToTop()">Catalog</button>
            <button type="button" class="hover:text-white" @click="goToStudio('kickcraft-one'); scrollToTop()">3D Studio</button>
            <button type="button" class="hover:text-white" @click="openReservation">Order</button>
          </div>
        </div>
      </div>
    </footer>

    <!-- ── Order dialog (shared between views) ─────────────── -->
    <dialog id="reservation-dialog" class="m-auto w-[calc(100%_-_32px)] max-w-md border border-[#8e938e] bg-[#fcfdfb] p-0 text-[#292b2d]">
      <div v-if="!reserved" class="p-6">
        <div class="flex items-start justify-between gap-4 border-b border-[#d9dcd8] pb-4">
          <div><h2 class="font-display text-xl font-black">Order your {{ selectedShoe.name }}</h2><p class="mt-1 text-sm text-[#626662]">Size {{ selectedSize }} · {{ customizedCount }} customized parts · {{ selectedCharm.label }} accessory</p></div>
          <button class="grid size-9 place-items-center border border-[#bfc3bf] text-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]" aria-label="Close order modal" @click="closeReservation">×</button>
        </div>
        <form class="space-y-4 pt-5" @submit.prevent="submitReservation">
          <label class="block"><span class="mb-1.5 block text-sm font-bold">Full name</span><input required autocomplete="name" class="h-11 w-full border border-[#bfc3bf] bg-white px-3 outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]" /></label>
          <label class="block"><span class="mb-1.5 block text-sm font-bold">Email address</span><input required type="email" autocomplete="email" class="h-11 w-full border border-[#bfc3bf] bg-white px-3 outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]" /></label>
          <label class="block"><span class="mb-1.5 block text-sm font-bold">Pickup date</span><input required type="date" class="h-11 w-full border border-[#bfc3bf] bg-white px-3 outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]" /></label>
          <button class="h-12 w-full bg-[#b94d27] font-bold text-white hover:bg-[#963a20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]">Confirm order</button>
        </form>
      </div>
      <div v-else class="p-8 text-center">
        <div class="mx-auto grid size-12 place-items-center bg-[#3f7652] text-xl font-black text-white">✓</div>
        <h2 class="font-display mt-5 text-xl font-black">Order confirmed</h2>
        <p class="mt-2 text-sm leading-6 text-[#626662]">Your custom {{ selectedShoe.name }} in size {{ selectedSize }} with {{ selectedCharm.label }} accessory is placed for store pickup.</p>
        <button class="mt-6 h-11 w-full border border-[#8e938e] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]" @click="closeReservation">Continue designing</button>
      </div>
    </dialog>
  </div>
</template>
