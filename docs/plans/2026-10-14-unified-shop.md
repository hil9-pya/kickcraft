# Unified customer Shop

User approved one Shop catalog with All shoes / KickCraft originals / Seller designs filters. Preserve seller names, real approval/stock data, customization, guest pickup, tracking and the separate seller workspace. No subagents.

- Reuse filterCatalog with an optional source filter based on sellerUserId; preserve three-argument callers and shoe-type/search filters.
- Replace duplicate public Marketplace view/navigation with one Shop. Place source buttons beside search; keep shoe types below.
- Route old hash/path Marketplace links and saved Marketplace views to Shop with Seller designs selected. Clear stale search/type filters on this legacy landing and canonicalize URL without adding history.
- Update seller public links, listing success copy and README; keep APIs/database/schema/models unchanged.
- Test actual routing functions, ownership filtering, clear/reset behavior and rendered filter/header/footer semantics. Inspect desktop 1920×1080 and reduced heights; run npm test/build and commit locally.

Ruling: scanner/Tripo changes already exist in this shared worktree — preserve them, and stage only this task's edits in overlapping SellerDashboard/README files. Existing model-viewer and pickup code remain untouched.

Verified: npm test passed 282/282; npm run build passed (existing large-bundle warning remains). Focused source/routing/render checks passed 19/19. Browser verified hash/path redirects, stale-filter reset, combined filtering, empty-state reset, seller product customization and pickup form opening without submitting an order. Desktop inspected at 1920x1080, 1920x950 and 1536x760 with no horizontal overflow. No mobile checks or new database writes. Self-review found no changes to approval, stock, authentication, API or model logic.
