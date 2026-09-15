# KickCraft Branded Confirmation Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a branded, accessible KickCraft confirmation modal dialog subsystem replacing JavaScript browser alerts/confirms and unconfirmed destructive actions across session logout, 3D design resets, shoe deletions, editor discards, and order cancellations.

**Architecture:** A standalone, reusable `ConfirmModal.vue` component with sharp brutalist styling matching the KickCraft design system. Hosted declaratively in `App.vue` and `AdminPanel.vue` with dedicated trigger handlers and state.

**Tech Stack:** Vue 3 `<script setup>`, Tailwind CSS, Node.js native test runner (`node --test`).

**Spec:** [docs/superpowers/specs/2026-09-15-confirmation-modal-design.md](file:///c:/Users/kinglebron/Desktop/Git%20uploads/kickcraft/docs/superpowers/specs/2026-09-15-confirmation-modal-design.md)

## Global Constraints
- Preserve KickCraft brand aesthetics: sharp borders (`border-[#8e938e]`, `border-[#bfc3bf]`), soft background (`bg-[#fcfdfb]`), high contrast (`#292b2d`, `#b94d27`).
- Zero primitive `window.confirm` or `alert` calls remaining.
- Keyboard accessible (`Escape` cancels, backdrop click dismisses).
- All 28 existing tests + new unit tests must pass via `npm.cmd test`.
- Production bundle must build cleanly via `npm.cmd run build`.

---

### Task 1: Create `ConfirmModal.vue` and Unit Tests

**Files:**
- Create: `src/components/ConfirmModal.vue`
- Create: `test/confirm-modal.test.js`

**Interfaces:**
- Props:
  - `show` (Boolean)
  - `title` (String)
  - `message` (String)
  - `confirmText` (String, default: `'Confirm'`)
  - `cancelText` (String, default: `'Cancel'`)
  - `variant` (String, default: `'default'` - `'danger' | 'warning' | 'default'`)
  - `icon` (String, default: `'warning'` - `'logout' | 'trash' | 'reset' | 'warning'`)
- Emits:
  - `confirm`
  - `cancel`

- [ ] **Step 1: Write the failing unit tests for modal rendering & contract**

Create `test/confirm-modal.test.js`:
```javascript
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('ConfirmModal component file exists and defines required props and emits', () => {
  const filePath = path.resolve('src/components/ConfirmModal.vue')
  assert.ok(fs.existsSync(filePath), 'ConfirmModal.vue must exist')
  const content = fs.readFileSync(filePath, 'utf8')
  assert.match(content, /defineProps/, 'Must define props')
  assert.match(content, /defineEmits/, 'Must define emits')
  assert.match(content, /title/, 'Must support title prop')
  assert.match(content, /message/, 'Must support message prop')
  assert.match(content, /variant/, 'Must support variant prop')
  assert.match(content, /icon/, 'Must support icon prop')
})

test('AdminPanel no longer uses window.confirm', () => {
  const adminPath = path.resolve('src/components/AdminPanel.vue')
  const content = fs.readFileSync(adminPath, 'utf8')
  assert.doesNotMatch(content, /confirm\(/, 'AdminPanel must not call native confirm()')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test`
Expected: FAIL (missing `src/components/ConfirmModal.vue`)

- [ ] **Step 3: Implement `src/components/ConfirmModal.vue`**

Implement `src/components/ConfirmModal.vue` with:
- Backdrop with `bg-black/60 backdrop-blur-sm`
- KickCraft styled modal box with title, icon badge, message
- Cancel and Confirm buttons styled by variant
- Keydown listener for `Escape`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test`
Expected: PASS (except `AdminPanel` check until Task 3)

- [ ] **Step 5: Commit Task 1**

```bash
git add src/components/ConfirmModal.vue test/confirm-modal.test.js
git commit -m "feat(modal): create reusable KickCraft ConfirmModal component"
```

---

### Task 2: Integrate `ConfirmModal` in `src/App.vue` (Sign Out & Reset Design)

**Files:**
- Modify: `src/App.vue`

**Interfaces:**
- Consumes: `ConfirmModal` component
- Handlers:
  - `requestLogout()`: Opens modal before logging out
  - `confirmLogout()`: Executes `currentUser.value = null; loginEmail.value = ''; loginPassword.value = ''; goToShop()`
  - `requestResetDesign()`: If colors customized, opens modal before clearing
  - `confirmResetDesign()`: Resets colors to `#ffffff`

- [ ] **Step 1: Add reactive state for modal in `App.vue`**

```javascript
const confirmModal = ref({
  show: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'default',
  icon: 'warning',
  onConfirm: null,
})
```

- [ ] **Step 2: Implement trigger functions**

Replace instant `handleLogout` with confirmation request:
```javascript
function requestLogout() {
  confirmModal.value = {
    show: true,
    title: 'Sign Out of KickCraft?',
    message: 'You will be signed out of your current session. You can sign back in at any time.',
    confirmText: 'Sign Out',
    cancelText: 'Stay Logged In',
    variant: 'default',
    icon: 'logout',
    onConfirm: () => {
      currentUser.value = null
      loginEmail.value = ''
      loginPassword.value = ''
      goToShop()
    },
  }
}
```

Replace instant `resetDesign` with confirmation request:
```javascript
function requestResetDesign() {
  if (customizedCount.value === 0) return
  confirmModal.value = {
    show: true,
    title: 'Reset Custom Design?',
    message: 'This will reset all custom color choices back to original white/chalk. Your current combination will be lost.',
    confirmText: 'Reset to White',
    cancelText: 'Keep My Design',
    variant: 'warning',
    icon: 'reset',
    onConfirm: () => {
      if (selectedParts.value.every(part => setMaterialColor(modelViewer.value.model, part.material, '#ffffff'))) {
        partColors.value = {}
      }
    },
  }
}
```

- [ ] **Step 3: Mount `ConfirmModal` in `App.vue` template**

Add `<ConfirmModal>` before `</template>` in `App.vue`.

- [ ] **Step 4: Verify with `npm.cmd test` and `npm.cmd run build`**

- [ ] **Step 5: Commit Task 2**

```bash
git add src/App.vue
git commit -m "feat(app): add confirmation modals for sign out and 3D design reset"
```

---

### Task 3: Integrate `ConfirmModal` in `AdminPanel.vue` (Delete, Discard, Cancel Order)

**Files:**
- Modify: `src/components/AdminPanel.vue`

**Interfaces:**
- Consumes: `ConfirmModal` component
- Handlers:
  - `requestDeleteShoe(shoe)`: Replaces `window.confirm`
  - `requestDiscardEditor()`: Replaces immediate cancel in 3D editor
  - `requestCancelOrder(order)`: Confirms before marking order cancelled

- [ ] **Step 1: Add reactive state for modal in `AdminPanel.vue`**

```javascript
const adminConfirm = ref({
  show: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'default',
  icon: 'warning',
  onConfirm: null,
})
```

- [ ] **Step 2: Replace `window.confirm` in `deleteShoe`**

```javascript
function deleteShoe(shoe) {
  adminConfirm.value = {
    show: true,
    title: 'Delete Shoe Silhouette?',
    message: `Are you sure you want to delete "${shoe.name}"? This silhouette will be permanently removed from the catalog.`,
    confirmText: 'Delete Permanently',
    cancelText: 'Keep Shoe',
    variant: 'danger',
    icon: 'trash',
    onConfirm: () => {
      shoes.value = deleteShoeRecord(shoes.value, shoe.id)
      persistShoes()
      saveFeedback.value = `"${shoe.name}" has been deleted.`
    },
  }
}
```

- [ ] **Step 3: Add confirmation to `cancelEdit` if changes made**

```javascript
function cancelEdit() {
  if (form.value.glbPath || form.value.name) {
    adminConfirm.value = {
      show: true,
      title: 'Discard Unsaved Changes?',
      message: 'You have unsaved edits in the 3D shoe editor. Any customized materials or model settings will be discarded.',
      confirmText: 'Discard & Exit',
      cancelText: 'Continue Editing',
      variant: 'warning',
      icon: 'reset',
      onConfirm: () => {
        closeEditor()
      },
    }
  } else {
    closeEditor()
  }
}
```

- [ ] **Step 4: Add confirmation to `handleMarkCancelled` in orders table**

```javascript
function requestCancelOrder(order) {
  adminConfirm.value = {
    show: true,
    title: 'Cancel Sales Order?',
    message: `Are you sure you want to cancel order ${order.id} for ${order.customerName}? This will mark the reservation as cancelled.`,
    confirmText: 'Cancel Order',
    cancelText: 'Keep Order Active',
    variant: 'danger',
    icon: 'warning',
    onConfirm: () => {
      handleStatusChange(order.id, 'cancelled')
    },
  }
}
```

- [ ] **Step 5: Mount `ConfirmModal` in `AdminPanel.vue` template**

- [ ] **Step 6: Run tests and verify `test/confirm-modal.test.js` passes**

Run: `npm.cmd test`
Expected: ALL tests pass (including `AdminPanel no longer uses window.confirm`).

- [ ] **Step 7: Commit Task 3**

```bash
git add src/components/AdminPanel.vue test/confirm-modal.test.js
git commit -m "feat(admin): replace window.confirm with branded ConfirmModal for delete, discard, and cancel"
```

---

### Task 4: Full Verification & Walkthrough Update

**Files:**
- Modify: `walkthrough.md`

- [ ] **Step 1: Run full test suite**
Run: `npm.cmd test`

- [ ] **Step 2: Run production build**
Run: `npm.cmd run build`

- [ ] **Step 3: Update walkthrough artifact with confirmation modal flows**

- [ ] **Step 4: Commit and finalize**
