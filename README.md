# KickCraft

Interactive 3D shoe customization, local photo scanning, and an admin-reviewed seller marketplace for original shoe designs. Customers reserve for store pickup and pay in store. Vue uses the PHP API and MySQL; no customer account is required.

## Architecture

```text
Vue 3 Frontend (Vite) ──> PHP REST API (Apache / XAMPP) ──> MySQL Database (kickcraft_db)
```

- **Frontend:** Vue 3 `<script setup>`, Tailwind CSS, Google `<model-viewer>` for local 3D GLB shoe models, custom charm anchors.
- **Backend API:** Flat PHP endpoints under `api/` served via XAMPP Apache, PDO prepared statements, native session authentication, and soft-delete flags. Configure an isolated session cookie when running another checkout.
- **Database:** MySQL (`kickcraft_db`) with `users`, `seller_profiles`, `shoes`, `reservations`, and private `scan_jobs`. Seller products and pickup orders reuse the existing shoe and reservation tables.

Owner shoe uploads use the admin editor's GLB and thumbnail pickers. Files are validated by `api/shoes/upload.php`, stored under ignored `public/models/uploads/` or `public/images/uploads/`, then saved as local paths in MySQL.

---

## Local Setup with XAMPP

### 1. Start XAMPP Apache & MySQL
1. Open **XAMPP Control Panel**.
2. Start both **Apache** and **MySQL**.

### 2. Initialize the Database
Import `api/database/setup.sql` into MySQL:

**Via phpMyAdmin:**
1. Navigate to `http://localhost/phpmyadmin`.
2. Click **Import** -> Choose `api/database/setup.sql` -> Click **Import**.

**Or via command line (PowerShell):**
```powershell
& "C:\xampp\mysql\bin\mysql.exe" -u root < "api/database/setup.sql"
```

This creates `kickcraft_db` and seeds the initial silhouettes (KickCraft One, Nike Air Max, and Nike Dunk) plus sample reservations `KC-2026-1041` through `KC-2026-1044`. Nike entries are demo data only.

Create the owner account from local environment values (do not put a password in Git):

```powershell
Copy-Item api/.env.example api/.env
# Edit api/.env and set KICKCRAFT_OWNER_NAME, KICKCRAFT_OWNER_EMAIL, and KICKCRAFT_OWNER_PASSWORD.
& "C:\xampp\php\php.exe" api/database/create-owner.php
```

### 3. Deploy API to XAMPP Apache
Expose only the API and public assets through XAMPP:

```powershell
$projectRoot = (Get-Location).Path
$webRoot = "C:\xampp\htdocs\kickcraft"
New-Item -ItemType Directory -Force -Path $webRoot
New-Item -ItemType Junction -Path "$webRoot\api" -Target "$projectRoot\api"
New-Item -ItemType Junction -Path "$webRoot\public" -Target "$projectRoot\public"
```

Verify the API is reachable at:
`http://localhost/kickcraft/api/shoes/list.php`

### 4. Run the Vue Development Server
```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite development server automatically proxies `/api/*` requests to `http://localhost/kickcraft/api/*`.

---

## Testing & Quality Assurance

```powershell
npm test        # Runs the unit and integration checks
npm run build   # Verifies production client bundle compilation
```

---

## Accounts
- Owner credentials come from `api/.env` and the one-time `create-owner.php` bootstrap.
- Customers reserve as guests and track reservations with their receipt reference and email address.
- The unlinked owner portal is available at `#admin`.

## Admin photo scanning (local photogrammetry)

The admin shoe editor now has **Scan from photos**. It uploads 30–120 JPG/PNG views of one stationary original shoe, guides background removal on every photo, reconstructs a textured surface with local Meshroom, then lets the owner paint independently recolorable regions. At least two regions are required. Unpainted faces keep the photographed appearance. Replacement colors use a neutral detail texture; Reset restores the original texture. Scanned shoes use the existing catalog and guest pickup reservations.

The scanner also accepts video. Open **Scan from photos → Choose video** or **Record video on phone**. The phone control uses the device’s native camera picker; on desktop, transfer a phone recording and choose it. Record three slow passes around a stationary shoe at shoe height, low around the sole, and above, ideally 45–90 seconds, with fixed zoom and good light. Avoid portrait/cinematic effects, digital stabilization and lens switching.

Accepted clips are browser-playable MP4, WebM or MOV, 15–180 seconds, at most 300 MB, with both dimensions at least 640 pixels and at most 12 megapixels per frame. Unsupported codecs need an H.264 MP4 export or original photos. **Select sharp frames** screens exposure, focus and repeated views across the whole clip, producing 30–60 JPEGs with a maximum 1920-pixel long edge. Review coverage, choose **Save selected photos**, then review every background mask before reconstruction. Canceling selection retains existing selected photos.

The original video stays on the device; only selected JPEGs upload through the existing photo API when saved. There is no new service, migration or dependency. Extracted frames have no camera EXIF and video stabilization/compression can harm reconstruction. Frame checks cannot identify a shoe or guarantee all surfaces were filmed. Video makes capture easier; it does not guarantee a faithful model or automatically separate customizable parts. Likeness review and manual region painting still apply. Native camera recording remains subject to phone/browser support.

Photo scanning is available in both the owner/admin shoe editor and the approved Seller Studio. The seller implementation below is included in this branch.

### Isolated worktree setup

Use a separate database, API URL, session cookie, and Vite port when another KickCraft checkout is already running. Do not import the entire baseline `setup.sql` into an existing database: it contains demo seeds and account updates.

For a new, empty scan-development database in PowerShell:

```powershell
& C:/xampp/mysql/bin/mysql.exe -u root -e 'CREATE DATABASE IF NOT EXISTS kickcraft_photo_scan_dev CHARACTER SET utf8mb4'
$schemaText = Get-Content api/database/setup.sql -Raw
$tables = [regex]::Matches($schemaText, '(?s)CREATE TABLE IF NOT EXISTS .*?;')
($tables.Value -join "`n") | & C:/xampp/mysql/bin/mysql.exe -u root kickcraft_photo_scan_dev
Get-Content api/database/photo-scanning.sql -Raw | & C:/xampp/mysql/bin/mysql.exe -u root kickcraft_photo_scan_dev
Get-Content api/database/sellers.sql -Raw | & C:/xampp/mysql/bin/mysql.exe -u root kickcraft_photo_scan_dev
```

Copy `api/.env.example` to ignored `api/.env`; set the database and a unique owner password, then run the existing `api/database/create-owner.php`. Required scanner settings:

```dotenv
DB_NAME=kickcraft_photo_scan_dev
SESSION_NAME=KICKCRAFT_PHOTO_SCAN
CORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
SCAN_STORAGE=C:/Users/YourName/KickCraftScanData
MESHROOM_BATCH=C:/Tools/Meshroom-2025.1.0/meshroom_batch.exe
BLENDER_EXE=C:/Program Files/Blender Foundation/Blender 5.2/blender.exe
```

`SCAN_STORAGE` must be an absolute private directory **outside both the project and Apache document root**. PHP/Apache and the CLI worker need write access. Source photographs, draft GLBs, logs, and caches stay there; authenticated endpoints serve each account’s own previews. Admin source-photo comparison is restricted to a submitted product and its actual seller-owned capture. Only accepted final models, thumbnails, and neutral textures go into ignored public upload directories. Use a dedicated OS account or directory permissions when sharing this computer. Starting a new capture retires its previous unfinished upload or ready preview; active reconstruction must finish first. Prepared drafts remain recoverable until the matching catalog save succeeds. Retired source files are retained privately. Retained jobs consume disk space; remove old job folders only when no worker or catalog draft uses them.

Install [official Meshroom 2025.1.0](https://github.com/alicevision/Meshroom/releases/tag/v2025.1.0) and Blender locally. Meshroom's executable directory must have **no spaces** on Windows; a space-free directory junction also works. Exhaustive matching avoids a vocabulary-tree download for these small captures. Optional segmentation models are unused. A compatible NVIDIA GPU is required for this reconstruction pipeline.

Meshroom 2025.1.0's Windows launcher relaunches itself. The included PowerShell runner waits for its complete process tree and watches the PHP worker so a forced worker stop also retires reconstruction descendants. The worker sets per-job `TEMP`/`TMP` because this build ignores its explicit cache flag. Do not launch several independent reconstruction workers against different databases on one GPU.

Expose this checkout through a distinct Apache URL, such as `http://localhost/kickcraft-photo-scan`, following the API/public junction setup above. Configure the Vite terminal:

```powershell
$env:KICKCRAFT_API_TARGET='http://localhost/kickcraft-photo-scan'
npm run dev -- --port 5174 --strictPort
```

Run the persistent worker in another terminal, from this checkout:

```powershell
& C:/xampp/php/php.exe tools/process-scans.php
# One queued job only:
& C:/xampp/php/php.exe tools/process-scans.php --once
```

One job runs at a time per database. The worker enforces a 60-minute deadline and updates a heartbeat; interrupted jobs become failed after five minutes without a heartbeat. Inspect the private job's `worker.log`, `meshroom-stdout.log`, `meshroom-stderr.log`, and cache node logs before recapturing. A stopped worker leaves new jobs queued. Reconstruction never substitutes a template or reports a failed job as ready.

Uploads are limited to 10 MB / 24 megapixels per photograph. The scanner's `.htaccess` raises PHP's upload limit to 20 MB and total multipart size to 32 MB for final model plus textures. Apache must allow these PHP overrides; otherwise set equivalent limits in the local PHP configuration. Reviewed foreground masks are applied during dense reconstruction and mesh masking, before texturing and the 50,000-triangle browser reduction. Prepared models are checked for embedded textures, normals, UVs, at most 50,000 triangles, and at most 20 MB. If finalization exceeds the multipart limit, reduce/crop the scan instead of publishing an incomplete asset.

### Capture and quality

Keep the shoe stationary and move the camera around it in three rings: low, middle, and above. Aim for 60–100 sharp overlapping views, fixed zoom, diffuse light, and left/right/front/heel/top coverage. Fill most of the frame with the shoe. Use a contrasting matte backdrop and keep some stationary texture around it for camera matching. A small stationary support lets low camera views see sole edges; remove the support in every mask. This workflow does not support moving shoes/turntables. Plain, shiny, transparent, or moving surfaces can fail. Thin laces, unseen undersides, and holes may not reconstruct faithfully.

After saving photos, open **Remove background** on each view. Pick the background color, adjust tolerance, then use **Keep shoe brush** / **Remove background brush** to correct edges. Red pixels are excluded. Color removal reaches matching areas connected to the image border; enclosed matching shoe details stay intact. Batch generation produces drafts only. Review and save each mask; the API rejects reconstruction until every photo has a reviewed mask. Masks preserve original pixel dimensions and JPEG EXIF orientation without rewriting the source photo. Upload original camera files so focal-length metadata survives; screenshots and edited exports often discard calibration. The interface flags files without focal metadata. Stable capture filenames keep photo/mask pairing deterministic. A modern browser with CompressionStream is required.

Camera matching keeps stationary background features, while depth estimation and mesh filtering use the masks to exclude background geometry. At least 30 photographs and 80% of submitted views must align; otherwise the worker fails with recapture guidance. Scans below 1,000 triangles are also rejected as insufficient surface. Alignment and triangle count are screening checks, not proof of shoe likeness. Compare the preview beside selectable original photos and check front, both sides, sole, heel, and visible details before opening region painting. No physical-shoe match is claimed automatically. Regions follow painted faces; they are not automatically recognized physical shoe components.

Compare the reconstructed shape and texture with every submitted view before accepting it. Recapture an unsuitable result. Painting parts cannot repair an inaccurate reconstruction. Replacement-color detail is approximate grayscale texture, not calibrated material/albedo recovery.

### Verification

```powershell
$env:PATH='C:/xampp/php;'+$env:PATH
npm test
npm run build
# Real API/MySQL checks; refuses any database except kickcraft_photo_scan_dev:
& C:/xampp/php/php.exe tools/test-photo-scanning.php --base=http://localhost:5174/api
# After accepting and saving regions on a real completed scan:
& C:/xampp/php/php.exe tools/test-photo-scanning.php --base=http://localhost:5174/api --scan=YOUR_SCAN_UUID
```

The live check creates clearly named verification records only in the isolated database. It tests owner isolation, revoked access, JSON/trust checks, duplicate uploads, exact upload boundaries, concurrent limits, mask ownership/review enforcement, worker locking, repeated recapture retirement, and optionally catalog/guest reservation/admin persistence from the finalized model. The check holds the worker lock so disposable fixture photos cannot enter reconstruction; let active reconstruction finish first. Only test-created captures, accounts, products, and reservations are soft retired afterward; logs record their IDs for inspection.

Actual Meshroom + Blender ran on 48 rendered views of original KickCraft geometry, producing a textured 42,540-triangle / 6.95 MB GLB on the RTX 5060 laptop. This validates tool execution, not physical-shoe fidelity. The first synthetic preview contained surrounding floor and rough surface areas. A second run on the same 48 source photographs with exact synthetic silhouette masks aligned 48/48 cameras and produced 12,632 triangles / 1,925,444 bytes. It removed the large surrounding floor and recovered a recognizable shoe; thin details and underside remain rough. Exact synthetic masks validate the pipeline, not automatic segmentation or real-shoe quality. Real photographs of a physical original shoe, beginner usability, and professor acceptance remain unverified.


## Seller marketplace

Apply at `http://localhost:5174/#seller-register`, then sign in at `#seller`. Pending sellers can view their review status and correct store details. Admin uses `#admin` → **Seller applications** to approve, request changes, or suspend a store. Approved sellers get a persistent five-step walkthrough, product creation, pickup orders, and store settings.

- **Create:** scan an original physical shoe, upload a GLB with 2–16 independently named visible material regions plus a matching PNG, or explicitly choose the original eight-part KickCraft template. A template is never represented as a reconstruction of a photographed shoe. Unknown GLB attachment points disable charms; templates and scanned attachment points support them.
- **Prepare:** test each part independently, label regions, and set a customer palette, price, available sizes, and shared pair stock. Saving creates a private draft. Editing an approved listing withdraws it for review. Preview colors are temporary; the photographed base texture remains resettable.
- **Review:** submitting creates a pending listing. Admin uses **Seller products** to test parts, compare scans with protected original source photographs, and approve or explain rejection. Scan approval also requires an explicit likeness confirmation. Only approved listings from active, approved stores appear in `#marketplace`.
- **Reserve:** guests customize colors, choose a charm and available US size, and enter pickup details. The server uses the stored price and store location, and atomically decrements stock. Concurrent requests cannot buy the same last pair. Seller stock edits detect stale loaded stock.
- **Fulfill:** the assigned seller confirms → marks ready → completes after collection/payment. Cancellation requires a reason and restores stock once. Admin retains global reservation oversight. Guest tracking and receipts keep the original pickup location even when a store later changes it.

Sellers cannot review themselves, edit another store’s products/orders/scans, set trusted asset paths, publish directly, or use revoked sessions to continue selling. Suspension hides listings immediately. Changing an approved store’s name or pickup address requires another admin review. Existing orders remain available to admin during suspension.

Apply `api/database/photo-scanning.sql`, then `api/database/sellers.sql` to the selected database before starting this branch. Both migrations are additive and rerunnable. On an existing database, back up first; do not reimport baseline demo seeds. Credentials remain in ignored `api/.env`; the original checkout/database are separate from this worktree.

```powershell
# Full local HTTP/MySQL seller checks, isolated database only:
& C:/xampp/php/php.exe tools/test-seller-workflow.php --base=http://localhost:5174/api
# Include seller finalization/source-review tests using an existing finalized owner capture:
& C:/xampp/php/php.exe tools/test-seller-workflow.php --base=http://localhost:5174/api --scan=YOUR_SCAN_UUID
```

Seller checks exercise real registration, approval, source isolation, GLB validation, publication, concurrent checkout, stale-stock conflicts, cancellation, suspension, pickup completion, and address snapshots. Browser verification also covered mobile registration, independent template recoloring, admin publication, guest checkout/tracking, seller pickup completion, and GLB draft persistence. The fixture records are explicitly labeled verification data.

**Photo-scanning limit:** reconstruction is still experimental. Repeated synthetic captures did not reliably recover the same surface, including a calibrated JPEG run that was correctly rejected for insufficient geometry. A previous masked synthetic run produced a recognizable shoe, but this is not evidence that a beginner’s physical-shoe capture will match. Keep human source comparison and recapture gates; do not promise professor acceptance or publish a distorted scan. Real physical-shoe capture and likeness acceptance remain required validation.
