<script setup>
import { computed, nextTick, ref } from 'vue'
import { CHARMS, PARTS, SHOES, charmScale, materialName, setMaterialColor } from './customization.js'

// ── Shoe catalog ──────────────────────────────────────────────
// 'live' cards are clickable and open the studio; 'soon' cards are Coming Soon
const CATALOG = [
  { id: 'one',        name: 'KickCraft One',     subtitle: 'Original concept · 8 customizable parts', price: '₱4,890', category: 'sneakers',    img: '/images/kickcraft-one-card.png', shoeId: 'one',  status: 'live' },
  { id: 'two',        name: 'KickCraft Two',     subtitle: 'Original concept · 8 customizable parts', price: '₱4,890', category: 'sneakers',    img: '/images/kickcraft-two-card.png', shoeId: 'two',  status: 'live' },
  { id: 'hoop-one',   name: 'KickCraft Hoop',    subtitle: 'High-top basketball · ankle support',     price: '₱5,290', category: 'basketball',  img: null,                             shoeId: null,   status: 'soon' },
  { id: 'hoop-two',   name: 'KickCraft Court',   subtitle: 'Low-cut basketball · lightweight grip',   price: '₱5,190', category: 'basketball',  img: null,                             shoeId: null,   status: 'soon' },
  { id: 'run-one',    name: 'KickCraft Stride',  subtitle: 'Road running · responsive cushion',       price: '₱5,490', category: 'running',     img: null,                             shoeId: null,   status: 'soon' },
  { id: 'run-two',    name: 'KickCraft Pace',    subtitle: 'Trail running · rugged outsole',          price: '₱5,390', category: 'running',     img: null,                             shoeId: null,   status: 'soon' },
  { id: 'fashion-one',name: 'KickCraft Luxe',    subtitle: 'Fashion · premium leather upper',         price: '₱6,290', category: 'fashion',     img: null,                             shoeId: null,   status: 'soon' },
  { id: 'fashion-two',name: 'KickCraft Drift',   subtitle: 'Fashion · canvas slip-on silhouette',     price: '₱5,890', category: 'fashion',     img: null,                             shoeId: null,   status: 'soon' },
]

const CATEGORIES = [
  { id: 'all',        label: 'All' },
  { id: 'sneakers',   label: 'Sneakers' },
  { id: 'basketball', label: 'Basketball' },
  { id: 'running',    label: 'Running' },
  { id: 'fashion',    label: 'Fashion' },
]

// ── Search & filter state ──────────────────────────────────────
const searchQuery = ref('')
const activeCategory = ref('all')

const filteredCatalog = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return CATALOG.filter(card => {
    const matchesCategory = activeCategory.value === 'all' || card.category === activeCategory.value
    const matchesSearch   = !q || card.name.toLowerCase().includes(q) || card.subtitle.toLowerCase().includes(q)
    return matchesCategory && matchesSearch
  })
})

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
const selectedCharmId = ref('none')
const partColors = ref({})
const selectedSize = ref(9)
const modelReady = ref(false)
const modelError = ref('')
const reserved = ref(false)

// ── Active shoe ───────────────────────────────────────────────
const selectedShoeId = ref('one')
const activeShoe = computed(() => SHOES[selectedShoeId.value])
const activeModelSrc = computed(() => activeShoe.value.src)

/** Resolve the GLB material name for a given partId in the active shoe */
function partMaterial(partId) {
  return materialName(partId, selectedShoeId.value)
}

const selectedPart = computed(() => PARTS.find(part => part.id === selectedPartId.value))
const selectedCharm = computed(() => CHARMS.find(charm => charm.id === selectedCharmId.value))
const customizedCount = computed(() => Object.keys(partColors.value).length)
const selectedColor = computed(() => partColors.value[selectedPartId.value])
const charmModels = CHARMS.filter(charm => charm.src)

function handleModelLoad() {
  const model = modelViewer.value?.model
  const missingPart = PARTS.find(part => !model?.getMaterialByName(partMaterial(part.id)))

  if (missingPart) {
    modelError.value = 'This shoe model cannot be customized because a required part is missing.'
    return
  }

  modelReady.value = true
  modelError.value = ''

  for (const [partId, color] of Object.entries(partColors.value)) {
    if (color?.value) {
      setMaterialColor(model, partMaterial(partId), color.value)
    }
  }
}

function handleModelError() {
  modelReady.value = false
  modelError.value = 'The 3D shoe could not be loaded. Check the model file, then refresh the page.'
}

function chooseColor(color) {
  if (!modelReady.value) return
  if (!setMaterialColor(modelViewer.value.model, partMaterial(selectedPartId.value), color.value)) return

  partColors.value = { ...partColors.value, [selectedPartId.value]: color }
}

function resetDesign() {
  if (!modelReady.value) return
  if (PARTS.every(part => setMaterialColor(modelViewer.value.model, partMaterial(part.id), '#ffffff'))) {
    partColors.value = {}
  }
}

// ── Order & Login / Backend state ─────────────────────────────
const dialogMode = ref('order') // 'order' | 'login'
const dialogTab = ref('order')  // 'order' | 'login'
const authAction = ref('login') // 'login' | 'register'
const currentUser = ref(null)   // null | { email: string, name?: string, role: 'customer' | 'owner' }
const customerName = ref('')
const customerEmail = ref('')
const pickupDate = ref('')
const loginEmail = ref('')
const loginPassword = ref('')
const loginRole = ref('customer') // 'customer' | 'owner'
const loginFeedback = ref('')

// Registration fields
const registerName = ref('')
const registerEmail = ref('')
const registerPassword = ref('')
const registerConfirmPassword = ref('')
const registerFeedback = ref('')
const registerError = ref('')

function openOrder(tab = 'order') {
  dialogMode.value = 'order'
  dialogTab.value = tab
  reserved.value = false
  loginFeedback.value = ''
  registerFeedback.value = ''
  registerError.value = ''
  if (currentUser.value && !customerEmail.value) {
    customerEmail.value = currentUser.value.email
  }
  nextTick(() => document.querySelector('#reservation-dialog')?.showModal())
}

function openReservation() {
  openOrder('order')
}

function openLogin(action = 'login') {
  dialogMode.value = 'login'
  dialogTab.value = 'login'
  authAction.value = action
  reserved.value = false
  loginFeedback.value = ''
  registerFeedback.value = ''
  registerError.value = ''
  nextTick(() => document.querySelector('#reservation-dialog')?.showModal())
}

function closeReservation() {
  document.querySelector('#reservation-dialog')?.close()
}

function submitReservation() {
  reserved.value = true
}

function handleLoginSubmit() {
  // Prepared for future PHP API / MySQL backend: POST /api/login.php
  if (!loginEmail.value || !loginPassword.value) return
  currentUser.value = {
    email: loginEmail.value,
    role: loginRole.value,
  }
  customerEmail.value = loginEmail.value
  loginFeedback.value = `Logged in as ${loginEmail.value} (${loginRole.value === 'owner' ? 'Owner / Admin' : 'Customer'}). Ready for future backend sync.`
  setTimeout(() => {
    if (dialogMode.value === 'order') {
      dialogTab.value = 'order'
    } else {
      closeReservation()
    }
  }, 900)
}

function handleRegisterSubmit() {
  // Prepared for future PHP API / MySQL backend: POST /api/register.php
  registerError.value = ''
  registerFeedback.value = ''
  if (!registerEmail.value || !registerPassword.value) return
  if (registerPassword.value !== registerConfirmPassword.value) {
    registerError.value = 'Passwords do not match. Please re-enter.'
    return
  }
  currentUser.value = {
    email: registerEmail.value,
    name: registerName.value,
    role: 'customer',
  }
  customerName.value = registerName.value
  customerEmail.value = registerEmail.value
  registerFeedback.value = `Account registered for ${registerEmail.value}. Logged in successfully.`
  setTimeout(() => {
    if (dialogMode.value === 'order') {
      dialogTab.value = 'order'
    } else {
      closeReservation()
    }
  }, 900)
}

function handleLogout() {
  currentUser.value = null
  loginEmail.value = ''
  loginPassword.value = ''
  loginFeedback.value = ''
  registerName.value = ''
  registerEmail.value = ''
  registerPassword.value = ''
  registerConfirmPassword.value = ''
  registerFeedback.value = ''
  registerError.value = ''
  authAction.value = 'login'
}

// ── View routing ──────────────────────────────────────────────
const view = ref('shop') // 'shop' | 'studio'

function goToStudio(shoeId = 'one') {
  selectedShoeId.value = shoeId
  view.value = 'studio'
}

function goToShop() {
  partColors.value = {}
  selectedCharmId.value = 'none'
  selectedPartId.value = PARTS[0].id
  selectedSize.value = 9
  modelReady.value = false
  modelError.value = ''
  reserved.value = false
  view.value = 'shop'
}

function scrollToTop() {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
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
        <nav class="flex items-center gap-5 text-sm font-semibold" aria-label="Main navigation">
          <!-- Shop view nav -->
          <template v-if="view === 'shop'">
            <span class="hidden border-b-2 border-[#b94d27] py-5 sm:block">Shop</span>
            <button
              type="button"
              class="text-sm font-semibold text-[#5f635f] hover:text-[#292b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              @click="openLogin"
            >
              {{ currentUser ? currentUser.email : 'Log in' }}
            </button>
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
              @click="openOrder('order')"
            >Customize &amp; Order</button>
            <button
              type="button"
              class="text-sm font-semibold text-[#5f635f] hover:text-[#292b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              @click="openLogin"
            >
              {{ currentUser ? currentUser.email : 'Log in' }}
            </button>
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
        <p class="mb-2 text-sm font-semibold text-[#6a6e6a]">Original concept / KickCraft One</p>
        <h1 class="font-display max-w-3xl text-4xl font-black leading-[0.95] tracking-[-0.045em] text-[#202220] sm:text-5xl lg:text-6xl">
          Shape the color.<br>Keep the character.
        </h1>
        <p class="mt-5 max-w-md text-sm leading-6 text-[#5f635f]">
          Design your own KickCraft sneaker by recoloring eight independent parts, attaching a 3D charm, and reserving it for in-store pickup.
        </p>
      </div>

      <!-- ── Search + filter toolbar ──────────────────────── -->
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <!-- Search bar -->
        <label class="relative flex-1 max-w-sm">
          <span class="sr-only">Search shoes</span>
          <svg class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9f9b]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 10l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search styles…"
            class="h-10 w-full border border-[#bfc3bf] bg-[#fcfdfb] pl-9 pr-4 text-sm outline-none transition-colors placeholder:text-[#9b9f9b] hover:border-[#292b2d] focus:border-[#292b2d] focus:ring-0"
            aria-label="Search shoe styles"
          />
        </label>

        <!-- Category filter tabs -->
        <nav class="flex flex-wrap gap-1.5" aria-label="Filter by category">
          <button
            v-for="cat in CATEGORIES"
            :key="cat.id"
            type="button"
            class="h-9 px-4 text-xs font-bold uppercase tracking-wider transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
            :class="activeCategory === cat.id
              ? 'bg-[#292b2d] text-white'
              : 'border border-[#bfc3bf] bg-[#fcfdfb] text-[#5f635f] hover:border-[#292b2d] hover:text-[#292b2d]'"
            @click="activeCategory = cat.id"
            :aria-pressed="activeCategory === cat.id"
          >{{ cat.label }}</button>
        </nav>
      </div>

      <!-- ── Catalog grid ─────────────────────────────────── -->
      <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

        <!-- Empty state -->
        <div
          v-if="filteredCatalog.length === 0"
          class="col-span-full flex flex-col items-center justify-center py-20 text-center text-sm text-[#9b9f9b]"
        >
          <svg class="mb-3 size-8 text-[#cfd2ce]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5"/>
            <path d="M17 17l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          No styles match <strong class="text-[#292b2d]">"{{ searchQuery }}"</strong>. Try a different search or category.
        </div>

        <template v-for="card in filteredCatalog" :key="card.id">

          <!-- ── Live card — clickable, opens studio ── -->
          <button
            v-if="card.status === 'live'"
            type="button"
            class="group flex flex-col border border-[#bfc3bf] bg-[#fcfdfb] overflow-hidden text-left transition-all duration-200 hover:border-[#292b2d] hover:shadow-[0_4px_20px_rgba(0,0,0,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
            @click="goToStudio(card.shoeId)"
            :aria-label="`Customize and order ${card.name}`"
          >
            <!-- Thumbnail -->
            <div class="relative h-64 overflow-hidden bg-[#e9ece9]">
              <img
                :src="card.img"
                :alt="`${card.name} — customizable concept sneaker`"
                class="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
              />
              <!-- Hover overlay -->
              <div class="pointer-events-none absolute inset-0 bg-[#292b2d]/0 transition-colors duration-200 group-hover:bg-[#292b2d]/10" />
              <div class="pointer-events-none absolute left-3 top-3 bg-[#b94d27] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                Customize
              </div>
              <!-- Arrow hint on hover -->
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
              <!-- Part color dots -->
              <div class="mt-3 flex items-center gap-1">
                <span v-for="part in PARTS" :key="part.id"
                  class="size-3 border border-black/10"
                  :style="{ backgroundColor: partColors[part.id]?.value || '#e9ece9' }"
                  :title="part.label"
                />
                <span class="ml-1.5 text-[10px] text-[#6a6e6a]">{{ customizedCount > 0 ? customizedCount + ' parts styled' : 'Default colors' }}</span>
              </div>
              <!-- CTA -->
              <div class="mt-5 flex h-12 w-full items-center justify-between bg-[#292b2d] px-5 text-sm font-bold text-white transition-colors duration-200 group-hover:bg-[#404345]">
                Customize &amp; Order
                <svg class="size-4 transition-transform duration-200 group-hover:translate-x-1" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </button>

          <!-- ── Coming Soon card — not clickable ── -->
          <div
            v-else
            class="flex flex-col border border-[#bfc3bf] bg-[#fcfdfb] overflow-hidden"
            :aria-label="`${card.name} — coming soon`"
          >
            <!-- Thumbnail placeholder -->
            <div class="relative flex h-64 items-center justify-center overflow-hidden bg-[#f0f1f0]">
              <!-- Silhouette SVG placeholder -->
              <svg class="size-24 text-[#cfd2ce]" viewBox="0 0 96 64" fill="none" aria-hidden="true">
                <path d="M8 48 Q20 20 40 22 Q52 24 56 20 Q64 14 76 18 L88 22 Q92 36 84 44 Q76 52 60 50 L16 52 Q8 54 8 48Z" fill="currentColor" opacity="0.35"/>
                <path d="M8 48 Q12 52 16 52 L60 50 Q76 52 84 44" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5"/>
              </svg>
              <!-- Coming Soon badge -->
              <div class="pointer-events-none absolute left-3 top-3 bg-[#5f635f] px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                Coming Soon
              </div>
              <!-- Category pill -->
              <div class="pointer-events-none absolute right-3 top-3 border border-[#cfd2ce] bg-[#fcfdfb] px-2 py-0.5 text-[10px] font-semibold capitalize text-[#6a6e6a]">
                {{ card.category }}
              </div>
            </div>

            <!-- Card body -->
            <div class="flex flex-1 flex-col p-5">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="font-display text-xl font-black tracking-[-0.03em] text-[#202220]">{{ card.name }}</h2>
                  <p class="mt-0.5 text-xs text-[#6a6e6a]">{{ card.subtitle }}</p>
                </div>
                <p class="shrink-0 text-lg font-black text-[#9b9f9b]">{{ card.price }}</p>
              </div>
              <!-- Neutral dots -->
              <div class="mt-3 flex items-center gap-1">
                <span v-for="part in PARTS" :key="part.id" class="size-3 border border-black/10 bg-[#e9ece9]" />
                <span class="ml-1.5 text-[10px] text-[#9b9f9b]">Default colors</span>
              </div>
              <!-- Muted CTA -->
              <div class="mt-5 flex h-12 w-full cursor-not-allowed select-none items-center justify-between bg-[#e0e2e0] px-5 text-sm font-bold text-[#9b9f9b]">
                Notify me when ready
                <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

        </template>
      </div>

      <!-- How it works strip -->
      <section class="mt-10 grid border border-[#bfc3bf] bg-[#292b2d] text-white sm:grid-cols-3" aria-label="How KickCraft works">
        <div class="border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><p class="font-display font-bold">1. Customize</p><p class="mt-1 text-sm text-white/65">Color any of the eight shoe parts.</p></div>
        <div class="border-b border-white/20 p-5 sm:border-b-0 sm:border-r"><p class="font-display font-bold">2. Inspect</p><p class="mt-1 text-sm text-white/65">Rotate and zoom the 3D model before choosing a size.</p></div>
        <div class="p-5"><p class="font-display font-bold">3. Customize &amp; Order</p><p class="mt-1 text-sm text-white/65">Save your design for in-store pickup.</p></div>
      </section>
    </main>

    <!-- STUDIO VIEW — viewport-locked, right panel scrollable  -->
    <!-- ══════════════════════════════════════════════════════ -->
    <div
      v-else
      class="mx-auto max-w-[1480px] flex-col px-5 py-5 lg:px-8 lg:py-6"
    >
      <!-- Compact title row -->
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div>
          <p class="text-xs font-semibold text-[#6a6e6a]">{{ activeShoe.name }} · Design studio</p>
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
            :src="activeModelSrc"
            alt="Interactive customizable 3D KickCraft concept shoe"
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
              :scale="charmScale(charm.id, selectedCharmId)"
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
                <h2 class="font-display text-2xl font-black tracking-[-0.04em] text-[#202220]">{{ activeShoe.name }}</h2>
                <p class="mt-1 text-sm leading-6 text-[#626662]">{{ activeShoe.subtitle || 'Our original customizable sneaker concept.' }}</p>
              </div>
              <p class="shrink-0 text-xl font-black text-[#b94d27]">{{ activeShoe.price || '₱4,890' }}</p>
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
                  v-for="part in PARTS"
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
              <span><strong>{{ customizedCount }}</strong> of {{ PARTS.length }} parts · {{ selectedCharm.label }} accessory</span>
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
            <p class="mb-3 text-sm text-[#5f635f]">Customization &amp; order · Your colors, accessory, and size are included.</p>
            <button
              type="button"
              class="h-12 w-full bg-[#b94d27] px-5 font-bold text-white hover:bg-[#963a20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              @click="openOrder('order')"
            >Customize &amp; Order</button>
          </div>
        </div>
      </section>

      <!-- ── Marketing / product description ──────────────── -->
      <div class="mt-px grid gap-px border-x border-b border-[#bfc3bf] bg-[#bfc3bf] lg:grid-cols-2">

        <!-- About the shoe -->
        <div class="bg-[#fcfdfb] p-7 lg:p-9">
          <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#b94d27]">About the {{ activeShoe.name }}</p>
          <h2 class="font-display mt-2 text-2xl font-black tracking-[-0.04em] text-[#202220] lg:text-3xl">Built from an original idea — nothing borrowed.</h2>
          <p class="mt-4 text-sm leading-7 text-[#5f635f]">
            The {{ activeShoe.name }} is our original silhouette — designed from the ground up with eight independent zones that you can recolor to make it entirely yours. The low-profile midsole keeps the stance clean while the outsole grip pattern stays functional on everyday surfaces.
          </p>
          <p class="mt-3 text-sm leading-7 text-[#5f635f]">
            Every part of the shoe — from the rubber outsole to the fabric tongue — is individually addressable in the 3D studio. Rotate the model to inspect your color choices from every angle before you commit.
          </p>
        </div>

        <!-- Feature list -->
        <div class="bg-[#f5f6f4] p-7 lg:p-9">
          <p class="mb-1 text-xs font-semibold uppercase tracking-widest text-[#b94d27]">What you're designing</p>
          <h2 class="font-display mt-2 text-2xl font-black tracking-[-0.04em] text-[#202220] lg:text-3xl">Eight zones. Infinite combinations.</h2>
          <ul class="mt-5 space-y-3">
            <li v-for="part in PARTS" :key="part.id" class="flex items-center gap-3 text-sm">
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
          <p class="font-display text-base font-bold">Original silhouette</p>
          <p class="mt-1.5 text-sm leading-6 text-white/65">Every curve, line, and proportion was drawn fresh — no borrowed designs, no licensed shapes.</p>
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
              Original 3D shoe customization and store pickup system. Directly recolor eight independent shoe parts and preview 3D charms before placing your order.
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
                  class="flex items-center gap-1.5 text-white/75 transition-colors hover:text-white"
                  @click="goToStudio('one'); scrollToTop()"
                >
                  <span>KickCraft One</span>
                  <span class="bg-[#b94d27] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Live</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="flex items-center gap-1.5 text-white/75 transition-colors hover:text-white"
                  @click="goToStudio('two'); scrollToTop()"
                >
                  <span>KickCraft Two</span>
                  <span class="bg-[#b94d27] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Live</span>
                </button>
              </li>
              <li class="text-white/40">KickCraft Hoop <span class="text-[10px] uppercase ml-1">(Basketball)</span></li>
              <li class="text-white/40">KickCraft Stride <span class="text-[10px] uppercase ml-1">(Running)</span></li>
              <li class="text-white/40">KickCraft Luxe <span class="text-[10px] uppercase ml-1">(Fashion)</span></li>
            </ul>
          </div>

          <!-- Col 3: 3D Customization Features -->
          <div>
            <h3 class="font-display text-xs font-bold uppercase tracking-widest text-[#b94d27]">3D Studio</h3>
            <ul class="mt-4 space-y-2 text-xs text-white/75">
              <li>8 Addressable Shoe Mesh Parts</li>
              <li>Interchangeable Metal 3D Charms</li>
              <li>Interactive 3D Orbit &amp; Zoom</li>
              <li>Sizes 7 through 11 Available</li>
              <li>Zero Shipping Wait — In-Store Pickup</li>
            </ul>
          </div>

          <!-- Col 4: Account & Backend -->
          <div>
            <h3 class="font-display text-xs font-bold uppercase tracking-widest text-[#b94d27]">Account &amp; Access</h3>
            <ul class="mt-4 space-y-2.5 text-xs">
              <li>
                <button
                  type="button"
                  class="font-semibold text-white/75 transition-colors hover:text-white"
                  @click="loginRole = 'customer'; openLogin('login')"
                >
                  Customer Log In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="font-semibold text-white/75 transition-colors hover:text-white"
                  @click="loginRole = 'customer'; openLogin('register')"
                >
                  Customer Registration
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="font-semibold text-white/75 transition-colors hover:text-white"
                  @click="loginRole = 'owner'; openLogin('login')"
                >
                  Owner / Admin Portal
                </button>
              </li>
              <li class="border-t border-white/10 pt-2 text-[11px] text-white/50">
                Backend Architecture: <span class="font-bold text-[#b94d27]">PHP / MySQL API</span>
              </li>
            </ul>
          </div>

        </div>

        <!-- Sub-bar -->
        <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/50 sm:flex-row">
          <p>© 2026 KickCraft. All original concepts and designs preserved. No third-party branding.</p>
          <button
            type="button"
            class="flex items-center gap-1.5 text-white/70 transition-colors hover:text-white focus-visible:outline-none"
            @click="scrollToTop"
          >
            <span>Back to top</span>
            <svg class="size-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 11V3M3 7l4-4 4 4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </footer>

    <!-- ── Order & Log In dialog (shared between views) ─────── -->
    <dialog id="reservation-dialog" class="m-auto w-[calc(100%_-_32px)] max-w-md border border-[#8e938e] bg-[#fcfdfb] p-0 text-[#292b2d] backdrop:bg-black/40">
      <!-- Confirmation screen -->
      <div v-if="reserved" class="p-8 text-center">
        <div class="mx-auto grid size-12 place-items-center bg-[#3f7652] text-xl font-black text-white">✓</div>
        <h2 class="font-display mt-5 text-xl font-black">Order confirmed</h2>
        <p class="mt-2 text-sm leading-6 text-[#626662]">
          Your custom {{ activeShoe.name }} in size {{ selectedSize }} with {{ selectedCharm.label }} accessory is recorded for pickup.
        </p>
        <p v-if="customerEmail" class="mt-2 text-xs text-[#6a6e6a]">
          Confirmation details will be sent to <span class="font-bold text-[#292b2d]">{{ customerEmail }}</span>.
        </p>
        <button
          type="button"
          class="mt-6 h-11 w-full border border-[#8e938e] font-bold hover:border-[#292b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
          @click="closeReservation"
        >Continue designing</button>
      </div>

      <!-- Main dialog view with tabs -->
      <div v-else class="p-6">
        <div class="flex items-start justify-between gap-4 border-b border-[#d9dcd8] pb-4">
          <div>
            <h2 class="font-display text-xl font-black">
              {{ dialogMode === 'login'
                  ? (authAction === 'register' && loginRole === 'customer' ? 'Register Customer Account' : 'Log in to KickCraft')
                  : (dialogTab === 'order' ? `Order your ${activeShoe.name}` : (authAction === 'register' && loginRole === 'customer' ? 'Register Customer Account' : 'Log in to KickCraft')) }}
            </h2>
            <p class="mt-1 text-xs text-[#626662]">
              <template v-if="authAction === 'register' && loginRole === 'customer' && (dialogMode === 'login' || dialogTab === 'login')">
                Create an account to save your customized designs and pickup orders
              </template>
              <template v-else-if="dialogMode === 'login' || dialogTab === 'login'">
                Access your saved orders or admin portal (future backend code)
              </template>
              <template v-else>
                Size {{ selectedSize }} · {{ customizedCount }} customized parts · {{ selectedCharm.label }} accessory
              </template>
            </p>
          </div>
          <button
            type="button"
            class="grid size-9 place-items-center border border-[#bfc3bf] text-xl hover:border-[#292b2d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
            aria-label="Close dialog"
            @click="closeReservation"
          >×</button>
        </div>

        <!-- Mode selector: Only shown when customizing/ordering a shoe, NOT when clicking Log in in the navbar -->
        <div v-if="dialogMode === 'order'" class="mt-4 flex border-b border-[#d9dcd8] text-xs font-bold uppercase tracking-wider">
          <button
            type="button"
            class="flex-1 pb-2.5 text-center transition-colors focus-visible:outline-none"
            :class="dialogTab === 'order'
              ? 'border-b-2 border-[#b94d27] text-[#b94d27]'
              : 'text-[#6a6e6a] hover:text-[#292b2d]'"
            @click="dialogTab = 'order'"
          >
            Order Details
          </button>
          <button
            type="button"
            class="flex-1 pb-2.5 text-center transition-colors focus-visible:outline-none"
            :class="dialogTab === 'login'
              ? 'border-b-2 border-[#b94d27] text-[#b94d27]'
              : 'text-[#6a6e6a] hover:text-[#292b2d]'"
            @click="dialogTab = 'login'"
          >
            or Log in
          </button>
        </div>

        <!-- TAB 1: Order Details (shown only when in order flow) -->
        <div v-if="dialogMode === 'order' && dialogTab === 'order'" class="pt-4">
          <!-- Logged in user chip if authenticated -->
          <div v-if="currentUser" class="mb-4 flex items-center justify-between border border-[#bfc3bf] bg-[#f5f6f4] px-3 py-2 text-xs">
            <span>Logged in as: <strong class="text-[#202220]">{{ currentUser.email }}</strong></span>
            <button type="button" class="font-bold text-[#b94d27] hover:underline" @click="handleLogout">Log out</button>
          </div>

          <form class="space-y-4" @submit.prevent="submitReservation">
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Full name</span>
              <input
                v-model="customerName"
                required
                autocomplete="name"
                placeholder="Juan dela Cruz"
                class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
              />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Email address</span>
              <input
                v-model="customerEmail"
                required
                type="email"
                autocomplete="email"
                placeholder="juan@example.com"
                class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
              />
            </label>
            <label class="block">
              <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Pickup date</span>
              <input
                v-model="pickupDate"
                required
                type="date"
                class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
              />
            </label>
            <button
              type="submit"
              class="h-12 w-full bg-[#b94d27] font-bold text-white transition-colors hover:bg-[#963a20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
            >
              Confirm order
            </button>
          </form>

          <!-- Quick link to log in -->
          <div class="mt-4 border-t border-[#d9dcd8] pt-3 text-center">
            <p class="text-xs text-[#6a6e6a]">
              Have an existing account?
              <button
                type="button"
                class="font-bold text-[#b94d27] underline underline-offset-2 hover:text-[#963a20]"
                @click="dialogTab = 'login'"
              >
                or Log in for future backend code
              </button>
            </p>
          </div>
        </div>

        <!-- TAB 2: Log in / Register (shown when dialogMode is 'login' or dialogTab is 'login') -->
        <div v-else class="pt-4">
          <!-- When user is already logged in -->
          <div v-if="currentUser" class="space-y-4 py-2 text-center">
            <div class="mx-auto grid size-12 place-items-center bg-[#292b2d] text-xl font-bold text-white">✓</div>
            <h3 class="font-display text-lg font-black text-[#202220]">Currently Signed In</h3>
            <p class="text-sm text-[#5f635f]">
              Account: <strong class="text-[#202220]">{{ currentUser.email }}</strong><br>
              Role: <span class="capitalize font-semibold text-[#b94d27]">{{ currentUser.role === 'owner' ? 'Owner / Admin' : 'Customer' }}</span>
            </p>
            <div class="border border-dashed border-[#bfc3bf] bg-[#f5f6f4] p-3 text-left text-xs leading-relaxed text-[#5f635f]">
              <strong class="text-[#202220]">Session Active:</strong> Ready to synchronize with future PHP API backend (<code>/api/login.php</code>).
            </div>
            <div class="flex gap-2 pt-2">
              <button
                type="button"
                class="h-11 flex-1 border border-[#bfc3bf] font-bold text-[#292b2d] hover:border-[#292b2d]"
                @click="closeReservation"
              >Close</button>
              <button
                type="button"
                class="h-11 flex-1 bg-[#b94d27] font-bold text-white hover:bg-[#963a20]"
                @click="handleLogout"
              >Log out</button>
            </div>
          </div>

          <!-- When user is not logged in -->
          <div v-else class="space-y-4">
            <!-- Account type selector -->
            <div>
              <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Account type</span>
              <div class="grid grid-cols-2 gap-2 text-xs font-bold">
                <button
                  type="button"
                  class="h-9 border text-center transition-colors"
                  :class="loginRole === 'customer'
                    ? 'border-[#292b2d] bg-[#292b2d] text-white'
                    : 'border-[#bfc3bf] bg-white text-[#5f635f] hover:border-[#292b2d]'"
                  @click="loginRole = 'customer'"
                >
                  Customer
                </button>
                <button
                  type="button"
                  class="h-9 border text-center transition-colors"
                  :class="loginRole === 'owner'
                    ? 'border-[#292b2d] bg-[#292b2d] text-white'
                    : 'border-[#bfc3bf] bg-white text-[#5f635f] hover:border-[#292b2d]'"
                  @click="loginRole = 'owner'; authAction = 'login'"
                >
                  Owner / Admin
                </button>
              </div>

              <!-- Customer action switch: Log in vs Register button -->
              <div v-if="loginRole === 'customer'" class="mt-3 flex border border-[#bfc3bf] bg-[#f0f1f0] p-0.5 text-xs font-bold">
                <button
                  type="button"
                  class="flex-1 py-1.5 text-center transition-all"
                  :class="authAction === 'login' ? 'bg-white text-[#202220] shadow-sm' : 'text-[#6a6e6a] hover:text-[#202220]'"
                  @click="authAction = 'login'"
                >
                  Log in
                </button>
                <button
                  type="button"
                  class="flex-1 py-1.5 text-center transition-all"
                  :class="authAction === 'register' ? 'bg-white text-[#202220] shadow-sm' : 'text-[#6a6e6a] hover:text-[#202220]'"
                  @click="authAction = 'register'"
                >
                  Register
                </button>
              </div>
            </div>

            <!-- SUB-VIEW A: Customer Register Form -->
            <form v-if="loginRole === 'customer' && authAction === 'register'" class="space-y-4" @submit.prevent="handleRegisterSubmit">
              <label class="block">
                <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Full name</span>
                <input
                  v-model="registerName"
                  required
                  type="text"
                  autocomplete="name"
                  placeholder="Juan dela Cruz"
                  class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
                />
              </label>

              <label class="block">
                <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Email address</span>
                <input
                  v-model="registerEmail"
                  required
                  type="email"
                  autocomplete="email"
                  placeholder="juan@example.com"
                  class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
                />
              </label>

              <label class="block">
                <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Password</span>
                <input
                  v-model="registerPassword"
                  required
                  type="password"
                  autocomplete="new-password"
                  placeholder="At least 6 characters"
                  class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
                />
              </label>

              <label class="block">
                <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Confirm password</span>
                <input
                  v-model="registerConfirmPassword"
                  required
                  type="password"
                  autocomplete="new-password"
                  placeholder="Re-enter password"
                  class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
                />
              </label>

              <!-- Feedback / Error messages -->
              <div v-if="registerError" class="border border-[#b94d27] bg-[#fdf2ee] p-2.5 text-xs text-[#8f361b]">
                {{ registerError }}
              </div>
              <div v-if="registerFeedback" class="border border-[#3f7652] bg-[#f0f7f2] p-2.5 text-xs text-[#2a5438]">
                {{ registerFeedback }}
              </div>

              <!-- Future backend hint badge -->
              <div class="border border-dashed border-[#bfc3bf] bg-[#f5f6f4] p-3 text-[11px] leading-relaxed text-[#5f635f]">
                <strong class="text-[#202220]">Future Backend Hook:</strong>
                Registration API hook (<code>POST /api/register.php</code>) saving to MySQL customer records.
              </div>

              <button
                type="submit"
                class="h-12 w-full bg-[#b94d27] font-bold text-white transition-colors hover:bg-[#963a20] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              >
                Register customer account
              </button>

              <div class="text-center pt-1">
                <p class="text-xs text-[#6a6e6a]">
                  Already have an account?
                  <button
                    type="button"
                    class="font-bold text-[#202220] underline hover:text-[#b94d27]"
                    @click="authAction = 'login'"
                  >
                    Log in instead
                  </button>
                </p>
              </div>
            </form>

            <!-- SUB-VIEW B: Log in Form (Customer or Owner) -->
            <form v-else class="space-y-4" @submit.prevent="handleLoginSubmit">
              <label class="block">
                <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Email or Username</span>
                <input
                  v-model="loginEmail"
                  required
                  type="text"
                  autocomplete="username"
                  placeholder="admin@kickcraft.local or customer@email.com"
                  class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
                />
              </label>

              <label class="block">
                <span class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#404345]">Password</span>
                <input
                  v-model="loginPassword"
                  required
                  type="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="h-11 w-full border border-[#bfc3bf] bg-white px-3 text-sm outline-none focus:border-[#245fa8] focus:ring-1 focus:ring-[#245fa8]"
                />
              </label>

              <!-- Feedback / status -->
              <div v-if="loginFeedback" class="border border-[#3f7652] bg-[#f0f7f2] p-2.5 text-xs text-[#2a5438]">
                {{ loginFeedback }}
              </div>

              <!-- Future backend hint badge -->
              <div class="border border-dashed border-[#bfc3bf] bg-[#f5f6f4] p-3 text-[11px] leading-relaxed text-[#5f635f]">
                <strong class="text-[#202220]">Future Backend Hook:</strong>
                This login interface is wired to connect directly with the upcoming PHP authentication API (<code>POST /api/login.php</code>) backed by MySQL.
              </div>

              <button
                type="submit"
                class="h-12 w-full bg-[#292b2d] font-bold text-white transition-colors hover:bg-[#404345] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#245fa8]"
              >
                Log in
              </button>

              <div v-if="loginRole === 'customer'" class="text-center pt-1">
                <p class="text-xs text-[#6a6e6a]">
                  New to KickCraft?
                  <button
                    type="button"
                    class="font-bold text-[#b94d27] underline hover:text-[#963a20]"
                    @click="authAction = 'register'"
                  >
                    Register here
                  </button>
                </p>
              </div>
            </form>
          </div>

          <!-- Back to guest order link: only present if within the order flow -->
          <div v-if="dialogMode === 'order'" class="mt-4 border-t border-[#d9dcd8] pt-3 text-center">
            <button
              type="button"
              class="text-xs text-[#5f635f] hover:text-[#292b2d]"
              @click="dialogTab = 'order'"
            >
              ← Back to guest order
            </button>
          </div>
        </div>
      </div>
    </dialog>
  </div>
</template>
