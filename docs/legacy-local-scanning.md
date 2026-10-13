# Retired local scanning experiments

Historical comparison records only. Local capture creation, video uploads and reconstruction retries are disabled. Tripo is the only website generation path. Saved data is retained. RealityScan may still run internally for optional Tripo photo masks.

## Admin photo scanning (local photogrammetry)

The admin shoe editor now has **Scan from photos**. It uploads 30–120 JPG/PNG views of one stationary original shoe, guides background removal on every photo, reconstructs a textured surface with local Meshroom, then lets the owner paint independently recolorable regions. **Smart fill** suggests connected visible faces using original texture colors and surface edges. Choose a part, click the shoe, adjust Fill tolerance, then Apply fill or Cancel fill. Other assigned parts stay protected. Paint / Erase corrects boundaries with a visible size-adjustable brush circle; each applied fill is undoable. Same-colored neighboring parts can merge, so review before saving. This local helper uses no paid AI calls and does not identify semantic shoe parts. At least two regions are required. Unpainted faces keep the photographed appearance. Replacement colors use a neutral detail texture; Reset restores the original texture. Scanned shoes use the existing catalog and guest pickup reservations.

The scanner also accepts video. Open **Scan from photos → Choose video** or **Record video on phone**. The phone control uses the device’s native camera picker; on desktop, transfer a phone recording and choose it. Record three slow passes around a stationary shoe at shoe height, low around the sole, and above, ideally 45–90 seconds, with fixed zoom and good light. Avoid portrait/cinematic effects, digital stabilization and lens switching.

Accepted clips are browser-playable MP4, WebM or MOV, 15–180 seconds, at most 300 MB, with both dimensions at least 640 pixels and at most 12 megapixels per frame. Unsupported codecs need an H.264 MP4 export or original photos. **Select sharp frames** screens exposure, focus and repeated views across the whole clip, producing 30–60 JPEGs with a maximum 1920-pixel long edge. Review coverage, choose **Save selected photos**, then review every background mask before reconstruction. Canceling selection retains existing selected photos.

The original video stays on the device; only selected JPEGs upload through the existing photo API when saved. There is no new service, migration or dependency. Extracted frames have no camera EXIF and video stabilization/compression can harm reconstruction. Frame checks cannot identify a shoe or guarantee all surfaces were filmed. Video makes capture easier; it does not guarantee a faithful model or automatically separate customizable parts. Likeness review and manual region painting still apply. Native camera recording remains subject to phone/browser support.

Photo scanning is available in both the owner/admin shoe editor and the approved Seller Studio. The seller implementation below is included in this branch.


### Optional RealityScan video comparison

Meshroom remains the default scanner. RealityScan 2.2 desktop runs on the Windows processing computer through the same PHP worker; customers/sellers use the website, without installing desktop software themselves. This is a local integration, not a browser port or cloud service. Finish RealityScan installation and first launch yourself, then apply `api/database/realityscan.sql` to the selected database and set the ignored `api/.env` entry:

```dotenv
REALITYSCAN_EXE=C:/Program Files/Epic Games/RealityScan_2.2/RealityScan.exe
```

Keep `BLENDER_EXE`, private `SCAN_STORAGE`, Apache, MySQL, and the existing worker configured. Restart `tools/process-scans.php` after updating its code. Do not run a comparison and the worker against the same GPU simultaneously; the probe and worker share a database lock.

In admin **Scan from photos** or approved Seller Studio **Scan from photos**, start a new capture and select **Video with AI background masks (comparison)**. Choose an MP4 or browser-playable MOV (15–180 seconds, at least 640 pixels on each side, at most 12 megapixels, up to 300 MB), then press **Upload video and generate AI masks**. H.264 MP4 is the tested codec. The video uploads privately in 8 MB chunks; reselect the same original file to resume after interruption. Native import samples about 60 frames and generates AI masks. Use **Review masks together** to inspect 12 overlays per page, select good masks, and press **Save selected masks** once for the group. Edit only incorrect masks with the brush editor, then start reconstruction after every mask is reviewed. A fresh native project uses those reviewed masks. Alignment must pass the same 30-view / 80% gate before meshing, texturing and browser GLB checks. Shape comparison and manual customization-region painting remain required.

Verified synthetic comparison: native video import and AI export worked. Of 49 views, masks retained at least 98.6% of shoe pixels, but 17 masks retained excessive background; only 6/49 frames aligned. The website produced 61 frames and 61 draft masks; a separate full worker test using corrected synthetic masks aligned only 9/61 and was rejected before meshing. This is a failed reconstruction comparison, so RealityScan is optional and has not replaced Meshroom. Real shoe capture and actual likeness still need testing. No FFmpeg or SAM 2 dependency was added. Raw videos, extracted frames, masks, and projects remain in private `SCAN_STORAGE`; they are not public catalog assets.

`tools/probe-realityscan.php` supports explicit private comparison stages with `--video=ABSOLUTE_PATH --trial=NAME --stage=import|mask|export|align|model --interval=1 --run`; preserve failed trial records and use a new trial name when repeating a stage. It never publishes a shoe. See `docs/realityscan-integration.md` for integration scope and test evidence.


### Explicit experimental alignment retry

Apply the additive, rerunnable `api/database/experimental-scan-retry.sql` migration and restart an idle local worker. Normal reconstruction and normal saved-capture retries require at least 30 aligned views and 80% alignment. On a failed reconstruction whose private alignment report confirms at least 30 views and 65% to below 80% alignment, **Experimental retry (65%)** queues the same saved capture with a per-attempt 65% threshold. For example, 41/61 views qualifies; 39/61 or fewer than 30 aligned views does not. No photos need uploading again and reviewed masks are reused with their integrity checks. A normal retry explicitly restores the 80% default.

Lower alignment may produce incomplete geometry, holes, or missing shoe surfaces. Experimental results remain private previews and must pass the existing texture/geometry validation, source-photo comparison, region preparation, and seller listing admin approval. Neither retry accepts, finalizes, nor publishes a model automatically. The local PHP worker still handles processing; Vue communicates through PHP and MySQL.


Local retry verification (2026-10-13): the existing physical-shoe capture that previously failed at 41/61 aligned views was explicitly retried at 65%. The rerun aligned 46/61 and reached a private, validated 49,892-triangle / 6,719,364-byte preview. SHA-256 checks confirmed every saved photo and reviewed mask, plus their metadata, remained unchanged. The job stayed `ready`, without finalization or publication. This verifies retry processing and model validation, not photographed-shoe likeness; manual comparison is still pending. Automated checks cover both native and Meshroom alignment boundaries, explicit opt-in, mask integrity, owner/origin authorization, idempotent queuing, and restoring the 80% default.


