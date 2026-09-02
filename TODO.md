# TODO — SPsync

> Generated 2026-09-02. Feasibility validated (see `PROJET.md`). Real credentials in `.cred` (ignored).

## Phase 0 — Preparation

- [ ] Set `ZAMMAD_USER_ID` (auto via `/users/me`) in plugin config — placeholder `<ZAMMAD_USER_ID>` (real value in `.cred`)
- [ ] Choose SP project target (e.g. `INBOX_PROJECT` or create dedicated "Zammad" project via `GET /projects`)
- [ ] Decide storage `lastSyncAt` + cache `ticketId→state/owner` (`persistDataSynced` — synced, plus `setSecret` for token)
- [ ] Fix `pollInterval` (recommended 90s) and `ZAMMAD_TIMEOUT=30`

## Phase 1 — issueProvider Scaffold

- [ ] Implement `plugin.js:registerIssueProvider` with `configFields` (`zammadUrl` default `<ZAMMAD_URL>`, `zammadUserId`, `pollInterval`), `getHeaders` via `getSecret`, `testConnection`
- [ ] Implement `searchIssues` / `getById` / `getNewIssuesForBacklog` (DSL `owner_id:<ZAMMAD_USER_ID> AND state.name:new`, `pending reminder → open`)
- [ ] Implement `issueDisplay` + `commentsConfig` via `ticket_articles/by_ticket/:id`
- [ ] Handle `persistDataSynced` + `persistedDataChanged` for `lastSyncAt` / dedup
- [ ] Test ZIP install (Settings → Plugins → Choose Plugin File) + DevTools `F12`

## Phase 2 — Use-case B: Newly Assigned

- [ ] Query `owner_id:<ZAMMAD_USER_ID> AND state:new AND updated_at:>lastSyncAt`
- [ ] Detect peer assignment: `owner_id` transition `≠me → me` + `updated_by_id ≠me`
- [ ] Create SP task `🆕 [Zammad #number] title` with link `<ZAMMAD_URL>/#ticket/zoom/<id>` (dedup via cache)
- [ ] Test with ticket owned by `<ZAMMAD_USER_ID>`

## Phase 3 — Use-case A: Out of Waiting

- [ ] Detect `pending reminder(3) → open(2)`: poll `state:open AND updated_at:>lastSyncAt` + `stateCache`
- [ ] Create hybrid subtask `🔔 Out of waiting — <pending_time> → <now>` via `addTask({parentId})` (1 level max)
- [ ] Idempotence key `zammad:<id>:pending:<time>` checked via `getTasks()` before creation

## Phase 4 — Hardening

- [ ] Pagination `limit/per_page` + sort `updated_at desc`
- [ ] Error handling `401 token`, `429`, `timeout` → `showSnack(ERROR)` + backoff
- [ ] `manifest.json:version` synced with `VERSION` on every commit (hook enforced)
- [ ] i18n `fr.json` if needed

## Phase 5 — Delivery

- [ ] `CHANGELOG.md` + Releases on Gitea (`<GITEA_URL>`)
- [ ] Docs updated (`PROJET.md`, `FEATURES.md` checkmarks)
- [ ] ZIP reproducible, `minSupVersion` honest

## Out of Scope (immediate)

- Zammad webhooks (needs server plugin)
- Bidirectional sync SP → Zammad (post-v1: `createIssue`/`updateIssue`)
- `pending close` (id 7) — clarify if needed
