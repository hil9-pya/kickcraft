# 404 Route Protection, Brand Favicon & Show Password Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a brutalist 404 Not Found page for unauthorized or invalid URLs (including brute-force attempts to `/admin` or `#admin`), set the KickCraft logo as the website favicon, and add interactive show/hide password toggles across all password input forms.

**Architecture:** Extend Vue frontend view management in `src/App.vue` with route resolution and brute-force protection to catch unauthorized access and unknown paths, add `.htaccess` SPA fallback for Apache, create standard vector and raster favicons in `public/` linked from `index.html`, and implement password visibility toggling in `src/App.vue` and `src/components/AdminPanel.vue`.

**Tech Stack:** Vue 3, Tailwind CSS, SVG/Favicon assets, Apache `.htaccess`, Node.js test runner.

## Global Constraints
- Clean brutalist styling matching KickCraft design system: raw borders, high contrast, clean typography, terracotta `#b94d27` active highlights.
- Zero external libraries for routing or password toggling.
- All 168+ existing automated tests must continue to pass.
- Vite production build must compile with zero errors.

---

### Task 1: KickCraft Brand Favicon & Head Metadata

**Files:**
- Create: `public/favicon.svg`
- Create: `public/favicon.ico`
- Modify: `index.html`
- Test: `test/route-protection-404.test.js`

- [x] **Step 1: Write test for favicon presence and index.html link**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Create `public/favicon.svg` and `public/favicon.ico` with KickCraft brutalist "K" badge**
- [x] **Step 4: Update `index.html` with `<link rel="icon">` tags**
- [x] **Step 5: Run test to verify it passes**
- [x] **Step 6: Commit**

---

### Task 2: Show / Hide Password Toggles

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/AdminPanel.vue`
- Test: `test/route-protection-404.test.js`

- [x] **Step 1: Write tests for password visibility toggling in Login, Register, and Admin user forms**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement reactive state and toggle buttons with SVG eye icons in `src/App.vue`**
- [x] **Step 4: Implement reactive state and toggle button in `src/components/AdminPanel.vue`**
- [x] **Step 5: Run tests to verify they pass**
- [x] **Step 6: Commit**

---

### Task 3: 404 Route Protection & Brutalist Not Found Page

**Files:**
- Modify: `src/App.vue`
- Create: `.htaccess`
- Test: `test/route-protection-404.test.js`

- [x] **Step 1: Write tests for unauthorized `/admin` and unknown route 404 handling**
- [x] **Step 2: Run tests to verify they fail**
- [x] **Step 3: Add Apache `.htaccess` SPA fallback rewrite rule**
- [x] **Step 4: Implement `resolveRoute()` in `src/App.vue` guarding against unauthorized `/admin` and `#admin`**
- [x] **Step 5: Implement brutalist `<main v-else-if="view === 'not-found'"` view with path display and return actions**
- [x] **Step 6: Run tests to verify all 170+ tests pass**
- [x] **Step 7: Run Vite production build (`npm run build`)**
- [x] **Step 8: Commit**
