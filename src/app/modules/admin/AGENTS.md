# Admin Feature Notes

These notes apply to `src/app/modules/admin/`. Paths below are relative to the repository root.

## PII scanning

- `src/app/modules/admin/manage-tables/` reads `piiDetectionEnabled` from configured tables and toggles it through `AdminHttp.updatePiiDetection`. DTOs live in `src/app/core/models/aws.ts`; the API is `PUT /admin/configured-tables/pii-detection` with `{ accountId, region, table, enabled }` (table comes from the row's `name`).
- Enabling queues an initial scan and enables daily scans; it does not mean a scan is currently running.
- `src/app/modules/admin/new-ruleset/pii-suggestions` verifies table registration through `AccountsHttp.getConfiguredTables` before fetching `GET /admin/configured-tables/pii-suggestions`. DTOs live in `src/app/core/models/pii-suggestions.ts`.
- Suggestion review is opt-in: merge selected paths without duplicates or overwriting edits; never infer key scope or save automatically. Cancel stale reads and reset selection when the table context changes.
- Saved suggestions can remain available when scanning is disabled or the latest scan fails. Display their generation time separately from the latest scan status.
- Keep pending state per account/region/table. On failure, restore the form-control value without triggering another API call.
