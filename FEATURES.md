# FEATURES — SPsync (Plugin issueProvider Zammad)

> Document version: 0.1.1 — 2026-09-02  
> Target architecture: **Plugin `issueProvider`** Super Productivity (cf. `PROJET.md`).  
> Repository: `<GITEA_URL>` — work branch `Dev`, releases on `main`. Real URL in `.cred` (ignored).

---

## Conventions

- **M.m.f**: `M`=Major (breaking, user PR only), `m`=Minor (new feature), `f`=Patch (each commit bumps `f`, even if not a fix).
- **Phase** = potential `m` increment. Each Phase delivers a ZIP via `Settings → Plugins → Choose Plugin File`.
- **Zammad source of truth**: `<ZAMMAD_URL>` (e.g. `https://zammad.example.com`), `GET /api/v1/tickets/search` DSL, `GET /api/v1/ticket_articles/by_ticket/:id`, token via `setSecret` (see `.cred` for real `<ZAMMAD_TOKEN>`).

---

## Phase 0 — Foundation & Installation (v0.1.x)

**Goal:** empty plugin that installs, configures and debugs.

| # | Feature | Description | Acceptance |
|---|---|---|---|
| F0.1 | Scaffolding | `manifest.json` (`id: zammad-spsync`, `type: issueProvider`, `issueProvider: {pollIntervalMs: 90000, icon: support, humanReadableName: Zammad, issueProviderKey: ZAMMAD}`, `iFrame: false`), `plugin.js`, `icon.svg` | ZIP installs without error, appears in `Settings → Plugins`, `F12` clean |
| F0.2 | Zammad config | `registerIssueProvider.configFields`: `zammadUrl` (input, default `<ZAMMAD_URL>`), `zammadUserId` (input, empty = auto `/users/me`), `pollInterval` (select 30s/90s/300s), `autoAddBacklog` (checkbox) — token NOT here (see F0.3) | Fields visible, values persisted (synced except secret), `testConnection` → `GET /users/me` → `200` |
| F0.3 | Secret storage | Token via `PluginAPI.setSecret("zammadToken")` / `getSecret`, never in `configFields` synched, never exported (real `<ZAMMAD_TOKEN>` lives in `.cred`) | After `persistDataSynced` / Export, token absent; `getHeaders` re-reads `getSecret` (async); purged on uninstall |
| F0.4 | Health check | `getHeaders` + `testConnection`: `GET /api/v1/users/me`, `GET /api/v1/ticket_states` | `testConnection` → `true` if `id` returned, `false` + `showSnack(ERROR)` otherwise |
| F0.5 | Logs & debug | `console.log` prefixed `[Zammad]` + `showSnack` on network error | Error visible in DevTools + snackbar |

---

## Phase 1 — Zammad Reading (v0.2.0)

**Goal:** plugin talks to Zammad.

| # | Feature | Description | Criteria |
|---|---|---|---|
| F1.1 | HTTP client | Wrapper `PluginHttp`: `get(url, {params, headers})` with `Authorization: Token token=<ZAMMAD_TOKEN>` via `getHeaders`, `timeout: 30s` | `GET /tickets/search?q=state.name:new&limit=3` → 200 in <30s |
| F1.2 | User resolution | If `zammadUser` (login/email) empty, `GET /users/search` or `GET /users/me` → `id` cached in `persistDataSynced` (`cachedUserId` + `cachedUserLogin`) | `owner_id:<resolved>` (from `<ZAMMAD_USER>`) used in all following queries |
| F1.3 | Ticket → issue mapping | `searchIssues(searchTerm, cfg, http)` maps `ticket` → `PluginSearchResult {id, title:#number title, url: /#ticket/zoom/id, status, assignee}` and `getById` → `PluginIssue {id, title, body, url, state, lastUpdated, comments}` via `ticket_articles` | Issue shown in Issue Panel with clickable Zammad link |
| F1.4 | Issue display | `issueDisplay: [{summary link}, {state}, {assignee}, {group}, {pending_time}]`, `commentsConfig: {author:from, body, created:created_at}` | Detail panel shows non-internal articles, readable dates |
| F1.5 | Pagination & limit | `limit=50`, `per_page` + sort `updated_at desc` | >50 tickets: 2nd page without loss |

---

## Phase 2 — Use-case B: Newly Assigned (v0.3.0)

**Goal:** first business need — `new` tickets assigned by a peer.

| # | Feature | Description | Criteria |
|---|---|---|---|
| F2.1 | Zammad query | `getNewIssuesForBacklog`: `owner_id:<resolved> (from <ZAMMAD_USER> login/email) AND state.name:new AND updated_at:>lastSyncAt` (DSL `owner.email`/`owner.login` also supported). If `ZAMMAD_INCLUDE_UPDATED=false`, fallback `created_at:>lastSyncAt` | New ticket assigned to `<ZAMMAD_USER>` (e.g. `nehwonlm@example.com`) by peer → appears in < `pollInterval` |
| F2.2 | “by a peer” detection | Compare current `owner_id` vs cached `prevOwnerId` + `updated_by_id != <resolved>` → `isNewlyAssignedByPeer=true` (login/email resolved to id) | Ticket created by self ≠ notified; re-assigned by peer = notified |
| F2.3 | Deduplication | Cache `persistDataSynced: {seenIds: Set, lastSyncAt: ISO8601, ownerCache: {id→owner}}` + hook `persistedDataChanged` | Same ticket not re-added after import, even after reboot |
| F2.4 | Import | Issue → SP task: `title: "🆕 [Zammad #number] title"`, `notes: url + excerpt`, `issueId/idProvider` linked, `issueWasUpdated` if `updated_at` bump | `Add to backlog` creates task with clickable link |
| F2.5 | Notification | `notify({title, body})` + `showSnack(SUCCESS)` if `autoAddBacklog=false` | User alerted without spam (max 1 / poll) |

---

## Phase 3 — Use-case A: Out of Waiting (v0.4.0)

**Goal:** second business need — `pending reminder` expiry.

| # | Feature | Description | Criteria |
|---|---|---|---|
| F3.1 | Transition detection | Cache `stateCache: {ticketId→state_id}`. Poll `state.name:open AND updated_at:>lastSyncAt` then filter `prevState==3 (pending reminder)` (id 3). Fallback heuristic: `pending_time:null` + recent `updated_at` | Sample `pending_time 2026-09-08` → `open` → detected in <90s |
| F3.2 | Subtask creation | Hook `taskUpdate` / `persistedDataChanged`: if parent task exists, `addTask({title: "🔔 Out of waiting — "+pending_time+" → "+now, parentId})`; else create parent then subtask | Subtask under `Zammad #number`, 1 level max, idempotent via `zammad:<id>:pending:<time>` |
| F3.3 | Idempotence | Key stored in `notes` or `tagIds`, checked via `getTasks()` before creation | Re-poll does not duplicate |
| F3.4 | Article link | Subtask `notes` = latest `ticket_articles` + zoom link | Click → Zammad ticket |

---

## Phase 4 — Polish & Quality (v0.5.0 → v1.0.0)

| # | Feature | Description | Criteria |
|---|---|---|---|
| F4.1 | Field mappings | `fieldMappings: [{taskField:isDone, issueField:state, pullOnly}]` — `isDone` synced if ticket `closed(4)` | Closing task ≠ close ticket (pullOnly); closing ticket → `issueWasUpdated=true` |
| F4.2 | Backlog auto | `defaultAutoAddToBacklog` + `getNewIssuesForBacklog` respects toggle | New tickets auto-add if enabled |
| F4.3 | Errors & offline | `showSnack(ERROR)` on `401`, `429`, `timeout`, `renderer not ready`; exponential backoff | No spam, retry after 2^n * pollInterval |
| F4.4 | i18n | `i18n: {languages: ["en","fr"]}`, `fr.json` via `PluginAPI.translate` | UI in French if SP is French |
| F4.5 | Packaging & doc | `icon.svg`, `CHANGELOG.md`, ZIP reproducible (`manifestVersion:1`, `minSupVersion:14.0.2`) | ZIP installs on https://test-app.super-productivity.com clean |

**v1.0.0 = phases 0-4 green + manual tests on 2 real tickets (`new` assigned + `pending reminder→open`) + install docs.**

---

## Post-v1.0.0 — Complementary Features (proposed, not prioritized)

> Each proposal = future `m` bump. `M` bump only via user PR (versioning rule).

### P1 — Immediate Productivity
- **P1.1 Filters**: by `group`, `priority`, `escalation_at`. `searchIssues` already respects `searchTerm`, add `configFields: groupFilter` (multiSelect).
- **P1.2 Quick actions**: `updateIssue` (`state` → `open/closed`, `owner_id`) via `fieldMappings` `pushOnly` — needs `group_ids:full`.
- **P1.3 Create ticket from SP**: `createIssue(title, cfg, http)` → `POST /api/v1/tickets`.
- **P1.4 Time tracking**: `issueTimeTracked` ↔ `timeSpent` via `fieldMappings` (`time_unit`).

### P2 — Observability
- **P2.1 Iframe dashboard**: `iFrame:true` + `index.html` with `getTasks()` + Zammad stats — UI Kit (`--c-primary`, `--card-bg`).
- **P2.2 Counters**: `SimpleCounter` (`getCounter/setCounter`) for `out-of-waiting / day`.
- **P2.3 Native notifications**: `PluginAPI.notify` with `requireInteraction` for `escalation_at` near.

### P3 — Robustness
- **P3.1 `pending close` (id 7)**: handle like `pending reminder` if needed.
- **P3.2 Webhook**: local endpoint push vs poll — needs Zammad server plugin or n8n.
- **P3.3 Multi-user**: `zammadUserId` = list or team mode (all unassigned `new`).
- **P3.4 Offline queue**: `persistDataSynced` queue + replay on `persistedDataChanged`.

### P4 — Advanced Integration
- **P4.1 Calendar**: `dueWithTime` ↔ `pending_time` (like `google-calendar-provider`).
- **P4.2 Automation**: `registerHook(Hooks.TASK_COMPLETE)` → auto `PATCH /tickets/:id {state: closed}` (with consent).
- **P4.3 `nodeExecution` (desktop only)**: with `permissions: ["nodeExecution"]` + consent dialog — never on web.

See `ROADMAP.md` for scheduling.
