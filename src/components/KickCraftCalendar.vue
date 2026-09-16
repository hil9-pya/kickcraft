<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  minDate: {
    type: String,
    default: '',
  },
  maxDate: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function parseDateStr(str) {
  if (!str || typeof str !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim())
  if (!match) return null
  const year = parseInt(match[1], 10)
  const month = parseInt(match[2], 10) - 1
  const day = parseInt(match[3], 10)
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null
  return { year, month, day }
}

function formatDate(year, monthIndex, day) {
  const y = String(year)
  const m = String(monthIndex + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getTodayStr() {
  const now = new Date()
  return formatDate(now.getFullYear(), now.getMonth(), now.getDate())
}

function getOffsetDateStr(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date.getFullYear(), date.getMonth(), date.getDate())
}

// Initial view month and year
const initialParsed = parseDateStr(props.modelValue) || parseDateStr(props.minDate)
const now = new Date()
const viewYear = ref(initialParsed ? initialParsed.year : now.getFullYear())
const viewMonth = ref(initialParsed ? initialParsed.month : now.getMonth())

// Watch modelValue to sync view if updated externally
watch(
  () => props.modelValue,
  (newVal) => {
    const parsed = parseDateStr(newVal)
    if (parsed) {
      viewYear.value = parsed.year
      viewMonth.value = parsed.month
    }
  }
)

const currentMonthLabel = computed(() => {
  return `${MONTH_NAMES[viewMonth.value]} ${viewYear.value}`
})

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value -= 1
  } else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value += 1
  } else {
    viewMonth.value += 1
  }
}

function isDateDisabled(dateStr) {
  if (!dateStr) return false
  if (props.minDate && dateStr < props.minDate) return true
  if (props.maxDate && dateStr > props.maxDate) return true
  return false
}

// Days in current month
const calendarDays = computed(() => {
  const year = viewYear.value
  const month = viewMonth.value
  const firstDayOfWeek = new Date(year, month, 1).getDay() // 0 = Sunday
  const daysCount = new Date(year, month + 1, 0).getDate()
  const todayStr = getTodayStr()

  const blanks = []
  for (let i = 0; i < firstDayOfWeek; i++) {
    blanks.push({ key: `blank-${i}`, isBlank: true })
  }

  const days = []
  for (let d = 1; d <= daysCount; d++) {
    const dateStr = formatDate(year, month, d)
    days.push({
      key: `day-${dateStr}`,
      isBlank: false,
      dayNumber: d,
      dateStr,
      disabled: isDateDisabled(dateStr),
      isSelected: props.modelValue === dateStr,
      isToday: dateStr === todayStr,
    })
  }

  return { blanks, days }
})

function selectDate(day) {
  if (day.disabled) return
  emit('update:modelValue', day.dateStr)
}

function applyPreset(offsetDays) {
  const targetStr = getOffsetDateStr(offsetDays)
  emit('update:modelValue', targetStr)
  const parsed = parseDateStr(targetStr)
  if (parsed) {
    viewYear.value = parsed.year
    viewMonth.value = parsed.month
  }
}
</script>

<template>
  <div class="border border-[#cfd2ce] bg-[#fcfdfb] p-3 md:p-4 text-[#202220]">
    <!-- Quick Presets -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <span class="text-[11px] font-bold uppercase tracking-wider text-[#5f635f]">Quick:</span>
      <button
        type="button"
        class="border border-[#cfd2ce] px-2.5 py-1 text-xs font-bold transition-all duration-150"
        :class="modelValue === getOffsetDateStr(7)
          ? 'border-[#b94d27] bg-[#b94d27] text-white'
          : 'bg-[#f4f5f3] text-[#202220] hover:border-[#292b2d] hover:bg-[#e2e5e1]'"
        :disabled="isDateDisabled(getOffsetDateStr(7))"
        @click="applyPreset(7)"
      >
        +1 Week
      </button>
      <button
        type="button"
        class="border border-[#cfd2ce] px-2.5 py-1 text-xs font-bold transition-all duration-150"
        :class="modelValue === getOffsetDateStr(14)
          ? 'border-[#b94d27] bg-[#b94d27] text-white'
          : 'bg-[#f4f5f3] text-[#202220] hover:border-[#292b2d] hover:bg-[#e2e5e1]'"
        :disabled="isDateDisabled(getOffsetDateStr(14))"
        @click="applyPreset(14)"
      >
        +2 Weeks
      </button>
      <button
        type="button"
        class="border border-[#cfd2ce] px-2.5 py-1 text-xs font-bold transition-all duration-150"
        :class="modelValue === getOffsetDateStr(30)
          ? 'border-[#b94d27] bg-[#b94d27] text-white'
          : 'bg-[#f4f5f3] text-[#202220] hover:border-[#292b2d] hover:bg-[#e2e5e1]'"
        :disabled="isDateDisabled(getOffsetDateStr(30))"
        @click="applyPreset(30)"
      >
        +1 Month
      </button>
    </div>

    <!-- Month Navigation Bar -->
    <div class="mb-2 flex items-center justify-between border-b border-[#cfd2ce] pb-2">
      <button
        type="button"
        class="border border-[#cfd2ce] bg-[#f4f5f3] px-2.5 py-1 text-xs font-bold text-[#202220] transition-all duration-150 hover:border-[#292b2d] hover:bg-[#e2e5e1]"
        aria-label="Previous Month"
        @click="prevMonth"
      >
        ← Prev
      </button>
      <span class="font-bold text-sm text-[#202220] tracking-wide">
        {{ currentMonthLabel }}
      </span>
      <button
        type="button"
        class="border border-[#cfd2ce] bg-[#f4f5f3] px-2.5 py-1 text-xs font-bold text-[#202220] transition-all duration-150 hover:border-[#292b2d] hover:bg-[#e2e5e1]"
        aria-label="Next Month"
        @click="nextMonth"
      >
        Next →
      </button>
    </div>

    <!-- Monospace Weekday Headers -->
    <div class="grid grid-cols-7 gap-1 text-center font-mono text-xs font-bold text-[#5f635f] py-1">
      <div v-for="wd in WEEKDAYS" :key="wd" class="py-0.5">
        {{ wd }}
      </div>
    </div>

    <!-- Day Grid -->
    <div class="grid grid-cols-7 gap-1 text-center text-xs">
      <div
        v-for="blank in calendarDays.blanks"
        :key="blank.key"
        class="aspect-square"
        aria-hidden="true"
      />
      <button
        v-for="day in calendarDays.days"
        :key="day.key"
        type="button"
        :disabled="day.disabled"
        :aria-label="day.dateStr"
        :aria-pressed="day.isSelected"
        class="flex aspect-square items-center justify-center border text-xs transition-all duration-150"
        :class="[
          day.isSelected
            ? 'border-[#b94d27] bg-[#b94d27] text-white font-bold'
            : day.disabled
              ? 'border-[#e2e5e1] bg-[#f4f5f3] text-[#8e938e] opacity-40 cursor-not-allowed'
              : 'border-[#cfd2ce] bg-[#fcfdfb] text-[#202220] hover:border-[#292b2d] hover:bg-[#292b2d] hover:text-white',
        ]"
        @click="selectDate(day)"
      >
        {{ day.dayNumber }}
      </button>
    </div>

    <!-- Notice Message -->
    <div class="mt-3 border-l-2 border-[#b94d27] bg-[#f4f5f3] p-2 text-xs text-[#5f635f] leading-relaxed">
      Notice: Pickup reservations must be scheduled between 1 week and 1 year from today. Unclaimed pairs beyond this window become invalid.
    </div>
  </div>
</template>
