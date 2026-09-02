# TODO — SPsync

> Generated 2026-09-02. Feasibility validated (see `PROJET.md`). Real credentials in `.cred` (ignored).  
> Last update: 2026-09-02 — Phase 0 scaffold delivered (`0.1.6`), see [CHANGELOG.md](CHANGELOG.md).

## Phase 0 — Preparation ✅ DONE (0.1.5)

- [x] Set `ZAMMAD_USER_ID` (auto via `/users/me`) in plugin config — placeholder `<ZAMMAD_USER_ID>` (real value in `.cred`)
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

## Phase 1 — issueProvider Reading 🔜 NEXT (target 0.2.0 minor)

- [ ] Wire `PluginHttp` real calls: `GET <ZAMMAD_URL>/api/v1/tickets/search?query=...` + `GET /ticket_articles/by_ticket/:id` with `Authorization: Token token=<ZAMMAD_TOKEN>` (via `getSecret`)
- [ ] Resolve `zammadUserId` via `GET /users/me` if empty, cache `owner_id:<ZAMMAD_USER_ID>`
- [ ] Map `ticket` → `PluginSearchResult` / `PluginIssue` (status `new/open/pending`, `assignee`, `labels`, `lastUpdated`, `comments`)
- [ ] Pagination `limit 50` + sort `updated_at desc`
- [ ] `testConnection` real: `GET /users/me` + `GET /ticket_states` → snack SUCCESS/ERROR

## Phase 2 — Use-case B: Newly Assigned (0.3.0)

- [ ] Query `owner_id:<ZAMMAD_USER_ID> AND state.name:new AND updated_at:>lastSyncAt` in `getNewIssuesForBacklog`
- [ ] Detect peer assignment: `owner_id` transition `≠me → me` + `updated_by_id ≠me` (cache `ownerCache`)
- [ ] Create SP task `🆕 [Zammad #number] title` with link `<ZAMMAD_URL>/#ticket/zoom/<id>` (dedup via `seenIds`)
- [ ] Test with ticket owned by `<ZAMMAD_USER_ID>` (poll <90s)

## Phase 3 — Use-case A: Out of Waiting (0.4.0)

- [ ] Detect `pending reminder(3) → open(2)`: poll `state.name:open AND updated_at:>lastSyncAt` + `stateCache`
- [ ] Create hybrid subtask `🔔 Out of waiting — <pending_time> → <now>` via `addTask({parentId})` (1 level max, hybrid `issueProvider` + `permissions: ["addTask"]`)
- [ ] Idempotence key `zammad:<id>:pending:<time>` checked via `getTasks()` before creation

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
