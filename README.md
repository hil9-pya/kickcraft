# KickCraft

Interactive 3D shoe customization, Tripo photo-to-3D generation, and an admin-reviewed seller marketplace for original shoe designs. Customers reserve for store pickup and pay in store. Vue uses the PHP API and MySQL; no customer account is required.

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

## Shoe generation with Tripo

Tripo is the only new 3D generation path. Local photo/video reconstruction, video upload/frame extraction, and 65%/80% alignment retries are retired from the website and API. Historical source photos, reviewed masks, models and scan records remain private and unchanged; existing products still support source-photo review. Recovery lists show only Tripo generations. Optional **photo** background removal remains available through the local worker; it does not enable video reconstruction.

### Tripo AI generation

Open **Seller Studio -> Generate with Tripo**, or **Admin -> Add New Shoe -> Generate with Tripo**. If a previous scan is open, **Choose another capture** returns to saved Tripo generations without retiring their photos, masks, or model. Historical local captures are retained privately but cannot be restarted.

Choose one front/three-quarter photo, optionally left, back, and right photos of the same original shoe. **Save reference photos** locally. Optionally click **Remove backgrounds** to process all unreviewed photos with the existing local RealityScan AI masking worker, using no Tripo credits. Review the red removal overlays, edit incorrect cutouts with Keep/Remove brushes, then save selected good masks. When **Use background-removed photos for generation** is checked, every photo needs a reviewed mask before generation. Uncheck it to send originals instead; saved masks remain intact. Finally check the cloud/cost consent box, then **Generate shoe - 30 credits**. This uses the owner's Tripo API balance, not Studio credits. Current V3 standard textured image/multiview generation is 30 credits ($0.30); no HD geometry, HD textures, paid segmentation, or automatic retries that create new tasks are requested. A future provider price change requires reviewing the displayed estimate and server cost policy.

The local PHP worker uploads metadata-stripped PNG copies (up to 1536 pixels), applying all reviewed masks only when cleaned-photo mode was explicitly selected, to the fixed Tripo V3 API. Originals stay private for comparison. A private paid-request journal is written before generation. The chosen original/cleaned-photo mode is frozen once the task starts. Known task IDs resume without creating another generation; an interrupted submission with no task ID blocks automatic resubmission and asks the owner to inspect Tripo's dashboard. Failed remote tasks need an explicitly new capture/charge. Signed model downloads are restricted to HTTPS Tripo asset hosts, with no redirects or API key forwarding, and must pass existing embedded-texture, static GLB, 20 MB, 50,000 triangle, and minimum-surface checks.

Compare every angle, confirm all likeness checks, define at least two real parts with Smart fill / Paint / Erase, then **Use these parts**. Seller results become drafts. Complete product details and submit for admin review; source-photo comparison remains required for approval. Tripo can invent hidden details, and smart fill does not identify semantic shoe parts reliably. No automatic approval or publication.

Store `TRIPO_API_KEY=...` in a private `tripo.env` **outside the project and web root**, and set `TRIPO_ENV_FILE` in ignored `api/.env` to its absolute path. The key never goes into Vue or a `VITE_*` variable. Enable XAMPP's installed GD extension for the CLI worker only:

```powershell
& C:/xampp/php/php.exe -d extension=gd -d memory_limit=512M tools/process-scans.php
```

Restart the idle worker after backend changes. Local provider verification uses injected transport and a synthetic original geometry fixture, spending no credits:

```powershell
& C:/xampp/php/php.exe -d extension=gd -d memory_limit=512M tools/test-tripo-workflow.php
```

This command requires the isolated `kickcraft_photo_scan_dev` database and localhost:5174. It checks seller approval, protected photo upload, explicit cost consent, queued processing, task resume, region finalization, private drafts, source comparison, and admin approval. Fixtures are retired afterwards; this test is not proof of photographic fidelity.

### Isolated worktree setup

Use a separate database, API URL, session cookie, and Vite port when another KickCraft checkout is already running. Do not import the entire baseline `setup.sql` into an existing database: it contains demo seeds and account updates.

For a new, empty scan-development database in PowerShell:

```powershell
& C:/xampp/mysql/bin/mysql.exe -u root -e 'CREATE DATABASE IF NOT EXISTS kickcraft_photo_scan_dev CHARACTER SET utf8mb4'
$schemaText = Get-Content api/database/setup.sql -Raw
$tables = [regex]::Matches($schemaText, '(?s)CREATE TABLE IF NOT EXISTS .*?;')
($tables.Value -join "`n") | & C:/xampp/mysql/bin/mysql.exe -u root kickcraft_photo_scan_dev
Get-Content api/database/photo-scanning.sql -Raw | & C:/xampp/mysql/bin/mysql.exe -u root kickcraft_photo_scan_dev
Get-Content api/database/realityscan.sql -Raw | & C:/xampp/mysql/bin/mysql.exe -u root kickcraft_photo_scan_dev
Get-Content api/database/sellers.sql -Raw | & C:/xampp/mysql/bin/mysql.exe -u root kickcraft_photo_scan_dev
```

Copy `api/.env.example` to ignored `api/.env`; set the database and a unique owner password, then run the existing `api/database/create-owner.php`. Generation worker settings:

```dotenv
DB_NAME=kickcraft_photo_scan_dev
SESSION_NAME=KICKCRAFT_PHOTO_SCAN
CORS_ORIGINS=http://localhost:5174,http://127.0.0.1:5174
SCAN_STORAGE=C:/Users/YourName/KickCraftScanData
BLENDER_EXE=C:/Program Files/Blender Foundation/Blender 5.2/blender.exe
```

`SCAN_STORAGE` must be an absolute private directory **outside both the project and Apache document root**. PHP/Apache and the CLI worker need write access. Source photographs, draft GLBs, logs, and caches stay there; authenticated endpoints serve each account’s own previews. Admin source-photo comparison is restricted to a submitted product and its actual seller-owned capture. Only accepted final models, thumbnails, and neutral textures go into ignored public upload directories. Use a dedicated OS account or directory permissions when sharing this computer. Starting a new capture retires its previous unfinished upload or ready preview; active reconstruction must finish first. Prepared drafts remain recoverable until the matching catalog save succeeds. Retired source files are retained privately. Retained jobs consume disk space; remove old job folders only when no worker or catalog draft uses them.

Install Blender locally for browser-model conversion. RealityScan is optional, used only for photo background masks through `REALITYSCAN_EXE`. Meshroom and video-capture tooling are not needed for Tripo generation.

Expose this checkout through a distinct Apache URL, such as `http://localhost/kickcraft-photo-scan`, following the API/public junction setup above. Save this checkout's Vite settings in ignored `.env.development.local` so they survive closing the terminal or app:

```dotenv
KICKCRAFT_API_TARGET=http://localhost/kickcraft-photo-scan
KICKCRAFT_DEV_PORT=5174
```

Then run `npm run dev` from this checkout. The server stays on port 5174 and uses the isolated API/database. It stops with a clear error if the port is occupied. Without local overrides, another checkout keeps port 5173 and `/kickcraft`. Shell `KICKCRAFT_*` values override the local file. Different ports have separate browser storage; shoes and finalized Tripo models live in MySQL and local model files, not in the Vite process.

Run `npm run dev` from this checkout to check MySQL, Apache/API, storage, Blender, and Tripo configuration, then start Vite and the local worker together. Keep this terminal open while jobs process. If the worker exits unexpectedly, the launcher stops the website and prints an error. Start Apache and MySQL in XAMPP before running it. Check readiness without processing jobs or spending credits with `node tools/dev.mjs --check`.

For worker-only maintenance, use another terminal from this checkout:

```powershell
& C:/xampp/php/php.exe -d extension=gd -d memory_limit=512M tools/process-scans.php
# One queued job only:
& C:/xampp/php/php.exe -d extension=gd -d memory_limit=512M tools/process-scans.php --once
```

One job runs at a time per database. The worker enforces a 60-minute deadline and updates a heartbeat; interrupted jobs become failed after five minutes without a heartbeat. Inspect the private job's worker and Tripo task logs when processing fails. A stopped worker leaves new jobs queued. Reconstruction never substitutes a template or reports a failed job as ready.

Uploads are limited to 10 MB / 24 megapixels per photograph. The scanner's `.htaccess` raises PHP's upload limit to 20 MB and total multipart size to 32 MB for final model plus textures. Apache must allow these PHP overrides; otherwise set equivalent limits in the local PHP configuration. Reviewed foreground masks are applied to the PNG copies sent to Tripo when cleaned-photo mode is selected. Prepared models are checked for embedded textures, normals, UVs, at most 50,000 triangles, and at most 20 MB. If finalization exceeds the multipart limit, reduce/crop the scan instead of publishing an incomplete asset.

### Generation checks

Use sharp photos of the same original shoe with consistent lighting. One front/three-quarter photo is required; up to three additional labeled views improve coverage. AI can invent unseen geometry. Compare all source photos before marking at least two editable regions; product validation and admin approval remain required.

```powershell
& C:/xampp/php/php.exe tools/test-tripo-only.php
& C:/xampp/php/php.exe -d extension=gd -d memory_limit=512M tools/test-tripo-workflow.php
```

Both checks target the isolated database and localhost, use local fixtures, and spend no generation credits. The first checks retired capture routes and saved-data access; the second verifies the complete Tripo worker and seller/admin workflow using a mocked provider.

## Seller marketplace

Apply at `http://localhost:5174/#seller-register`, then sign in at `#seller`. Pending sellers can view their review status and correct store details. Admin uses `#admin` → **Seller applications** to approve, request changes, or suspend a store. Approved sellers get a persistent five-step walkthrough, product creation, pickup orders, and store settings.

- **Create:** scan an original physical shoe, upload a GLB with 2–16 independently named visible material regions plus a matching PNG, or explicitly choose the original eight-part KickCraft template. A template is never represented as a reconstruction of a photographed shoe. Unknown GLB attachment points disable charms; templates and scanned attachment points support them.
- **Prepare:** test each part independently, label regions, and set a customer palette, price, available sizes, and shared pair stock. Saving creates a private draft. Editing an approved listing withdraws it for review. Preview colors are temporary; the photographed base texture remains resettable.
- **Review:** submitting creates a pending listing. Admin uses **Seller products** to test parts, compare scans with protected original source photographs, and approve or explain rejection. Scan approval also requires an explicit likeness confirmation. Only approved listings from active, approved stores appear in Shop under the Seller designs filter.
- **Reserve:** guests customize colors, choose a charm and available US size, and enter pickup details. The server uses the stored price and store location, and atomically decrements stock. Concurrent requests cannot buy the same last pair. Seller stock edits detect stale loaded stock.
- **Fulfill:** the assigned seller confirms → marks ready → completes after collection/payment. Cancellation requires a reason and restores stock once. Admin retains global reservation oversight. Guest tracking and receipts keep the original pickup location even when a store later changes it.

Sellers cannot review themselves, edit another store’s products/orders/scans, set trusted asset paths, publish directly, or use revoked sessions to continue selling. Suspension hides listings immediately. Changing an approved store’s name or pickup address requires another admin review. Existing orders remain available to admin during suspension.

Apply `api/database/photo-scanning.sql`, then `api/database/sellers.sql` to the selected database before starting this branch. These migrations and `api/database/realityscan.sql` are additive and rerunnable. On an existing database, back up first; do not reimport baseline demo seeds. Credentials remain in ignored `api/.env`; the original checkout/database are separate from this worktree.

```powershell
# Full local HTTP/MySQL seller checks, isolated database only:
& C:/xampp/php/php.exe tools/test-seller-workflow.php --base=http://localhost:5174/api
# Include seller finalization/source-review tests using an existing finalized owner capture:
& C:/xampp/php/php.exe tools/test-seller-workflow.php --base=http://localhost:5174/api --scan=YOUR_SCAN_UUID
```

Seller checks exercise real registration, approval, source isolation, GLB validation, publication, concurrent checkout, stale-stock conflicts, cancellation, suspension, pickup completion, and address snapshots. Browser verification also covered mobile registration, independent template recoloring, admin publication, guest checkout/tracking, seller pickup completion, and GLB draft persistence. The fixture records are explicitly labeled verification data.

**Model-quality limit:** AI generation can invent hidden geometry. Historical local reconstruction experiments are archived in `docs/legacy-local-scanning.md`. Legacy reconstruction was experimental. Repeated synthetic captures did not reliably recover the same surface, including a calibrated JPEG run that was correctly rejected for insufficient geometry. A previous masked synthetic run produced a recognizable shoe, but this is not evidence that a beginner’s physical-shoe capture will match. Keep human source comparison and recapture gates; do not promise professor acceptance or publish a distorted scan. Real physical-shoe capture and likeness acceptance remain required validation.


### Shared seller templates and region editing

Apply additive `api/database/shared-templates.sql` after the existing seller and scan migrations. Vue still uses PHP/MySQL; template reuse never calls the AI provider or worker.

Finished photo-generated seller products offer **Product details → Share as template**. Creator must confirm original-design ownership and permit model/part reuse. Submission snapshots the saved GLB, thumbnail and replacement textures. Admin finds **Shared templates**, compares the private original photographs, tests two independent regions, then approves or rejects. Other approved sellers see only approved templates from active approved creators; private source photos remain admin-only.

**Seller Studio → Shared templates → Preview template → Use template** requires the seller's own matching-shoe photo and explicit confirmation. Reuse preserves geometry, part boundaries, palette and charm placement, creates a new private draft with zero stock, and records template provenance. It copies no price, inventory, orders or listing approval. Normal product validation, photo comparison and admin review still apply. Later source edits/deletion leave snapshot assets intact; withdrawing a template stops new reuse while existing listings retain their separate moderation. Reused templates cannot be re-shared as original models. A shared model only suits an actually matching shoe; style similarity does not prove geometric accuracy.

Region editor: left click paints/selects; middle mouse rotates in every tool, wheel zooms, right mouse pans. Smart-fill clicks accumulate for the selected part, including different views. Remove individual pending fills or clear all, then **Apply all fills** once. Tolerance updates each suggestion from its original camera view. **Clear selected part** and **Undo** reverse assigned boundaries. Apply or clear pending fills before changing tools/parts. **Fullscreen editor** preserves camera and edits; Escape exits using the browser's normal fullscreen control.

Verification: `php tools/test-shared-templates.php` uses the isolated local database and original KickCraft fixtures, retires its test accounts/listings, and makes no cloud calls. Do not run it against production. `npm test` includes region/permission/path checks; browser checks cover multi-fill, clear/undo and fullscreen state preservation.

### Shared UI and desktop layout

KickCraft uses editable shadcn-vue controls in `src/components/ui/`, with semantic light-theme tokens in `src/style.css`. `components.json` and the `@/` alias configure JavaScript component generation. The existing PHP API, local GLBs and pickup workflows remain unchanged.

The studio prioritizes 1920×1080 desktop use: a large preview, persistent design summary and reserve action, plus Parts & colors / Charms / Size controls. Section changes keep the viewer and design mounted. Checkout places contact fields beside the existing calendar and shows the pickup store before confirmation. Seller Studio uses side navigation, a persistent preview beside listing details, and a visible draft/review toolbar. Painting and photo masks put tools above the canvas and settings in a right inspector; accessible shadcn sliders retain keyboard adjustment. Active product/scan work asks before leaving through seller navigation; admin navigation is compact and inventory counts remain in filters. Confirmation dialogs use Reka focus containment, Escape dismissal and focus restoration.

Shop and Tracking share a minimal copyright/feedback footer without duplicate navigation. Tracking expands its lookup form into a result layout only after receipt/email verification. Studio, seller/admin and authentication screens have no shopping footer. Public contact placeholders are removed; feedback notes remain local to the device. Shop combines original KickCraft shoes and seller designs in one catalog, with independent source, shoe-type and search filters. Old `#marketplace` and `/marketplace` links redirect to `#shop` with Seller designs selected. Home prioritizes the original 3D shoe and a four-column catalog at large desktop widths.

Verification covers 1920×1080, 1920×950 and 1536×760 CSS viewports, button/form contracts, section selection, checkout summary and existing moderation restrictions. Local full tests require XAMPP PHP on PATH. No new paid generation or real customer reservation is needed to inspect these views.
