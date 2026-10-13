# Public layout and footer refinement

User approved the reviewed recommendations. Work inline; no subagents. Use existing shadcn-vue controls, neutral surfaces and rust actions. Keep Vue/PHP/MySQL, original local models, guest pickup and real status/permission behavior.

1. Footer: compact brand/navigation/feedback/copyright on shop and marketplace; minimal copyright/feedback on tracking. Hide on studio, seller/admin/auth and unknown pages. Remove unverified company phone numbers, hours and .local email. Preserve feedback storage and disclose that it stays on this device.
2. Home: shorter original 3D preview with Start designing and Browse marketplace. Product grid follows compact filters; four columns at large desktop sizes.
3. Marketplace: compact title and the same catalog card geometry. Keep seller filtering; show how-it-works strip only on home.
4. Tracking: centered lookup before verification, existing result beside form only after success. Preserve receipt/email, validation, loading/error states, seller pickup details and pending-only cancellation.
5. Check rendered footer gates and tracking states, browser at 1920×1080 / 1920×950 / 1536×760, feedback access and filtering. Run npm test/build; self-review and commit locally.

Scope: App.vue template, style.css, existing UI/footer tests, README and this ledger. No API/data/model/config/dependency changes.


## Results

- Compact light footer measures about 83px on public browsing, down from about 332px. Tracking uses a 73px copyright/feedback row; studio and internal/auth pages render no footer.
- Original model intro measures about 282px including border. Large desktop catalog has four equal columns, consistent thumbnails, readable truncated summaries, and wrapping long names.
- Marketplace keeps seller-only data filtering, removes the repeated how-it-works strip, and shows selected navigation.
- Tracking form stays mounted while results appear. Rendered checks cover initial, verified, ready and failed states; pending cancellation and seller pickup location remain intact. A persistent status region announces lookup progress.
- Browser checks: 1920×1080, 1920×950 and 1536×760; no horizontal overflow. Tested marketplace link/search/clear, feedback opening/disclosure, footer absence in studio, and a failed synthetic receipt lookup retaining entered fields. Successful result rendering is covered by automated fixtures; no real customer order was created, inspected or cancelled.
- Removed the obsolete test requiring placeholder contact numbers. Retained feedback behavior checks and added rendered footer/tracking regressions.
- Self-review only: user prohibited subagents. No dependencies, backend handlers, database records or model assets changed.
- Full suite: 280 tests pass. Production build passes; existing main chunk warning remains (~1.30 MB, 378 KB gzip). Mobile polish and 3D code splitting remain outside scope.
