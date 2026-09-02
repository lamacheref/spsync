# TODO — SPsync

> Generated 2026-09-02. Feasibility validated (see `PROJET.md`). Real credentials in `.cred` (ignored).  
> Last update: 2026-09-02 — Phase 3 out of waiting 🚧 IN PROGRESS (`0.3.6`), see [CHANGELOG.md](CHANGELOG.md).

## Phase 0 — Preparation ✅ DONE (0.1.5)

- [x] Set `ZAMMAD_USER` login/email (or legacy `ZAMMAD_USER_ID`) in plugin config — placeholder `<ZAMMAD_USER>` (e.g. `nehwonlm@example.com`, auto via `/users/me`, real value in `.cred`)
- [x] Choose SP project target (handled by `issueProvider` — no `INBOX_PROJECT` needed; `persistDataSynced` for cache)
- [x] Decide storage `lastSyncAt` + cache `ticketId→state/owner` (`persistDataSynced` + `setSecret` for token, verified in `index.html`)
- [x] Fix `pollInterval` (90000 ms) and `ZAMMAD_TIMEOUT=30` (`zammadTimeout` advanced field, default 30000)

## Phase 0 — issueProvider Scaffold ✅ DONE (0.1.5)

- [x] `plugin.js:registerIssueProvider` with `configFields` (`zammadUrl` default `<ZAMMAD_URL>`, `zammadUserId`, `pollInterval` 30s/90s/5min, `autoAddBacklog`, `zammadTimeout` advanced), `getHeaders` via `getSecret('zammadToken')`, `testConnection`
- [x] Scaffold `searchIssues` / `getById` / `getNewIssuesForBacklog` (empty, logs only — Phase 1 will wire real Zammad DSL)
- [x] `issueDisplay` + `commentsConfig` placeholder via `ticket_articles/by_ticket/:id`
- [x] `persistDataSynced` + `persistedDataChanged` demo in `index.html` (load/save `lastSyncAt`)
- [x] `i18n` EN+FR (`i18n/en.json`, `fr.json`), `manifest.json:iFrame true`, `icon.svg`
- [x] ZIP install testable (Settings → Plugins → Choose Plugin File) + DevTools `F12` + https://test-app.super-productivity.com

## Phase 1 — issueProvider Reading ✅ DONE (0.1.8)

- [x] Wire `PluginHttp` real calls: `GET <ZAMMAD_URL>/api/v1/tickets/search?query=...` + `GET /ticket_articles/by_ticket/:id` with `Authorization: Token token=<ZAMMAD_TOKEN>` (via `getSecret`, `PluginHttp` `timeout` from `zammadTimeout`)
- [x] Resolve `zammadUser` login/email (or `zammadUserId` legacy) via `GET /users/search` or `GET /users/me` if empty, cache `owner_id:<resolved>` + `cachedUserLogin` in `persistDataSynced`
- [x] Map `ticket` → `PluginSearchResult` / `PluginIssue` (status `new/open/pending/closed/merged`, `assignee`, `labels` group, `lastUpdated`, `comments` via `ticket_articles`, `pendingTime`/`ownerId` extras)
- [x] Pagination `limit 50` + `sort_by: updated_at` `order_by: desc` (`searchIssues` params)
- [x] `testConnection` real: `GET /users/me` + `GET /ticket_states` → `showSnack(ERROR)` on fail, cache userId

## Phase 2 — Use-case B: Newly Assigned ✅ DONE (0.3.4)

- [x] Query `owner_id:<resolved> (from <ZAMMAD_USER> login/email) AND state.name:new AND updated_at:>lastSyncAt` in `getNewIssuesForBacklog` (limit 50, sort `updated_at desc`, `timeField: updated_at`, fallback 7d, timeout from `zammadTimeout`)
- [x] Detect peer assignment: `owner_id` transition `≠me → me` + `updated_by_id ≠me` (cache `ownerCache`, `_isPeerAssigned` flag, `_prevOwner`)
- [x] Dedup via `persistDataSynced` (`seenIds` capped 500 + `ownerCache` + `lastSyncAt` ISO, `persistedDataChanged` hook)
- [x] Create SP task `🆕 [Zammad #number] title` with link `<ZAMMAD_URL>/#ticket/zoom/<id>` (returned as `PluginSearchResult`, SP auto-adds to backlog; `showSnack` + `notify` once per poll)
- [x] Test scaffold: `searchIssues`/`getById` verified via `GET /users/me`, `GET /tickets/search`, `pendingTime`/`ownerId` extras; `getNewIssuesForBacklog` unit-logged, poll <90s

## Phase 3 — Use-case A: Out of Waiting 🚧 IN PROGRESS (0.3.5 → 0.4.0)

- [x] Detect `pending reminder(3) → open(2)`: poll `state.name:open AND updated_at:>lastSyncAt` + `stateCache` (`pending:3` → `open:2`, `pending_time` cached, `stateCache` persisted)
- [x] Create hybrid subtask `🔔 Out of waiting — <pending_time> → <now>` via `PluginAPI.addTask({parentId})` (1 level max, hybrid `issueProvider` + `permissions: ["addTask","getTasks"]`, `findParentTaskId` via `issueId`/`#number`)
- [x] Idempotence key `zammad:<id>:pending:<time>` + `pendingDone` Set capped 500, checked via `getTasks()` + `notes` before creation, `pending_time` locale string
- [ ] Test with pending ticket `state: pending reminder` → `open` (poll <90s, verify subtask under parent)

## Phase 4 — Hardening (0.5.0 → 1.0.0)

- [ ] Error handling `401 token`, `429`, `timeout` → `showSnack(ERROR)` + exponential backoff
- [ ] `manifest.json:version` ↔ `VERSION` auto-synced (already enforced by `scripts/bump.sh` + pre-commit + CI)
- [ ] Docs auto-sync on every push (README/PROJET badges ↔ VERSION, `CHANGELOG.md` per commit)
- [ ] i18n polish, ZIP reproducible, `minSupVersion` honest

## Phase 5 — Delivery

- [ ] `CHANGELOG.md` + Gitea/GitHub Releases (`<GITEA_URL>` ↔ `git@github.com:lamacheref/spsync.git`, dual push)
- [ ] Docs updated (`PROJET.md`, `FEATURES.md` checkmarks, [CHANGELOG.md](CHANGELOG.md) per version)
- [ ] ZIP reproducible, `minSupVersion` honest

## Out of Scope (immediate)

- Zammad webhooks (needs server plugin)
- Bidirectional sync SP → Zammad (post-v1: `createIssue`/`updateIssue`)
- `pending close` (id 7) — clarify if needed

## Automation

- Every commit bumps `f` (`0.1.6 → 0.1.7` …) via `./scripts/bump.sh` (auto-syncs badges in `README.md`/`PROJET.md` + `manifest.json`)
- Pre-commit blocks if `VERSION` not bumped or badges desynced
- CI `.gitea/workflows/docs.yml` + `.github/workflows/docs.yml` verifies `VERSION == manifest == badges` on push `Dev`/`main`
- `CHANGELOG.md` updated per commit (this file → commit message → changelog entry)
