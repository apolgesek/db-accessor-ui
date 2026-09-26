# Agent Notes

Work from the repo root. This repo owns the Angular UI. Sibling `db-accessor` owns backend APIs and application CDK; `db-accessor-infra` owns shared DNS, certificates, CloudFront, and static frontend hosting.

## Commands

```bash
npm ci
npm run start
npm run build
npm run lint
npm run test
```

Use `npm run build` as the main verification for template/type errors, followed by `npm run lint`; these are the PR CI checks. Build defaults to production. Existing production build warnings may include bundle budget and CommonJS optimization warnings.

`npm test -- --watch=false --browsers=ChromeHeadless` runs Karma/Jasmine and requires Chrome (or `CHROME_BIN`). Build/lint do not verify live API behavior. Documentation-only edits need content/diff checks.

## Architecture

- Angular 20 app with standalone components and route files.
- Static assets are served from `public/`; runtime `config.json` is copied from `src/app/config.json`.
- App bootstrap is in `src/app/app.config.ts`:
  - loads runtime config into `ConfigService`
  - configures OIDC through `angular-auth-oidc-client`
  - provides `BASE_URL`
  - enables the auth HTTP interceptor
  - eagerly initializes `RouterEventsService` for navigation loading states
- Top-level routes live in `src/app/app.routes.ts`; feature route arrays live beside modules:
  - `modules/my-requests/my-requests.routes.ts`
  - `modules/admin/admin.routes.ts`
  - `modules/login/login.routes.ts`
  - `modules/my-requests/record/record.routes.ts`
- Core reusable models live in `src/app/core/models`. Prefer extending these before adding duplicate local shapes.
- HTTP services are thin API wrappers:
  - admin: `modules/admin/services/admin-http.ts`
  - requests/accounts/records: `modules/my-requests/services/*`
- Notifications: `core/services/notification.service.ts` owns HTTP pagination, unread state, and WebSocket messages; `modules/notifications/` provides the full list. `app.ts` connects/closes the socket and displays the header summary.

## Code Contracts

- Use standalone components with explicit `imports` arrays. Do not add NgModules.
- Use `inject(...)` consistently for dependencies unless an existing file uses constructor injection.
- Keep API DTOs typed. Avoid `any`; shared response/request/ruleset/account/table types belong in `src/app/core/models`.
- `BASE_URL` is injected from runtime config; do not hardcode API origins in services.
- Auth:
  - `AuthService` stores `isAuthenticated`, `username`, and `appRoles`.
  - Admin access is guarded by `canMatchAdmin`; authenticated routes use `canMatchAuthenticated`.
  - Username display strips the configured external identity provider prefix.
- Route resolvers commonly preload data into `ActivatedRoute.snapshot.data`; keep resolver payload types explicit in consuming components.
- Loading skeletons are driven by route `data.skeleton` through `RouterEventsService`.
- Admin request filtering uses the `REQUESTS_FILTER` injection token; keep pending/all request screens sharing the same `Requests` component.
- Use Angular reactive forms with typed `FormGroup`/`FormControl` definitions for form-heavy screens.
- Use `takeUntilDestroyed(...)` for long-lived subscriptions created in components.
- Ruleset edit route ids are base64url strings containing `accountId#region#table#scopeKey`; decode defensively and keep generated links compatible.
- Record routes use base64url-encoded request ids; the record view depends on JSONEditor for redacted path selection.

## PII scanning

- `modules/admin/manage-tables/` reads `piiDetectionEnabled` from configured tables and toggles it through `AdminHttp.updatePiiDetection`. DTOs live in `core/models/aws.ts`; the API is `PUT /admin/configured-tables/pii-detection` with `{ accountId, region, table, enabled }` (table comes from the row's `name`).
- Enabling queues an initial scan and enables daily scans; it does not mean a scan is currently running. Suggestions are not yet displayed in this UI. The separate AI advisor control/drawer is a local placeholder.
- Keep pending state per account/region/table and restore the actual form-control value on failure. An unchanged `[ngModel]` input alone does not undo a switch's internal value; rollback must suppress change emission to avoid another API call.

## Runtime configuration and deployment

- `src/app/config.json` is copied as a build asset; bootstrap loads the served `config.json` into `ConfigService`. Keep API/auth/WebSocket settings in this configuration rather than component/service literals.
- `.github/workflows/cd.yml` deploys application changes after a merged PR to `main`. It writes release version and auth settings into built `config.json` from SSM, uploads `dist/db-accessor-ui/browser` to the shared frontend bucket, and invalidates CloudFront. Build output edits are not source changes.
- Changes to config fields may need matching updates to `core/app-config.ts`, bootstrap, and the deployment workflow. Preserve revalidation for `index.html`/`config.json` and immutable caching for hashed assets.

## UI Conventions

- Use ng-zorro components already present in the feature (`nz-table`, `nz-form`, `nz-select`, `nz-alert`, `nz-icon`, etc.).
- Prefer existing layout patterns over new design systems. Sidebar shell is in `app.html` / `app.scss`.
- Keep operational screens dense and utilitarian: tables, forms, filters, actions. Avoid landing-page or marketing layouts.
- For icons, use registered ng-zorro icons from `src/app/icons-provider.ts`; add icons there when needed.
- Assets intended for app use go in `public/` and should be referenced by root-relative paths such as `/4eyesdb-logo.svg`.

## Workflow

- Make focused changes; avoid unrelated style churn in templates and SCSS.
- Preserve existing user changes in the working tree.
- Run the narrowest useful check first, then `npm run build` for route/template/type changes.
- Starting a dev server is useful for UI work; use `npm run start` and report the local URL.
- Never commit, deploy, or open PRs unless explicitly asked.
- When commits are requested, use `feat`, `fix`, `refactor`, or `chore`; CI validates conventional commits and derives release labels from them.

## Pull request descriptions

Use these three sections, in this order, for every PR. Keep descriptions concise and describe the final change for a reviewer who has not seen the conversation. Include a relevant architecture diagram in Summary when expanding the architecture. Report only checks actually performed; use "None" in Deployment notes when no additional steps are needed.

```markdown
## Summary

- Describe the change and its purpose, including user-visible behavior where applicable.
- Include relevant behavior or implementation decisions.

## Verification

- List checks performed and their results.
- State any relevant behavior that wasn't verified.

## Deployment notes

- List prerequisites, migrations, or configuration changes.
- Write "None" when no additional steps are needed.
```
