# Seller and painting UI follow-up

User authorized refinement of the existing shadcn-vue refresh, including layout changes. Desktop priority: 1920×1080, 1920×950 and 1536×760. Execute inline; no subagents.

- Seller portal: 240px navigation, content workspace, compact walkthrough, grouped creation actions.
- Product editor: larger persistent model preview, details inspector with optional part/palette settings, visible draft/review actions.
- Painting: tools above canvas, part/settings inspector beside it, final action below canvas. Preserve pointer coordinates, pending fills, undo, camera, crop, charm and export.
- Photo masking: tools above image, settings beside it; preserve reviewed-mask save and batch semantics.
- Use existing shadcn primitives plus editable Slider source. Neutral seller primary; rust remains focus/accent. Native selects/radios stay.
- Scope reaches seller.css, five Vue screens, shared slider, focused UI tests and documentation. No API, model or data changes.
- Verify accessibility and approval gates, npm test/build, desktop browser layout and synthetic paint/mask interactions. Commit locally after checks; no push.


## Results

- Implemented portal sidebar, compact creation toolbar/walkthrough, neutral primary buttons, grouped listing details, sticky draft/review actions, paint/mask toolbars and right inspectors.
- Added official shadcn-vue Slider source with accessible thumb labels; no new runtime dependency. Reka supplies current slider values after thumb registration on mount.
- Fixed seller input rules applying text-field width/padding to native scanner radios.
- Seller section navigation protects active product, upload and scan work with the existing confirmation dialog; cancelling preserves fields. Back/marketplace/browser navigation retains existing behavior.
- Self-reviewed inline; user explicitly prohibited subagents.
- Browser checked synthetic seller listings, product recoloring, external draft submission, navigation cancellation, keyboard slider adjustment, two-part painting, undo, pending multi-fill protection/apply, fullscreen, local GLB export, mask brush/undo and local PNG export.
- Checked 1920×1080, 1920×950 and 1536×760 CSS viewports for horizontal overflow and visible primary actions. Screenshots use local synthetic records and an original KickCraft mesh fixture.
- 279 npm tests passed, production build passed, 50 isolated shared-template seller/admin workflow checks passed. Main bundle remains about 1.30 MB (379 KB gzip); broader 3D splitting is outside this UI task.
- No paid generation, real photo capture, live seller login or real customer orders exercised. Fixture previews intercept API calls locally; permission/moderation contracts additionally covered by automated and isolated backend checks.
