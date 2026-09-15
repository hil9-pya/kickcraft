<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  createShoeRecord,
  deleteShoeRecord,
  getStoredShoes,
  highlightMaterial,
  restockShoeRecord,
  setStoredShoes,
  slugify,
  updateShoeRecord,
  validateShoe,
} from '../admin.js'
import {
  calculateFinancialStats,
  calculateSilhouetteBreakdown,
  createOrder,
  getStoredOrders,
  setStoredOrders,
  updateOrderStatus,
} from '../financials.js'
import { CATEGORIES } from '../customization.js'

const props = defineProps({
  currentUser: {
    type: Object,
    default: () => ({ email: 'owner@kickcraft.local', role: 'owner' }),
  },
})

const emit = defineEmits(['backToShop', 'openStudio', 'shoesChanged'])

// ── Navigation Section ─────────────────────────────────────────
const adminSection = ref('inventory') // 'inventory' | 'financials'

// ── Inventory State ────────────────────────────────────────────
const shoes = ref([])
const activeTab = ref('all') // 'all' | 'available' | 'coming_soon' | 'out_of_stock'
const searchQuery = ref('')
const editorMode = ref(false) // false = list view, true = editor view
const isEditing = ref(false) // false = create new, true = edit existing
const editingShoeId = ref(null)

// Restock dialog
const showRestockModal = ref(false)
const restockTargetShoe = ref(null)
const restockAmount = ref(10)

// Folder & Model Upload
const detectedFiles = ref([])
const uploadError = ref('')
const folderInput = ref(null)
const fileInput = ref(null)

// 3D Editor State
const editorViewer = ref(null)
const editorModelReady = ref(false)
const activeHighlightedMaterial = ref(null)
const validationErrors = ref([])
const saveFeedback = ref('')

const defaultForm = () => ({
  name: '',
  description: '',
  price: 4990,
  stock: 25,
  status: 'available',
  categories: ['kickcraft', 'sneakers'],
  glbPath: '', // Empty initially — owner must drop model first!
  thumbnailPath: '/images/kickcraft-one-card.png',
  charmsEnabled: true,
  parts: [],
  colors: [
    { name: 'Chalk', value: '#f1efe8' },
    { name: 'Graphite', value: '#292b2d' },
    { name: 'Cobalt', value: '#245fa8' },
    { name: 'Rust', value: '#b94d27' },
  ],
})

const form = ref(defaultForm())
const newColorName = ref('')
const newColorHex = ref('#245fa8')

// ── Orders & Financials State ──────────────────────────────────
const orders = ref([])
const orderStatusFilter = ref('all') // 'all' | 'paid' | 'pending' | 'cancelled'
const orderSearchQuery = ref('')

// Receipt Modal State
const showReceiptModal = ref(false)
const selectedOrderForReceipt = ref(null)

// Walk-in Sale Modal State
const showWalkInModal = ref(false)
const walkInForm = ref({
  shoeId: '',
  size: 9,
  customerName: 'Walk-in Customer',
  customerEmail: 'walkin@kickcraft.local',
  paymentMethod: 'cash',
  notes: 'Direct in-store customer purchase.',
})

// ── Lifecycle ──────────────────────────────────────────────────
onMounted(() => {
  loadData()
})

function loadData() {
  shoes.value = getStoredShoes()
  orders.value = getStoredOrders()
  emit('shoesChanged', shoes.value)
}

function persistShoes() {
  setStoredShoes(shoes.value)
  emit('shoesChanged', shoes.value)
}

function persistOrders() {
  setStoredOrders(orders.value)
}

// ── Inventory Filtering & Stats ────────────────────────────────
const filteredShoes = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return shoes.value.filter(shoe => {
    const matchesStatus =
      activeTab.value === 'all' ? true : shoe.status === activeTab.value

    const matchesQuery =
      !query ||
      shoe.name.toLowerCase().includes(query) ||
      shoe.description?.toLowerCase().includes(query) ||
      (shoe.categories && shoe.categories.some(c => c.toLowerCase().includes(query)))

    return matchesStatus && matchesQuery
  })
})

const stats = computed(() => {
  const total = shoes.value.length
  const available = shoes.value.filter(s => s.status === 'available').length
  const comingSoon = shoes.value.filter(s => s.status === 'coming_soon').length
  const outOfStock = shoes.value.filter(s => s.status === 'out_of_stock').length
  return { total, available, comingSoon, outOfStock }
})

// ── Financial Analytics & Orders Filtering ────────────────────
const financialStats = computed(() => calculateFinancialStats(orders.value))
const silhouetteBreakdown = computed(() => calculateSilhouetteBreakdown(orders.value))

const filteredOrders = computed(() => {
  const query = orderSearchQuery.value.trim().toLowerCase()
  return orders.value.filter(order => {
    const matchesStatus =
      orderStatusFilter.value === 'all' ? true : order.status === orderStatusFilter.value

    const matchesQuery =
      !query ||
      order.id.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.customerEmail.toLowerCase().includes(query) ||
      order.shoeName.toLowerCase().includes(query)

    return matchesStatus && matchesQuery
  })
})

function handleOrderStatusChange(orderId, newStatus) {
  orders.value = updateOrderStatus(orders.value, orderId, newStatus)
  persistOrders()
  if (selectedOrderForReceipt.value && selectedOrderForReceipt.value.id === orderId) {
    selectedOrderForReceipt.value = {
      ...selectedOrderForReceipt.value,
      status: newStatus,
    }
  }
}

function openReceipt(order) {
  selectedOrderForReceipt.value = order
  showReceiptModal.value = true
}

function printReceipt() {
  window.print()
}

function openWalkInSale() {
  const defaultShoe = shoes.value[0] || { id: 'kickcraft-one', name: 'KickCraft One', price: 4890 }
  walkInForm.value = {
    shoeId: defaultShoe.id,
    size: 9,
    customerName: 'Walk-in Customer',
    customerEmail: 'walkin@kickcraft.local',
    paymentMethod: 'cash',
    notes: 'Direct in-store customer purchase.',
  }
  showWalkInModal.value = true
}

function submitWalkInSale() {
  const targetShoe = shoes.value.find(s => s.id === walkInForm.value.shoeId) || shoes.value[0] || {
    id: 'kickcraft-one',
    name: 'KickCraft One',
    price: 4890,
  }

  const newOrder = createOrder(orders.value, {
    customerName: walkInForm.value.customerName || 'Walk-in Customer',
    customerEmail: walkInForm.value.customerEmail || 'walkin@kickcraft.local',
    shoeId: targetShoe.id,
    shoeName: targetShoe.name,
    size: Number(walkInForm.value.size) || 9,
    price: targetShoe.price || 4890,
    status: 'paid', // Walk-in sale is immediately paid
    paymentMethod: walkInForm.value.paymentMethod,
    notes: walkInForm.value.notes,
  })

  // Decrement inventory stock
  const currentStock = targetShoe.stock ?? 0
  if (currentStock > 0) {
    shoes.value = restockShoeRecord(shoes.value, targetShoe.id, currentStock - 1)
    persistShoes()
  }

  persistOrders()
  showWalkInModal.value = false
  openReceipt(newOrder)
}

// ── Folder & File Upload ───────────────────────────────────────
function triggerFolderPicker() {
  uploadError.value = ''
  folderInput.value?.click()
}

function triggerFilePicker() {
  uploadError.value = ''
  fileInput.value?.click()
}

function handleFileInputChange(event) {
  const fileList = event.target.files
  if (!fileList || !fileList.length) return
  processSelectedFiles(Array.from(fileList))
}

async function handleDrop(event) {
  event.preventDefault()
  uploadError.value = ''
  const dt = event.dataTransfer
  if (!dt) return

  const extractedFiles = []

  if (dt.items && dt.items.length) {
    const promises = []
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i]
      if (item.webkitGetAsEntry) {
        const entry = item.webkitGetAsEntry()
        if (entry) {
          promises.push(readEntryRecursive(entry, extractedFiles))
          continue
        }
      }
      const file = item.getAsFile()
      if (file) extractedFiles.push(file)
    }
    await Promise.all(promises)
  } else if (dt.files && dt.files.length) {
    for (let i = 0; i < dt.files.length; i++) {
      extractedFiles.push(dt.files[i])
    }
  }

  processSelectedFiles(extractedFiles)
}

function readEntryRecursive(entry, files) {
  return new Promise(resolve => {
    if (entry.isFile) {
      entry.file(file => {
        files.push(file)
        resolve()
      }, () => resolve())
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader()
      dirReader.readEntries(async entries => {
        const entryPromises = entries.map(child => readEntryRecursive(child, files))
        await Promise.all(entryPromises)
        resolve()
      }, () => resolve())
    } else {
      resolve()
    }
  })
}

function processSelectedFiles(fileList) {
  uploadError.value = ''
  const glbList = fileList.filter(f => f.name.toLowerCase().endsWith('.glb'))

  if (!glbList.length) {
    uploadError.value = 'No 3D model files (.glb) detected in the selected files or folder.'
    return
  }

  const detected = glbList.map(f => ({
    name: f.name,
    sizeFormatted: formatFileSize(f.size),
    rawFile: f,
    blobUrl: URL.createObjectURL(f),
  }))

  if (detected.length === 1) {
    configureDetectedModel(detected[0])
  } else {
    detectedFiles.value = detected
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function configureDetectedModel(detected) {
  const modelNameClean = detected.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')
  const capitalized = modelNameClean
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  form.value.name = capitalized.startsWith('KickCraft') ? capitalized : `KickCraft ${capitalized}`
  form.value.description = `Customizable silhouette based on ${detected.name}.`
  form.value.glbPath = detected.blobUrl
  form.value.parts = []
  detectedFiles.value = []
  uploadError.value = ''
}

function selectLibraryModel(path, name) {
  form.value.name = name
  form.value.description = `Customizable silhouette based on ${name}.`
  form.value.glbPath = path
  form.value.parts = []
  detectedFiles.value = []
  uploadError.value = ''
}

function changeModel() {
  form.value.glbPath = ''
  form.value.parts = []
  detectedFiles.value = []
  editorModelReady.value = false
  activeHighlightedMaterial.value = null
}

// ── Shoe Editor Actions ────────────────────────────────────────
function openNewShoeEditor() {
  form.value = defaultForm()
  detectedFiles.value = []
  uploadError.value = ''
  isEditing.value = false
  editingShoeId.value = null
  validationErrors.value = []
  saveFeedback.value = ''
  editorMode.value = true
}

function openEditShoe(shoe) {
  form.value = {
    name: shoe.name,
    description: shoe.description || '',
    price: shoe.price,
    stock: shoe.stock,
    status: shoe.status,
    categories: [...(shoe.categories || ['kickcraft'])],
    glbPath: shoe.glbPath,
    thumbnailPath: shoe.thumbnailPath,
    charmsEnabled: shoe.charmsEnabled !== false,
    parts: JSON.parse(JSON.stringify(shoe.parts || [])),
    colors: JSON.parse(JSON.stringify(shoe.colors || [])),
  }
  isEditing.value = true
  editingShoeId.value = shoe.id
  detectedFiles.value = []
  uploadError.value = ''
  validationErrors.value = []
  saveFeedback.value = ''
  editorMode.value = true
}

function closeEditor() {
  editorMode.value = false
  isEditing.value = false
  editingShoeId.value = null
  detectedFiles.value = []
  uploadError.value = ''
  activeHighlightedMaterial.value = null
  validationErrors.value = []
  saveFeedback.value = ''
}

// ── Model Material Auto-Detection & Highlighting ──────────────
function handleEditorModelLoad() {
  editorModelReady.value = true
  const model = editorViewer.value?.model
  if (!model) return

  const modelMats = model.materials || []
  if (!modelMats.length) return

  if (!form.value.parts || form.value.parts.length === 0) {
    form.value.parts = modelMats.map(mat => {
      const cleanLabel = mat.name
        .replace(/Material$/i, '')
        .replace(/([A-Z])/g, ' $1')
        .replace(/[-_]/g, ' ')
        .trim()
      return {
        id: slugify(cleanLabel) || slugify(mat.name),
        label: cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1),
        material: mat.name,
        customizable: true,
      }
    })
  } else {
    for (const mat of modelMats) {
      if (!form.value.parts.some(p => p.material === mat.name)) {
        const cleanLabel = mat.name
          .replace(/Material$/i, '')
          .replace(/([A-Z])/g, ' $1')
          .trim()
        form.value.parts.push({
          id: slugify(cleanLabel) || slugify(mat.name),
          label: cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1),
          material: mat.name,
          customizable: true,
        })
      }
    }
  }
}

function testHighlightPart(materialName) {
  activeHighlightedMaterial.value = materialName
  const model = editorViewer.value?.model
  if (!model) return
  highlightMaterial(model, materialName, '#ff2222')
}

function resetHighlight() {
  activeHighlightedMaterial.value = null
  const model = editorViewer.value?.model
  if (!model) return
  highlightMaterial(model, null)
}

// ── Thumbnail Upload ───────────────────────────────────────────
function handleThumbnailUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    form.value.thumbnailPath = e.target.result
  }
  reader.readAsDataURL(file)
}

// ── Color Palette Controls ─────────────────────────────────────
function addColorToPalette() {
  if (!newColorName.value.trim()) return
  form.value.colors.push({
    name: newColorName.value.trim(),
    value: newColorHex.value,
  })
  newColorName.value = ''
}

function removeColorFromPalette(index) {
  form.value.colors.splice(index, 1)
}

// ── Save Shoe ──────────────────────────────────────────────────
function handleSaveShoe() {
  validationErrors.value = []
  saveFeedback.value = ''

  if (!form.value.glbPath) {
    validationErrors.value = ['Please drop or select a 3D shoe model (.glb) first.']
    return
  }

  const customizableParts = form.value.parts.filter(p => p.customizable !== false)

  const candidate = {
    ...form.value,
    parts: customizableParts,
  }

  const validation = validateShoe(candidate)
  if (!validation.valid) {
    validationErrors.value = validation.errors
    return
  }

  if (isEditing.value && editingShoeId.value) {
    shoes.value = updateShoeRecord(shoes.value, editingShoeId.value, candidate)
    saveFeedback.value = `Updated "${candidate.name}" successfully!`
  } else {
    const newRecord = createShoeRecord(shoes.value, candidate)
    shoes.value.unshift(newRecord)
    saveFeedback.value = `Published "${newRecord.name}" successfully!`
  }

  persistShoes()

  setTimeout(() => {
    closeEditor()
  }, 1000)
}

// ── Quick Actions ──────────────────────────────────────────────
function handleToggleStatus(shoe) {
  const nextStatus =
    shoe.status === 'available'
      ? 'coming_soon'
      : shoe.status === 'coming_soon'
        ? 'out_of_stock'
        : 'available'

  shoes.value = updateShoeRecord(shoes.value, shoe.id, { status: nextStatus })
  persistShoes()
}

function openRestock(shoe) {
  restockTargetShoe.value = shoe
  restockAmount.value = 10
  showRestockModal.value = true
}

function confirmRestock() {
  if (!restockTargetShoe.value) return
  const newStock = (restockTargetShoe.value.stock || 0) + Number(restockAmount.value)
  shoes.value = restockShoeRecord(shoes.value, restockTargetShoe.value.id, newStock)
  persistShoes()
  showRestockModal.value = false
  restockTargetShoe.value = null
}

function handleDeleteShoe(shoe) {
  if (confirm(`Are you sure you want to delete "${shoe.name}"? This action cannot be undone.`)) {
    shoes.value = deleteShoeRecord(shoes.value, shoe.id)
    persistShoes()
  }
}
</script>

<template>
  <div class="mx-auto max-w-[1480px] px-5 py-6 lg:px-8">

    <!-- Top Breadcrumb & Status Bar -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#cfd2ce] pb-4">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="flex items-center gap-1.5 text-xs font-semibold text-[#5f635f] transition-colors hover:text-[#202220] focus-visible:outline-2 focus-visible:outline-[#245fa8]"
          @click="emit('backToShop')"
        >
          <svg class="size-3.5" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Back to Customer Shop
        </button>
        <span class="text-[#cfd2ce]">/</span>
        <span class="font-bold text-xs uppercase tracking-wider text-[#b94d27]">Owner Admin Portal</span>
      </div>

      <div class="flex items-center gap-3 text-xs">
        <span class="flex items-center gap-1.5 font-semibold text-[#5f635f]">
          <span class="size-2 rounded-full bg-[#3f7652]" />
          Signed in: <strong class="text-[#202220]">{{ currentUser?.email || 'owner@kickcraft.local' }}</strong>
        </span>
      </div>
    </div>

    <!-- ── Admin Section Tabs (Inventory vs Financials) ────────── -->
    <div class="mb-6 flex border-b border-[#cfd2ce] bg-white shadow-sm">
      <button
        type="button"
        class="flex items-center gap-2 border-b-2 px-6 py-3.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#245fa8]"
        :class="adminSection === 'inventory'
          ? 'border-[#b94d27] bg-[#fcfdfb] text-[#202220]'
          : 'border-transparent text-[#5f635f] hover:text-[#202220]'"
        @click="adminSection = 'inventory'; editorMode = false"
      >
        <span>👟</span>
        <span>Shoe Catalog &amp; Inventory</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 border-b-2 px-6 py-3.5 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-[#245fa8]"
        :class="adminSection === 'financials'
          ? 'border-[#b94d27] bg-[#fcfdfb] text-[#202220]'
          : 'border-transparent text-[#5f635f] hover:text-[#202220]'"
        @click="adminSection = 'financials'; editorMode = false"
      >
        <span>📈</span>
        <span>Financials &amp; Sales History</span>
        <span
          v-if="financialStats.pendingUnits > 0"
          class="rounded-full bg-[#c97d1e] px-1.5 py-0.5 text-[10px] font-black text-white"
        >
          {{ financialStats.pendingUnits }} pending
        </span>
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SECTION 1: INVENTORY & CATALOG VIEW                        -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div v-if="adminSection === 'inventory'">

      <!-- ── VIEW 1A: SHOE LIST & INVENTORY ──────────────────── -->
      <div v-if="!editorMode" class="space-y-6">

        <!-- Header & Action Button -->
        <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 class="font-display text-3xl font-black tracking-[-0.04em] text-[#202220]">
              Shoe Catalog &amp; Inventory
            </h1>
            <p class="mt-1 text-sm text-[#5f635f]">
              Manage existing silhouettes, view stock levels, or configure new 3D shoe models.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex items-center gap-2 bg-[#292b2d] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#b94d27] focus-visible:outline-2 focus-visible:outline-[#245fa8]"
              @click="openNewShoeEditor"
            >
              <svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
              </svg>
              Add New Shoe
            </button>
          </div>
        </div>

        <!-- Stat Badges Strip -->
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="border border-[#cfd2ce] bg-white p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-[#6a6e6a]">Total Silhouettes</p>
            <p class="mt-1 text-2xl font-black text-[#202220]">{{ stats.total }}</p>
          </div>
          <div class="border border-[#cfd2ce] bg-white p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-[#3f7652]">Available for Order</p>
            <p class="mt-1 text-2xl font-black text-[#3f7652]">{{ stats.available }}</p>
          </div>
          <div class="border border-[#cfd2ce] bg-white p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-[#c97d1e]">Coming Soon</p>
            <p class="mt-1 text-2xl font-black text-[#c97d1e]">{{ stats.comingSoon }}</p>
          </div>
          <div class="border border-[#cfd2ce] bg-white p-4">
            <p class="text-[11px] font-bold uppercase tracking-wider text-[#b94d27]">Out of Stock</p>
            <p class="mt-1 text-2xl font-black text-[#b94d27]">{{ stats.outOfStock }}</p>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="flex flex-col gap-4 border border-[#cfd2ce] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <!-- Status Tabs -->
          <div class="flex flex-wrap gap-1 text-xs font-bold">
            <button
              type="button"
              class="px-3 py-2 transition-colors"
              :class="activeTab === 'all' ? 'bg-[#292b2d] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
              @click="activeTab = 'all'"
            >
              All ({{ stats.total }})
            </button>
            <button
              type="button"
              class="px-3 py-2 transition-colors"
              :class="activeTab === 'available' ? 'bg-[#3f7652] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
              @click="activeTab = 'available'"
            >
              Available ({{ stats.available }})
            </button>
            <button
              type="button"
              class="px-3 py-2 transition-colors"
              :class="activeTab === 'coming_soon' ? 'bg-[#c97d1e] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
              @click="activeTab = 'coming_soon'"
            >
              Coming Soon ({{ stats.comingSoon }})
            </button>
            <button
              type="button"
              class="px-3 py-2 transition-colors"
              :class="activeTab === 'out_of_stock' ? 'bg-[#b94d27] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
              @click="activeTab = 'out_of_stock'"
            >
              Out of Stock ({{ stats.outOfStock }})
            </button>
          </div>

          <!-- Search -->
          <div class="relative sm:w-72">
            <input
              v-model="searchQuery"
              type="search"
              placeholder="Search shoes by name or category..."
              class="h-9 w-full border border-[#cfd2ce] bg-[#fcfdfb] pl-8 pr-3 text-xs outline-none focus:border-[#245fa8]"
            />
            <svg class="absolute left-2.5 top-2.5 size-4 text-[#8e938e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <!-- Shoe Cards Grid -->
        <div v-if="filteredShoes.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="shoe in filteredShoes"
            :key="shoe.id"
            class="flex flex-col border border-[#cfd2ce] bg-white transition-shadow hover:shadow-md"
          >
            <!-- Image preview with status badge -->
            <div class="relative aspect-video w-full overflow-hidden bg-[#e9ece9]">
              <img
                :src="shoe.thumbnailPath"
                :alt="shoe.name"
                class="size-full object-cover object-center"
                @error="$event.target.src = '/images/kickcraft-one-card.png'"
              />
              <span
                class="absolute right-3 top-3 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                :class="{
                  'bg-[#3f7652]': shoe.status === 'available',
                  'bg-[#c97d1e]': shoe.status === 'coming_soon',
                  'bg-[#b94d27]': shoe.status === 'out_of_stock',
                }"
              >
                {{ shoe.status.replace('_', ' ') }}
              </span>
            </div>

            <!-- Card Content -->
            <div class="flex flex-1 flex-col p-4">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h3 class="font-display text-lg font-black tracking-[-0.03em] text-[#202220]">
                    {{ shoe.name }}
                  </h3>
                  <p class="text-xs text-[#6a6e6a] line-clamp-1">{{ shoe.description }}</p>
                </div>
                <span class="font-display font-black text-sm text-[#b94d27]">
                  {{ shoe.formattedPrice || `₱${shoe.price?.toLocaleString()}` }}
                </span>
              </div>

              <!-- Categories tags -->
              <div class="mt-3 flex flex-wrap gap-1">
                <span
                  v-for="cat in shoe.categories"
                  :key="cat"
                  class="border border-[#cfd2ce] bg-[#f5f6f4] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#5f635f]"
                >
                  {{ cat }}
                </span>
              </div>

              <!-- Stock & parts counter info -->
              <div class="mt-4 flex items-center justify-between border-t border-[#f1f3f0] pt-3 text-xs text-[#5f635f]">
                <span>
                  Stock: <strong class="text-[#202220]">{{ shoe.stock ?? 0 }}</strong> pairs
                </span>
                <span>
                  <strong>{{ shoe.parts?.length || 0 }}</strong> custom parts
                </span>
              </div>

              <!-- Action buttons strip -->
              <div class="mt-4 grid grid-cols-3 gap-2 border-t border-[#f1f3f0] pt-3">
                <button
                  type="button"
                  class="h-8 border border-[#bfc3bf] bg-white text-[11px] font-bold text-[#202220] transition-colors hover:border-[#292b2d]"
                  @click="openEditShoe(shoe)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="h-8 border border-[#bfc3bf] bg-white text-[11px] font-bold text-[#245fa8] transition-colors hover:border-[#245fa8] hover:bg-[#edf5f0]"
                  @click="openRestock(shoe)"
                >
                  Restock
                </button>
                <button
                  type="button"
                  class="h-8 border border-[#bfc3bf] bg-white text-[11px] font-bold text-[#b94d27] transition-colors hover:border-[#b94d27] hover:bg-[#fdf2ef]"
                  @click="handleDeleteShoe(shoe)"
                >
                  Delete
                </button>
              </div>

              <!-- Preview in Customer Studio link -->
              <div class="mt-3 text-center">
                <button
                  type="button"
                  class="text-[11px] font-semibold text-[#5f635f] underline hover:text-[#202220]"
                  @click="emit('openStudio', shoe.id)"
                >
                  Test in 3D Customer Studio →
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-else class="border border-[#cfd2ce] bg-white p-12 text-center">
          <p class="font-display text-lg font-bold text-[#202220]">No shoes match your filter</p>
          <p class="mt-1 text-xs text-[#5f635f]">Try adjusting your search query or add a new 3D model.</p>
          <button
            type="button"
            class="mx-auto mt-4 flex items-center gap-2 bg-[#292b2d] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#b94d27]"
            @click="openNewShoeEditor"
          >
            <svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Add New Shoe
          </button>
        </div>

      </div>

      <!-- ── VIEW 1B: 3D SHOE CONFIGURATION & EDITOR ─────────── -->
      <div v-else class="space-y-6">

        <!-- Editor Header -->
        <div class="flex items-center justify-between border-b border-[#cfd2ce] pb-4">
          <div>
            <button
              type="button"
              class="flex items-center gap-1.5 text-xs font-bold text-[#5f635f] hover:text-[#202220]"
              @click="closeEditor"
            >
              ← Back to Shoe Inventory
            </button>
            <h2 class="font-display mt-2 text-2xl font-black tracking-[-0.03em] text-[#202220]">
              {{ isEditing ? `Edit: ${form.name}` : (form.glbPath ? `Configure: ${form.name}` : 'Add New 3D Shoe Model') }}
            </h2>
          </div>

          <div v-if="form.glbPath" class="flex items-center gap-2">
            <button
              type="button"
              class="border border-[#bfc3bf] bg-white px-4 py-2 text-xs font-bold text-[#5f635f] hover:border-[#292b2d]"
              @click="closeEditor"
            >
              Cancel
            </button>
            <button
              type="button"
              class="bg-[#b94d27] px-5 py-2 text-xs font-bold text-white hover:bg-[#963a20]"
              @click="handleSaveShoe"
            >
              {{ isEditing ? 'Save Changes' : 'Publish Shoe to Shop' }}
            </button>
          </div>
        </div>

        <!-- Feedback notifications -->
        <div v-if="saveFeedback" class="border border-[#3f7652]/30 bg-[#edf5f0] p-4 text-xs font-bold text-[#2a593a]">
          {{ saveFeedback }}
        </div>
        <div v-if="validationErrors.length" class="border border-[#b94d27]/30 bg-[#fdf2ef] p-4 text-xs text-[#963a20]">
          <p class="font-bold">Please resolve the following issues:</p>
          <ul class="mt-1.5 list-inside list-disc space-y-0.5">
            <li v-for="(err, idx) in validationErrors" :key="idx">{{ err }}</li>
          </ul>
        </div>

        <!-- STEP 1: DROPZONE (When no 3D model is loaded yet) -->
        <div
          v-if="!form.glbPath"
          class="border-2 border-dashed border-[#b94d27] bg-[#fcfdfb] p-8 sm:p-14 text-center transition-all"
          @dragover.prevent
          @drop="handleDrop"
        >
          <div class="mx-auto grid size-16 place-items-center bg-[#fdf2ef] text-[#b94d27]">
            <svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <h3 class="mt-4 font-display text-2xl font-black text-[#202220]">
            Upload 3D Shoe Model or Folder
          </h3>
          <p class="mx-auto mt-2 max-w-md text-xs leading-5 text-[#5f635f]">
            Drag and drop a folder of 3D shoes or an individual <code class="bg-[#f1f3f0] px-1 py-0.5 font-bold text-[#202220]">.glb</code> model file here. Customization options will appear once the file is loaded.
          </p>

          <!-- Hidden inputs -->
          <input
            ref="folderInput"
            type="file"
            webkitdirectory
            directory
            multiple
            class="hidden"
            @change="handleFileInputChange"
          />
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".glb"
            class="hidden"
            @change="handleFileInputChange"
          />

          <!-- Action buttons -->
          <div class="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              class="border border-[#292b2d] bg-[#292b2d] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#b94d27]"
              @click="triggerFolderPicker"
            >
              Browse Folder
            </button>
            <button
              type="button"
              class="border border-[#bfc3bf] bg-white px-5 py-2.5 text-xs font-bold text-[#202220] transition-colors hover:border-[#292b2d]"
              @click="triggerFilePicker"
            >
              Choose .GLB File
            </button>
          </div>

          <div v-if="uploadError" class="mt-4 text-xs font-semibold text-[#b94d27]">
            {{ uploadError }}
          </div>

          <!-- Detected Models from Folder Selection -->
          <div v-if="detectedFiles.length > 1" class="mt-8 border-t border-[#d9dcd8] pt-6 text-left">
            <h4 class="font-display text-xs font-bold uppercase tracking-wider text-[#404345]">
              Detected 3D Models in Folder ({{ detectedFiles.length }})
            </h4>
            <p class="text-xs text-[#6a6e6a]">Select which model to customize:</p>

            <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div
                v-for="(detected, idx) in detectedFiles"
                :key="idx"
                class="flex items-center justify-between border border-[#cfd2ce] bg-white p-3 shadow-sm"
              >
                <div class="overflow-hidden pr-2">
                  <p class="truncate text-xs font-bold text-[#202220]" :title="detected.name">
                    {{ detected.name }}
                  </p>
                  <p class="text-[10px] text-[#6a6e6a]">{{ detected.sizeFormatted }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 bg-[#245fa8] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#184478]"
                  @click="configureDetectedModel(detected)"
                >
                  Customize →
                </button>
              </div>
            </div>
          </div>

          <!-- Or Choose from Existing Model Library -->
          <div class="mt-10 border-t border-[#d9dcd8] pt-6">
            <p class="text-[11px] font-bold uppercase tracking-wider text-[#8e938e]">
              Or choose an existing 3D model from the library
            </p>
            <div class="mt-3 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                class="border border-[#cfd2ce] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f635f] hover:border-[#292b2d] hover:text-[#202220]"
                @click="selectLibraryModel('/models/shoe-soleview-final.glb', 'KickCraft One Silhouette')"
              >
                KickCraft One (.glb)
              </button>
              <button
                type="button"
                class="border border-[#cfd2ce] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f635f] hover:border-[#292b2d] hover:text-[#202220]"
                @click="selectLibraryModel('/models/nike-air-max-custom.glb', 'Air Max Silhouette')"
              >
                Air Max (.glb)
              </button>
              <button
                type="button"
                class="border border-[#cfd2ce] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f635f] hover:border-[#292b2d] hover:text-[#202220]"
                @click="selectLibraryModel('/models/nike-dunk.glb', 'Dunk Silhouette')"
              >
                Nike Dunk (.glb)
              </button>
            </div>
          </div>
        </div>

        <!-- STEP 2: CUSTOMIZATION CONTROLS -->
        <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(380px,1fr)]">

          <!-- Left Column: 3D Model Preview & Material Highlighting Guide -->
          <div class="flex flex-col space-y-3">
            <div class="relative h-[540px] w-full border border-[#bfc3bf] bg-[#e9ece9]">
              <model-viewer
                ref="editorViewer"
                :src="form.glbPath"
                alt="3D model configurator preview"
                camera-controls
                touch-action="pan-y"
                shadow-intensity="1"
                shadow-softness="1"
                exposure="1"
                environment-image="neutral"
                interaction-prompt="auto"
                style="width:100%;height:100%;"
                @load="handleEditorModelLoad"
              />

              <!-- Top Indicator & Change Model button -->
              <div class="absolute left-3 top-3 flex items-center gap-2">
                <span class="flex items-center gap-1.5 bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-sm">
                  <span class="size-2 bg-[#3f7652]" />
                  Interactive 3D Preview
                </span>
                <button
                  type="button"
                  class="border border-[#bfc3bf] bg-white/95 px-2.5 py-1.5 text-xs font-bold text-[#5f635f] shadow-sm hover:border-[#292b2d] hover:text-[#202220]"
                  @click="changeModel"
                >
                  Change 3D Model
                </button>
              </div>

              <!-- Material highlight banner -->
              <div
                v-if="activeHighlightedMaterial"
                class="absolute bottom-3 left-3 right-3 flex items-center justify-between border border-[#b94d27] bg-[#292b2d] px-4 py-2.5 text-xs text-white shadow-md"
              >
                <span>
                  Highlighting Part: <strong class="text-[#b94d27]">{{ activeHighlightedMaterial }}</strong> (turned red)
                </span>
                <button
                  type="button"
                  class="text-[11px] underline hover:text-[#f1efe8]"
                  @click="resetHighlight"
                >
                  Reset Color
                </button>
              </div>
            </div>

            <div class="border border-[#cfd2ce] bg-[#fcfdfb] p-3 text-xs text-[#5f635f]">
              <strong class="text-[#202220]">Point &amp; Verify:</strong> Click any material button in the "Customizable Parts" section on the right. The corresponding mesh will glow red in the 3D viewer above so you can easily identify each part.
            </div>
          </div>

          <!-- Right Column: Settings, Material Auto-Detection & Palette -->
          <div class="space-y-6">

            <!-- Section 1: Basic Information -->
            <div class="border border-[#cfd2ce] bg-white p-5">
              <h3 class="font-display text-sm font-bold uppercase tracking-wider text-[#202220]">
                1. Basic Information
              </h3>

              <div class="mt-4 space-y-4">
                <label class="block">
                  <span class="mb-1 block text-xs font-bold text-[#404345]">Shoe Name</span>
                  <input
                    v-model="form.name"
                    type="text"
                    placeholder="e.g. KickCraft Velocity"
                    class="h-10 w-full border border-[#cfd2ce] px-3 text-xs outline-none focus:border-[#245fa8]"
                  />
                </label>

                <label class="block">
                  <span class="mb-1 block text-xs font-bold text-[#404345]">Description</span>
                  <textarea
                    v-model="form.description"
                    rows="2"
                    placeholder="Brief summary of silhouette, intended performance, and design highlights."
                    class="w-full border border-[#cfd2ce] p-2.5 text-xs outline-none focus:border-[#245fa8]"
                  />
                </label>

                <div class="grid grid-cols-3 gap-3">
                  <label class="block">
                    <span class="mb-1 block text-xs font-bold text-[#404345]">Price (₱)</span>
                    <input
                      v-model.number="form.price"
                      type="number"
                      min="1"
                      class="h-10 w-full border border-[#cfd2ce] px-3 text-xs outline-none focus:border-[#245fa8]"
                    />
                  </label>

                  <label class="block">
                    <span class="mb-1 block text-xs font-bold text-[#404345]">Stock (Pairs)</span>
                    <input
                      v-model.number="form.stock"
                      type="number"
                      min="0"
                      class="h-10 w-full border border-[#cfd2ce] px-3 text-xs outline-none focus:border-[#245fa8]"
                    />
                  </label>

                  <label class="block">
                    <span class="mb-1 block text-xs font-bold text-[#404345]">Initial Status</span>
                    <select
                      v-model="form.status"
                      class="h-10 w-full border border-[#cfd2ce] bg-white px-2 text-xs outline-none focus:border-[#245fa8]"
                    >
                      <option value="available">Available</option>
                      <option value="coming_soon">Coming Soon</option>
                      <option value="out_of_stock">Out of Stock</option>
                    </select>
                  </label>
                </div>

                <!-- Categories Checkboxes -->
                <div>
                  <span class="mb-1.5 block text-xs font-bold text-[#404345]">Categories</span>
                  <div class="flex flex-wrap gap-2">
                    <label
                      v-for="cat in CATEGORIES.filter(c => c.id !== 'all')"
                      :key="cat.id"
                      class="flex items-center gap-1.5 border border-[#cfd2ce] bg-[#fcfdfb] px-2.5 py-1 text-xs cursor-pointer select-none"
                      :class="form.categories.includes(cat.id) ? 'border-[#292b2d] bg-[#292b2d] text-white' : 'text-[#5f635f]'"
                    >
                      <input
                        v-model="form.categories"
                        type="checkbox"
                        :value="cat.id"
                        class="hidden"
                      />
                      <span>{{ cat.label }}</span>
                    </label>
                  </div>
                </div>

                <!-- Thumbnail & Charm Options -->
                <div class="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span class="mb-1 block text-xs font-bold text-[#404345]">Catalog Thumbnail</span>
                    <div class="flex items-center gap-3">
                      <img
                        :src="form.thumbnailPath"
                        alt="Thumbnail preview"
                        class="size-12 border border-[#cfd2ce] object-cover"
                        @error="$event.target.src = '/images/kickcraft-one-card.png'"
                      />
                      <label class="cursor-pointer border border-[#bfc3bf] bg-[#f5f6f4] px-3 py-1.5 text-xs font-bold hover:border-[#292b2d]">
                        Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          class="hidden"
                          @change="handleThumbnailUpload"
                        />
                      </label>
                    </div>
                  </div>

                  <div class="flex flex-col justify-center">
                    <label class="flex items-center gap-2 cursor-pointer select-none text-xs">
                      <input
                        v-model="form.charmsEnabled"
                        type="checkbox"
                        class="size-4 accent-[#292b2d]"
                      />
                      <span class="font-bold text-[#404345]">Enable 3D Charms</span>
                    </label>
                    <p class="mt-0.5 text-[10px] text-[#6a6e6a]">
                      Allows Star, Lightning, and K-tag attachments on CharmAnchor.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 2: Auto-Detected Materials & Part Mapping -->
            <div class="border border-[#cfd2ce] bg-white p-5">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-display text-sm font-bold uppercase tracking-wider text-[#202220]">
                    2. Customizable Parts (Auto-Detected)
                  </h3>
                  <p class="mt-0.5 text-xs text-[#6a6e6a]">
                    Click a material to highlight it red in the 3D viewer, then give it a customer-facing label.
                  </p>
                </div>
                <span class="bg-[#f1f3f0] px-2 py-1 text-[11px] font-bold text-[#202220]">
                  {{ form.parts.filter(p => p.customizable !== false).length }} Active Parts
                </span>
              </div>

              <!-- Materials List -->
              <div v-if="form.parts.length" class="mt-4 space-y-2.5">
                <div
                  v-for="(part, idx) in form.parts"
                  :key="part.material"
                  class="flex flex-wrap items-center justify-between gap-2 border border-[#cfd2ce] p-2.5"
                  :class="activeHighlightedMaterial === part.material ? 'border-[#b94d27] bg-[#fdf2ef]' : 'bg-[#fcfdfb]'"
                >
                  <!-- Highlight trigger button -->
                  <button
                    type="button"
                    class="flex items-center gap-2 text-left font-mono text-xs font-bold transition-colors hover:text-[#b94d27]"
                    :title="`Click to highlight ${part.material} in 3D`"
                    @click="testHighlightPart(part.material)"
                  >
                    <span
                      class="size-3 border border-black/20"
                      :class="activeHighlightedMaterial === part.material ? 'bg-[#ff2222]' : 'bg-[#bfc3bf]'"
                    />
                    <span>{{ part.material }}</span>
                  </button>

                  <!-- Customer Label input & Customizable Toggle -->
                  <div class="flex items-center gap-3">
                    <input
                      v-model="part.label"
                      type="text"
                      placeholder="Customer part label"
                      class="h-8 w-32 border border-[#cfd2ce] bg-white px-2 text-xs outline-none focus:border-[#245fa8]"
                    />
                    <label class="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        v-model="part.customizable"
                        type="checkbox"
                        class="size-3.5 accent-[#292b2d]"
                      />
                      <span class="text-[11px] font-semibold text-[#5f635f]">Customizable</span>
                    </label>
                  </div>
                </div>
              </div>

              <div v-else class="mt-4 border border-[#cfd2ce] bg-[#f5f6f4] p-4 text-center text-xs text-[#6a6e6a]">
                Loading materials from 3D model...
              </div>
            </div>

            <!-- Section 3: Color Palette Configuration -->
            <div class="border border-[#cfd2ce] bg-white p-5">
              <h3 class="font-display text-sm font-bold uppercase tracking-wider text-[#202220]">
                3. Color Palette Configuration
              </h3>
              <p class="mt-0.5 text-xs text-[#6a6e6a]">
                Define the specific colors customers can apply across all customizable parts on this shoe.
              </p>

              <!-- Current Swatches List -->
              <div class="mt-4 flex flex-wrap gap-2">
                <div
                  v-for="(col, idx) in form.colors"
                  :key="idx"
                  class="flex items-center gap-2 border border-[#cfd2ce] bg-[#fcfdfb] py-1 pl-2 pr-1.5 text-xs shadow-sm"
                >
                  <span
                    class="size-3.5 border border-black/20 shadow-inner"
                    :style="{ backgroundColor: col.value }"
                  />
                  <span class="font-bold text-[#202220]">{{ col.name }}</span>
                  <span class="font-mono text-[10px] text-[#8e938e]">{{ col.value }}</span>
                  <button
                    type="button"
                    class="ml-1 size-4 rounded-full text-xs text-[#8e938e] hover:bg-[#b94d27] hover:text-white"
                    title="Remove color"
                    @click="removeColorFromPalette(idx)"
                  >
                    ×
                  </button>
                </div>
              </div>

              <!-- Add Color Input Group -->
              <div class="mt-4 flex flex-wrap items-center gap-3 border-t border-[#f1f3f0] pt-4">
                <div class="flex items-center gap-2">
                  <input
                    v-model="newColorHex"
                    type="color"
                    class="size-8 cursor-pointer border border-[#cfd2ce] p-0.5"
                  />
                  <input
                    v-model="newColorName"
                    type="text"
                    placeholder="Color Name (e.g. Cobalt)"
                    class="h-8 w-44 border border-[#cfd2ce] px-2.5 text-xs outline-none focus:border-[#245fa8]"
                    @keydown.enter.prevent="addColorToPalette"
                  />
                </div>

                <button
                  type="button"
                  class="h-8 bg-[#292b2d] px-3 text-xs font-bold text-white transition-colors hover:bg-[#b94d27]"
                  @click="addColorToPalette"
                >
                  + Add Color
                </button>
              </div>
            </div>

            <!-- Bottom Action Buttons -->
            <div class="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                class="border border-[#bfc3bf] bg-white px-5 py-2.5 text-xs font-bold text-[#5f635f] hover:border-[#292b2d]"
                @click="closeEditor"
              >
                Cancel
              </button>
              <button
                type="button"
                class="bg-[#b94d27] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#963a20] shadow-sm"
                @click="handleSaveShoe"
              >
                {{ isEditing ? 'Save Changes' : 'Publish Shoe to Shop' }}
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SECTION 2: FINANCIALS & SALES HISTORY                      -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div v-else-if="adminSection === 'financials'" class="space-y-6">

      <!-- Header & Record Sale Button -->
      <div class="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 class="font-display text-3xl font-black tracking-[-0.04em] text-[#202220]">
            Financials &amp; Sales Ledger
          </h1>
          <p class="mt-1 text-sm text-[#5f635f]">
            Monitor realized revenue, track pending custom reservations, inspect receipts, and manage walk-in sales.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button
            type="button"
            class="flex items-center gap-2 bg-[#292b2d] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#3f7652] focus-visible:outline-2 focus-visible:outline-[#245fa8]"
            @click="openWalkInSale"
          >
            <svg class="size-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Record Walk-in Sale
          </button>
        </div>
      </div>

      <!-- Financial KPI Metrics Cards -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="border border-[#cfd2ce] bg-white p-5 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#3f7652]">Realized Revenue</p>
          <p class="mt-1 font-display text-2xl font-black text-[#3f7652] sm:text-3xl">
            ₱{{ financialStats.realizedRevenue.toLocaleString() }}
          </p>
          <p class="mt-1 text-[11px] text-[#6a6e6a]">From {{ financialStats.paidUnits }} completed &amp; paid orders</p>
        </div>

        <div class="border border-[#cfd2ce] bg-white p-5 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#c97d1e]">Pending Receivables</p>
          <p class="mt-1 font-display text-2xl font-black text-[#c97d1e] sm:text-3xl">
            ₱{{ financialStats.pendingRevenue.toLocaleString() }}
          </p>
          <p class="mt-1 text-[11px] text-[#6a6e6a]">{{ financialStats.pendingUnits }} pickup reservations awaiting payment</p>
        </div>

        <div class="border border-[#cfd2ce] bg-white p-5 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#202220]">Pairs Sold</p>
          <p class="mt-1 font-display text-2xl font-black text-[#202220] sm:text-3xl">
            {{ financialStats.paidUnits }}
          </p>
          <p class="mt-1 text-[11px] text-[#6a6e6a]">Total physical pairs delivered</p>
        </div>

        <div class="border border-[#cfd2ce] bg-white p-5 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-[#245fa8]">Average Order Value</p>
          <p class="mt-1 font-display text-2xl font-black text-[#245fa8] sm:text-3xl">
            ₱{{ financialStats.aov.toLocaleString() }}
          </p>
          <p class="mt-1 text-[11px] text-[#6a6e6a]">Average spend per paid transaction</p>
        </div>
      </div>

      <!-- Silhouette Breakdown Section -->
      <div class="border border-[#cfd2ce] bg-white p-5 shadow-sm">
        <h3 class="font-display text-sm font-bold uppercase tracking-wider text-[#202220]">
          Revenue &amp; Sales by Shoe Silhouette
        </h3>
        <p class="mt-0.5 text-xs text-[#6a6e6a]">
          Breakdown of total revenue and sales volume generated per shoe model.
        </p>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="item in silhouetteBreakdown"
            :key="item.shoeId"
            class="flex items-center justify-between border border-[#cfd2ce] bg-[#fcfdfb] p-3.5"
          >
            <div>
              <p class="font-display text-sm font-bold text-[#202220]">{{ item.shoeName }}</p>
              <p class="text-xs text-[#5f635f]">
                {{ item.paidUnits }} sold · {{ item.pendingUnits }} pending
              </p>
            </div>
            <div class="text-right">
              <p class="font-display text-sm font-black text-[#3f7652]">
                ₱{{ item.revenue.toLocaleString() }}
              </p>
              <span class="text-[10px] uppercase font-bold text-[#8e938e]">Collected</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Filter & Search Controls for Orders -->
      <div class="flex flex-col gap-4 border border-[#cfd2ce] bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <!-- Status Filter Tabs -->
        <div class="flex flex-wrap gap-1 text-xs font-bold">
          <button
            type="button"
            class="px-3 py-2 transition-colors"
            :class="orderStatusFilter === 'all' ? 'bg-[#292b2d] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
            @click="orderStatusFilter = 'all'"
          >
            All Orders ({{ orders.length }})
          </button>
          <button
            type="button"
            class="px-3 py-2 transition-colors"
            :class="orderStatusFilter === 'paid' ? 'bg-[#3f7652] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
            @click="orderStatusFilter = 'paid'"
          >
            Paid ({{ financialStats.paidUnits }})
          </button>
          <button
            type="button"
            class="px-3 py-2 transition-colors"
            :class="orderStatusFilter === 'pending' ? 'bg-[#c97d1e] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
            @click="orderStatusFilter = 'pending'"
          >
            Pending Pickup ({{ financialStats.pendingUnits }})
          </button>
          <button
            type="button"
            class="px-3 py-2 transition-colors"
            :class="orderStatusFilter === 'cancelled' ? 'bg-[#b94d27] text-white' : 'text-[#5f635f] hover:bg-[#f1f3f0]'"
            @click="orderStatusFilter = 'cancelled'"
          >
            Cancelled ({{ financialStats.cancelledUnits }})
          </button>
        </div>

        <!-- Search input -->
        <div class="relative sm:w-72">
          <input
            v-model="orderSearchQuery"
            type="search"
            placeholder="Search receipt #, customer name, email..."
            class="h-9 w-full border border-[#cfd2ce] bg-[#fcfdfb] pl-8 pr-3 text-xs outline-none focus:border-[#245fa8]"
          />
          <svg class="absolute left-2.5 top-2.5 size-4 text-[#8e938e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Orders & Transactions Table -->
      <div class="overflow-x-auto border border-[#cfd2ce] bg-white shadow-sm">
        <table class="w-full text-left text-xs">
          <thead class="border-b border-[#cfd2ce] bg-[#f1f3f0] font-bold uppercase tracking-wider text-[#404345]">
            <tr>
              <th class="px-4 py-3">Receipt / Order #</th>
              <th class="px-4 py-3">Date</th>
              <th class="px-4 py-3">Customer</th>
              <th class="px-4 py-3">Shoe Model &amp; Size</th>
              <th class="px-4 py-3">Amount</th>
              <th class="px-4 py-3">Payment Status</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#f1f3f0]">
            <tr
              v-for="order in filteredOrders"
              :key="order.id"
              class="transition-colors hover:bg-[#fcfdfb]"
            >
              <!-- Receipt # -->
              <td class="whitespace-nowrap px-4 py-3 font-mono font-bold text-[#202220]">
                {{ order.id }}
              </td>

              <!-- Date -->
              <td class="whitespace-nowrap px-4 py-3 text-[#5f635f]">
                {{ new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </td>

              <!-- Customer -->
              <td class="px-4 py-3">
                <p class="font-bold text-[#202220]">{{ order.customerName }}</p>
                <p class="text-[11px] text-[#6a6e6a]">{{ order.customerEmail }}</p>
              </td>

              <!-- Shoe & Size -->
              <td class="px-4 py-3">
                <span class="font-semibold text-[#202220]">{{ order.shoeName }}</span>
                <span class="ml-1.5 border border-[#cfd2ce] bg-[#f5f6f4] px-1.5 py-0.2 text-[10px] font-bold">
                  Size {{ order.size }}
                </span>
                <p v-if="order.charmLabel && order.charmLabel !== 'None'" class="text-[10px] text-[#6a6e6a]">
                  Accessory: {{ order.charmLabel }}
                </p>
              </td>

              <!-- Price -->
              <td class="whitespace-nowrap px-4 py-3 font-display font-black text-sm text-[#202220]">
                ₱{{ order.price?.toLocaleString() }}
              </td>

              <!-- Status -->
              <td class="whitespace-nowrap px-4 py-3">
                <span
                  class="inline-block px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm"
                  :class="{
                    'bg-[#3f7652]': order.status === 'paid',
                    'bg-[#c97d1e]': order.status === 'pending',
                    'bg-[#b94d27]': order.status === 'cancelled',
                  }"
                >
                  {{ order.status }}
                </span>
              </td>

              <!-- Action buttons -->
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    class="border border-[#bfc3bf] bg-white px-2.5 py-1 text-[11px] font-bold text-[#202220] hover:border-[#292b2d]"
                    @click="openReceipt(order)"
                  >
                    View Receipt
                  </button>

                  <button
                    v-if="order.status === 'pending'"
                    type="button"
                    class="bg-[#3f7652] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#2a593a]"
                    title="Mark order as paid upon customer pickup"
                    @click="handleOrderStatusChange(order.id, 'paid')"
                  >
                    Mark Paid
                  </button>
                </div>
              </td>
            </tr>

            <tr v-if="filteredOrders.length === 0">
              <td colspan="7" class="px-4 py-8 text-center text-[#6a6e6a]">
                No orders match your filter criteria.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- ── Restock Modal ───────────────────────────────────────── -->
    <div
      v-if="showRestockModal"
      class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div class="w-full max-w-sm border border-[#292b2d] bg-white p-6 shadow-xl">
        <h3 class="font-display text-lg font-black text-[#202220]">
          Restock {{ restockTargetShoe?.name }}
        </h3>
        <p class="mt-1 text-xs text-[#5f635f]">
          Current inventory: <strong>{{ restockTargetShoe?.stock ?? 0 }} pairs</strong>.
        </p>

        <div class="mt-4">
          <label class="block text-xs font-bold text-[#404345]">
            Pairs to add to inventory:
            <input
              v-model.number="restockAmount"
              type="number"
              min="1"
              class="mt-1 h-10 w-full border border-[#cfd2ce] px-3 text-sm outline-none focus:border-[#245fa8]"
            />
          </label>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="border border-[#bfc3bf] bg-white px-4 py-2 text-xs font-bold text-[#5f635f] hover:border-[#292b2d]"
            @click="showRestockModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="bg-[#245fa8] px-5 py-2 text-xs font-bold text-white hover:bg-[#184478]"
            @click="confirmRestock"
          >
            Update Stock
          </button>
        </div>
      </div>
    </div>

    <!-- ── Walk-in Sale Modal ──────────────────────────────────── -->
    <div
      v-if="showWalkInModal"
      class="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
    >
      <div class="w-full max-w-md border border-[#292b2d] bg-white p-6 shadow-2xl">
        <div class="flex items-center justify-between border-b border-[#cfd2ce] pb-3">
          <h3 class="font-display text-lg font-black text-[#202220]">
            Record Walk-in Store Sale
          </h3>
          <button
            type="button"
            class="size-6 text-sm text-[#8e938e] hover:text-[#202220]"
            @click="showWalkInModal = false"
          >
            ✕
          </button>
        </div>

        <form class="mt-4 space-y-4" @submit.prevent="submitWalkInSale">
          <div>
            <label class="block text-xs font-bold text-[#404345]">Select Shoe Model</label>
            <select
              v-model="walkInForm.shoeId"
              required
              class="mt-1 h-10 w-full border border-[#cfd2ce] bg-white px-3 text-xs outline-none focus:border-[#245fa8]"
            >
              <option v-for="s in shoes" :key="s.id" :value="s.id">
                {{ s.name }} — ₱{{ s.price?.toLocaleString() }} ({{ s.stock }} in stock)
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-[#404345]">Shoe Size (US)</label>
              <select
                v-model.number="walkInForm.size"
                class="mt-1 h-10 w-full border border-[#cfd2ce] bg-white px-3 text-xs outline-none focus:border-[#245fa8]"
              >
                <option :value="7">US 7</option>
                <option :value="8">US 8</option>
                <option :value="9">US 9</option>
                <option :value="10">US 10</option>
                <option :value="11">US 11</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-[#404345]">Payment Method</label>
              <select
                v-model="walkInForm.paymentMethod"
                class="mt-1 h-10 w-full border border-[#cfd2ce] bg-white px-3 text-xs outline-none focus:border-[#245fa8]"
              >
                <option value="cash">Cash</option>
                <option value="gcash">GCash</option>
                <option value="card">Credit / Debit Card</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-[#404345]">Customer Name (Optional)</label>
            <input
              v-model="walkInForm.customerName"
              type="text"
              placeholder="e.g. Walk-in Customer"
              class="mt-1 h-10 w-full border border-[#cfd2ce] px-3 text-xs outline-none focus:border-[#245fa8]"
            />
          </div>

          <div class="flex justify-end gap-3 border-t border-[#f1f3f0] pt-4">
            <button
              type="button"
              class="border border-[#bfc3bf] bg-white px-4 py-2 text-xs font-bold text-[#5f635f] hover:border-[#292b2d]"
              @click="showWalkInModal = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="bg-[#3f7652] px-5 py-2 text-xs font-bold text-white hover:bg-[#2a593a]"
            >
              Record Paid Sale &amp; Issue Receipt
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Digital Receipt Voucher Modal ───────────────────────── -->
    <div
      v-if="showReceiptModal && selectedOrderForReceipt"
      class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
    >
      <div class="w-full max-w-lg border border-[#292b2d] bg-[#fcfdfb] p-6 shadow-2xl sm:p-8">

        <!-- Printable Receipt Voucher Area -->
        <div id="printable-receipt" class="border border-[#cfd2ce] bg-white p-6 shadow-sm">
          <!-- Header -->
          <div class="border-b-2 border-[#202220] pb-4 text-center">
            <div class="mx-auto grid size-10 place-items-center bg-[#202220] text-lg font-black text-white">
              K
            </div>
            <h2 class="font-display mt-2 text-xl font-black tracking-[-0.03em] text-[#202220]">
              KickCraft Flagship Studio
            </h2>
            <p class="text-[11px] text-[#5f635f]">
              123 Craft Studio Way, Bonifacio Global City, Taguig
            </p>
            <p class="text-[10px] text-[#8e938e]">
              Official Custom Shoe Order &amp; Store Pickup Receipt
            </p>
          </div>

          <!-- Receipt Details Grid -->
          <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p class="text-[10px] font-bold uppercase text-[#8e938e]">Receipt / Order #</p>
              <p class="font-mono font-bold text-[#202220]">{{ selectedOrderForReceipt.id }}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-bold uppercase text-[#8e938e]">Date Placed</p>
              <p class="font-semibold text-[#202220]">
                {{ new Date(selectedOrderForReceipt.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }}
              </p>
            </div>

            <div class="mt-2">
              <p class="text-[10px] font-bold uppercase text-[#8e938e]">Customer</p>
              <p class="font-bold text-[#202220]">{{ selectedOrderForReceipt.customerName }}</p>
              <p class="text-[11px] text-[#6a6e6a]">{{ selectedOrderForReceipt.customerEmail }}</p>
            </div>
            <div class="mt-2 text-right">
              <p class="text-[10px] font-bold uppercase text-[#8e938e]">Target Pickup Date</p>
              <p class="font-bold text-[#b94d27]">{{ selectedOrderForReceipt.pickupDate }}</p>
            </div>
          </div>

          <!-- Shoe Item Breakdown -->
          <div class="mt-5 border-t border-dashed border-[#cfd2ce] pt-4">
            <div class="flex items-start justify-between">
              <div>
                <h4 class="font-display font-black text-base text-[#202220]">
                  {{ selectedOrderForReceipt.shoeName }}
                </h4>
                <p class="text-xs text-[#5f635f]">
                  Size: <strong>US {{ selectedOrderForReceipt.size }}</strong> · Charm: <strong>{{ selectedOrderForReceipt.charmLabel || 'None' }}</strong>
                </p>
              </div>
              <p class="font-display text-lg font-black text-[#202220]">
                ₱{{ selectedOrderForReceipt.price?.toLocaleString() }}
              </p>
            </div>

            <!-- Customized Part Colors Swatches -->
            <div v-if="selectedOrderForReceipt.partColors && Object.keys(selectedOrderForReceipt.partColors).length" class="mt-3 bg-[#fcfdfb] p-3 border border-[#f1f3f0]">
              <p class="text-[10px] font-bold uppercase tracking-wider text-[#6a6e6a] mb-2">
                Custom Styled Parts:
              </p>
              <div class="grid grid-cols-2 gap-1.5 text-xs">
                <div
                  v-for="(color, partKey) in selectedOrderForReceipt.partColors"
                  :key="partKey"
                  class="flex items-center gap-1.5"
                >
                  <span
                    class="size-3 border border-black/20 shrink-0"
                    :style="{ backgroundColor: color.value }"
                  />
                  <span class="capitalize font-semibold text-[#404345]">{{ partKey.replace('-', ' ') }}:</span>
                  <span class="text-[#6a6e6a]">{{ color.name }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Total & Status Bar -->
          <div class="mt-5 flex items-center justify-between border-t-2 border-[#202220] pt-4">
            <div>
              <p class="text-[10px] font-bold uppercase text-[#8e938e]">Payment Status</p>
              <span
                class="inline-block mt-0.5 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white"
                :class="{
                  'bg-[#3f7652]': selectedOrderForReceipt.status === 'paid',
                  'bg-[#c97d1e]': selectedOrderForReceipt.status === 'pending',
                  'bg-[#b94d27]': selectedOrderForReceipt.status === 'cancelled',
                }"
              >
                {{ selectedOrderForReceipt.status }}
              </span>
            </div>

            <div class="text-right">
              <p class="text-[10px] font-bold uppercase text-[#8e938e]">Total Amount</p>
              <p class="font-display text-2xl font-black text-[#b94d27]">
                ₱{{ selectedOrderForReceipt.price?.toLocaleString() }}
              </p>
            </div>
          </div>

          <div class="mt-4 border-t border-dashed border-[#cfd2ce] pt-3 text-center text-[10px] text-[#8e938e]">
            Present this receipt at the KickCraft studio counter during store pickup.
          </div>
        </div>

        <!-- Action Controls (Excluded from print) -->
        <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#d9dcd8] pt-4">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-[#5f635f]">Status:</span>
            <button
              v-if="selectedOrderForReceipt.status !== 'paid'"
              type="button"
              class="bg-[#3f7652] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2a593a]"
              @click="handleOrderStatusChange(selectedOrderForReceipt.id, 'paid')"
            >
              ✓ Mark as Paid
            </button>
            <button
              v-if="selectedOrderForReceipt.status !== 'pending'"
              type="button"
              class="border border-[#c97d1e] bg-white px-3 py-1.5 text-xs font-bold text-[#c97d1e] hover:bg-[#fcfdfb]"
              @click="handleOrderStatusChange(selectedOrderForReceipt.id, 'pending')"
            >
              Set to Pending
            </button>
            <button
              v-if="selectedOrderForReceipt.status !== 'cancelled'"
              type="button"
              class="border border-[#b94d27] bg-white px-2.5 py-1.5 text-xs font-bold text-[#b94d27] hover:bg-[#fdf2ef]"
              @click="handleOrderStatusChange(selectedOrderForReceipt.id, 'cancelled')"
            >
              Cancel
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="flex items-center gap-1.5 border border-[#292b2d] bg-[#292b2d] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#b94d27]"
              @click="printReceipt"
            >
              <svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Receipt
            </button>
            <button
              type="button"
              class="border border-[#bfc3bf] bg-white px-4 py-1.5 text-xs font-bold text-[#5f635f] hover:border-[#292b2d]"
              @click="showReceiptModal = false"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>
