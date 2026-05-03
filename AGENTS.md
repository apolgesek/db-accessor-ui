# Agent Notes

Work from the repo root.

## Commands

```bash
npm ci
npm run start
npm run build
npm run lint
npm run test
```

Use `npm run build` as the main verification for template/type errors. Existing production build warnings may include bundle budget and CommonJS optimization warnings.

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

## Code Contracts

- Use standalone components with explicit `imports` arrays. Do not add NgModules.
- Use `inject(...)` consistently for dependencies unless an existing file uses constructor injection.
- Keep API DTOs typed. Avoid `any`; shared response/request/ruleset/account/table types belong in `src/app/core/models`.
- `BASE_URL` is injected from runtime config; do not hardcode API origins in services.
- Auth:
  - `AuthService` stores `isAuthenticated`, `username`, and `appRoles`.
  - Admin access is guarded by `canMatchAdmin`; authenticated routes use `canMatchAuthenticated`.
  - Username display strips the `db-accessor_` prefix.
- Route resolvers commonly preload data into `ActivatedRoute.snapshot.data`; keep resolver payload types explicit in consuming components.
- Loading skeletons are driven by route `data.skeleton` through `RouterEventsService`.
- Admin request filtering uses the `REQUESTS_FILTER` injection token; keep pending/all request screens sharing the same `Requests` component.
- Use Angular reactive forms with typed `FormGroup`/`FormControl` definitions for form-heavy screens.
- Use `takeUntilDestroyed(...)` for long-lived subscriptions created in components.
- Ruleset edit route ids are base64url strings containing `accountId#region#table#scopeKey`; decode defensively and keep generated links compatible.
- Record routes use base64url-encoded request ids; the record view depends on JSONEditor for redacted path selection.

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
