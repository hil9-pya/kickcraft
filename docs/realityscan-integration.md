# RealityScan comparison and integration

Approved scope: optional native video import and AI masks through the existing PHP worker. Vue -> PHP -> MySQL stays unchanged. Meshroom remains default. No new processing dependencies. The same native AI can also mask saved photo captures through the **Generate AI masks for unreviewed photos** action; it does not switch the reconstruction engine.

Reach: additive scan job columns, owner-scoped chunk upload, native prepare/reconstruct worker branches, video controls, shared scan status/mask/regions flow, config examples, focused security and workflow checks.

Video uploads remain private, capped at 300 MB in 8 MB chunks. One local worker serializes GPU jobs. Preparation returns draft masks to the review grid (12 overlays per page). Select visually correct masks and save them together; edit only incorrect masks with the existing brush editor. Full-resolution masks are saved through the existing owner-scoped API. Every mask still requires review; unselected masks stay drafts. Photo AI runs as a serialized worker operation, validates all output dimensions before updating metadata, preserves reviewed masks, and returns to the existing capture with an error if masking fails or is interrupted. Reconstruction uses the reviewed masks in a fresh project, preserves stationary background for camera matching, checks camera coverage and browser GLB limits. Existing finalization and manual region painting remain.

RealityScan is experimental: synthetic trials verify execution only. Compare a real shoe capture against Meshroom before changing defaults or claiming physical likeness. Native AI masks included excessive floor in 17/49 synthetic views; manual correction remains necessary. No automatic part recognition or professor acceptance is claimed.

## Verified locally

- RealityScan 2.2.0.119430.RS installed by the user; offline native `importVideo`, `generateAIMasks`, `exportMasks`, `exportReport`, meshing, texturing, and OBJ export exercised.
- Browser upload through the approved seller scanner produced 61 frames and 61 draft AI masks. Job `241b5b8b-33ce-45ea-8549-1b8b5b300e26` remains available privately for mask review; no listing was published.
- Batch review browser check used a separate synthetic capture: two selected masks saved through the existing protected API, 59 stayed drafts, and reopening recovered the reviewed count. Page changes cleared unsaved selections; the individual brush editor remained available. Focused checks cover partial-save failure, preview readiness, EXIF orientation, and original mask dimensions.
- Separate worker fixture used those extracted frames with known synthetic ground-truth masks. Unreviewed masks were rejected through HTTP; saving fixture masks and starting through HTTP reached the real native worker. Fresh alignment reported 9/61, and the worker marked the job failed before meshing (`b0f87cbf-ff40-4bee-87c5-584e67abbfd5`).
- A private diagnostic export from the previously rejected 6/49-view project verified the native model export profile and Blender conversion: 20,984 triangles, 1,129,004 bytes, embedded texture/UVs/normals. This artifact is not eligible for the catalog and is not likeness evidence.
- Owner-scoped HTTP checks cover unauthenticated/cross-origin/cross-owner uploads, chunk retry identity, gaps, metadata validation, private responses, and queue preparation. Unit checks cover chunk crash recovery, timing/size limits, coverage reports, lost final responses, and legacy scanner regressions.

## Photo AI masking verification

Four privately copied frames from an actual shoe video were queued through `scans/ai-masks.php` and processed by the real local worker. All four returned dimension-matched draft masks; the capture stayed on Meshroom for reconstruction. The inspected side view preserved the white upper and black sole while excluding the table and wall. This verifies masking, not 3D reconstruction or every edge.

HTTP checks verified authentication, ownership, origin validation, queue retries, unchanged reviewed masks and reconstruction engine, and mutation blocking while AI runs. Separate missing-tool and interrupted-worker fixtures returned to the existing capture with photos and mask metadata unchanged. The editor opens saved masks in the keep-shoe brush mode so a correction click does not immediately replace the AI result with color removal.

## Remaining comparison

Capture an actual original shoe with a phone in diffuse light, using a fixed lens/zoom and three overlapping rings around a stationary shoe with nearby textured background. H.264 MP4 is the tested video codec. Correct the draft AI masks, reconstruct, and compare all shoe surfaces against the original. Repeat with the existing scanner before selecting a better default. No successful physical-shoe reconstruction or professor acceptance is claimed.
