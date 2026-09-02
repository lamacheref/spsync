# SPsync — Zammad issueProvider for Super Productivity

> **Bridge Zammad → Super Productivity.** Turns Zammad tickets into Super Productivity tasks via a native `issueProvider` plugin.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.3.18-blue.svg)](VERSION)
[![Super Productivity](https://img.shields.io/badge/SP-%3E%3D14.0.2-orange.svg)](https://github.com/johannesjo/super-productivity)
[![Gitea](https://img.shields.io/badge/Gitea-spsync-lightgrey.svg)](#)
[![GitHub](https://img.shields.io/badge/GitHub-lamacheref%2Fspsync-181717.svg?logo=github)](https://github.com/lamacheref/spsync)

**Repository:** `<GITEA_URL>` (e.g. `https://gitea.example.com/<user>/spsync.git`) mirrored to `git@github.com:lamacheref/spsync.git` — work branch `Dev`, releases on `main`, versioning `M.m.f` (see [VERSIONING.md](VERSIONING.md)). Real URLs are stored in `.cred` (ignored). `git push origin` pushes to both remotes (see `git remote -v`).

---

## Table of Contents

- [Objectives](#objectives)
- [Quick Start (per official wiki)](#quick-start-per-official-wiki)
- [Plugin vs Daemon — Decision](#plugin-vs-daemon--decision)
- [Feasibility Summary (validated 2026-09-02)](#feasibility-summary-validated-2026-09-02)
- [Architecture](#architecture)
- [Installation](#installation)
- [Development](#development)
- [Security](#security)
- [Project Structure & Docs](#project-structure--docs)
- [Changelog](#changelog)
- [Versioning & Branching](#versioning--branching)
- [Publishing (MIT)](#publishing-mit)
- [License](#license)

---

## Objectives

Create a native Super Productivity plugin that surfaces Zammad tickets where they belong — in your task list:

1. **Out of waiting** — tickets whose `pending reminder` has expired (`pending_time` reached → `open`) appear as subtasks under their parent ticket task.
2. **Newly assigned to me** — tickets in state `new` assigned to the current user (`owner_id = me`) by a peer appear as new tasks (backlog or inbox).

Both features are required for the initial release. The phrasing *“files”* in the original request maps to **Zammad tickets / ticket_articles**.

Legacy objective (now superseded but kept for traceability):

> Create a connector that creates tasks in Super Productivity via its Local REST API (`http://127.0.0.1:3876`, token `<SP_TOKEN>` — see `.cred`). The daemon approach is still documented as a fallback (see [§ Plugin vs Daemon](#plugin-vs-daemon--decision)).

---

## Quick Start (per official wiki)

This project follows **[2.15 Develop a Plugin](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin)**. The authoritative reference is **[docs/plugin-development.md](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md)** and **[packages/plugin-api/src/types.ts](https://github.com/super-productivity/super-productivity/blob/master/packages/plugin-api/src/types.ts)**.

Best starting points are the bundled examples: [`yesterday-tasks-plugin`](https://github.com/johannesjo/super-productivity/tree/master/packages/plugin-dev/yesterday-tasks-plugin), [`api-test-plugin`](https://github.com/johannesjo/super-productivity/tree/master/packages/plugin-dev/api-test-plugin), [`boilerplate-solid-js`](https://github.com/johannesjo/super-productivity/tree/master/packages/plugin-dev/boilerplate-solid-js).

```text
spsync/
├── manifest.json      # required — PluginManifest (id, name, version, manifestVersion, minSupVersion, type)
├── plugin.js          # host-side code — registers issueProvider, runs on load
├── icon.svg           # optional icon
├── index.html         # iframe UI — only if iFrame:true (not needed for issueProvider)
└── LICENSE            # MIT
```

**To test:**

1. Zip the folder with `manifest.json` at its root.
2. Open Super Productivity → **Settings → Plugins → Choose Plugin File** → select the ZIP.
3. Open DevTools (`F12` / `Ctrl+Shift+I`) to see `[Zammad SPsync]` logs.
4. Use https://test-app.super-productivity.com for safe testing — never on your production data first.

---

## Plugin vs Daemon — Decision

| Criterion | Daemon (external, via Local REST API) | **Plugin (native, chosen)** |
|---|---|---|
| Process | Separate Python/Node polling `<ZAMMAD_URL>` → `http://127.0.0.1:3876` | JS runs **inside** Super Productivity renderer |
| SP auth | `Authorization: Bearer <SP_TOKEN>` from `~/.config/superProductivity/local-rest-api-token` (0600) — see `.cred` | None — direct `PluginAPI.addTask()` / `getTasks()` |
| Zammad net | `fetch`/`requests` | `PluginHttp` injected into `registerIssueProvider` callbacks (pre-authorized) |
| Config | `.env` outside SP | `manifest.json` + `configFields` inside **Settings → Plugins** |
| Multi-device sync | Local file, not synced | `persistDataSynced` synced via SP sync backend (if enabled) |
| Lifecycle | systemd/pm2, needs SP running (`503 APP_NOT_READY` if not) | Lives as long as the app lives, installed as ZIP |
| Sandboxing | Full isolation | **No strong sandbox** — `plugin.js` via `new Function`, iframe `allow-same-origin` (see [Security](#security)) |

**Verdict:** the **`issueProvider` plugin** is idiomatic for “external tickets → SP tasks” (same pattern as GitHub/Jira/ClickUp). It gives search, backlog auto-import, and Issue Panel for free. The daemon is kept as a fallback for headless/server use.

Full analysis (live tests 2026-09-02) was moved to a concise summary below; the French predecessor is in git history (`main:PROJET.md` before this rewrite).

---

## Feasibility Summary (validated 2026-09-02)

All checks were run live from this workstation (real credentials in `.cred`, placeholders below). No business code was written during the check.

### Zammad — `<ZAMMAD_URL>` (e.g. `https://zammad.example.com`)

| Config | Tested value | Result |
|---|---|---|
| `ZAMMAD_URL` | `<ZAMMAD_URL>` | ✅ `GET /api/v1/users/me` → `200`, `x-runtime ~56ms` |
| `ZAMMAD_TOKEN` | `<ZAMMAD_TOKEN>` | ✅ `Authorization: Token token=…` valid |
| `ZAMMAD_USER` | *(empty)* | ✅ Resolved login/email `<ZAMMAD_USER>` (e.g. `nehwonlm@example.com`) via `/users/search` or `/users/me` → `<ZAMMAD_USER_EMAIL>`/id `3` (see `.cred`) |
| `ZAMMAD_TIMEOUT` | `30` | ✅ Appropriate |
| `ZAMMAD_INCLUDE_UPDATED` | `true` | ✅ `GET /tickets/search?query=updated_at:>…` works |

**Evidence (sanitized):**

- `GET /api/v1/ticket_states` → `new(1), open(2), pending reminder(3), closed(4), merged(5), pending close(7)`
- `GET /api/v1/tickets/search?query=state.name:new` → 3 tickets (e.g. `#202609019400031` sample)
- `GET /api/v1/tickets/search?query=state.name:"pending reminder"` → tickets with `pending_time: "2026-09-08T22:12:00.000Z"`, `state_id:3`
- `GET /api/v1/tickets/search?query=owner.email:<ZAMMAD_USER> AND state.name:new` (or `owner_id:<resolved>`) → `[]` (valid DSL, just no matching ticket right now)
- `GET /api/v1/tickets/search?query=owner_id:<resolved>` (from `<ZAMMAD_USER>`) → ✅ 20+ tickets (e.g. `open`, owner `<ZAMMAD_USER>`) — also valid `owner.email:<ZAMMAD_USER>`
- `GET /api/v1/tickets/:id/history` → `404` (not exposed) — use `ticket_articles/by_ticket/:id` + `updated_at` cache instead

**Implication:** polling required (no client webhook). “Out of waiting” = detect transition `pending reminder(3) → open(2)` where `pending_time` becomes `null` and `updated_by_id:1` (system scheduler). “Newly assigned” = `owner_id:<me> AND state:new` + `owner_id` transition `≠me → me` with `updated_by_id ≠me`.

### Super Productivity

| Endpoint | Auth | Result |
|---|---|---|
| `GET /health` | none | ✅ `{"server":"up","rendererReady":true}` |
| `GET /status`, `GET /tasks`, `POST /tasks`, `DELETE /tasks/:id` | `Authorization: Bearer <SP_TOKEN>` (see `.cred`) | ✅ `taskCount:200`, test task created & deleted |
| `GET /projects`, `GET /tags` | Bearer | ✅ listed |

Reverse of `app.asar` (`/electron/local-rest-api.js:455`, `/electron/shared-with-frontend/local-rest-api.model.js:6`) confirmed routes and constraints (`50 concurrent`, `1 MiB body`, `15s renderer timeout`, strict `Host`, rejected `Origin`):

```
GET  /health, GET /status, GET/POST /task-control/*, GET /tasks, POST /tasks,
GET/PATCH/DELETE /tasks/:id, POST /tasks/:id/start|archive|restore, GET /projects|/tags
```

Subtasks are **one level max** (`addTask({parentId})` inherits `projectId`/`tagIds`, `subTaskIds` forbidden via `PATCH`).

---

## Architecture

```
[ Zammad ]  --HTTPS-->  [ SP Plugin (issueProvider) ]  --PluginAPI-->  [ SP task store ]
   ^                          | pollIntervalMs: 90000                    |
   |   ticket_articles        +-- getNewIssuesForBacklog():              +-- Issue Panel
   +-- /tickets/search            owner_id:<me> AND state:new            +-- backlog
       /users/me                   pending reminder → open                +-- subtasks (🔔)
```

- **Manifest** (`manifest.json:8`): `type: "issueProvider"`, `issueProvider: {pollIntervalMs: 90000, issueProviderKey: "ZAMMAD"}` — poll handled by SP, no manual `setInterval`.
- **`plugin.js:28`**: `PluginAPI.registerIssueProvider({configFields, getHeaders, searchIssues, getById, getNewIssuesForBacklog, testConnection, issueDisplay, fieldMappings})`.
- **Mapping Zammad → `PluginSearchResult` / `PluginIssue`**: `id=ticket.id`, `title="#number title"`, `url=/#ticket/zoom/id`, `status=state_id`, `lastUpdated=updated_at`, `comments=ticket_articles`.
- **Secrets**: `PluginAPI.setSecret("zammadToken")` / `getSecret` — **local-only, never synced, never exported, purged on uninstall** ([docs/plugin-development.md § Secret Storage](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md#secret-storage)). `getHeaders` reads from secret storage (async). Do **not** store the token in `configFields` or `persistDataSynced`. Real token lives in `.cred` (ignored).
- **Subtasks for “out of waiting”**: hybrid `issueProvider` + `permissions: ["addTask","getTasks"]` + `hooks: ["taskUpdate"]` → `PluginAPI.addTask({parentId})` with dedup key `zammad:<id>:pending:<time>`.

Detailed feature breakdown by phase: see [FEATURES.md](FEATURES.md). Execution plan: [TODO.md](TODO.md), [ROADMAP.md](ROADMAP.md).

---

## Installation

### End user

1. Download `spsync.zip` from Gitea Releases (or build: `zip -r spsync.zip manifest.json plugin.js icon.svg`).
2. Super Productivity → **Settings → Plugins → Choose Plugin File** → pick the ZIP.
3. In the plugin config: set **Zammad URL** (e.g. `https://zammad.example.com`) and provide the **Zammad token** via the plugin’s secret prompt (not the `configFields` text field). Real values go in `.cred` for local dev.
4. Optionally set **User ID** (leave empty to auto-resolve via `/users/me`) and **Poll interval**.

### Update / Uninstall

- Updating re-installs the ZIP (triggers `plugin.onUnload` then `plugin.onReady`).
- Uninstall purges all secrets for `zammad-spsync`.

---

## Development

```bash
git clone <GITEA_URL>
cd spsync
git checkout Dev

# copy real credentials (never committed)
cp .cred.example .cred
# edit .cred with <ZAMMAD_URL>, <ZAMMAD_TOKEN>, <SP_TOKEN>, etc.

# edit plugin.js / manifest.json
# bump version (each commit must bump f)
./scripts/bump.sh        # patch
./scripts/bump.sh minor  # feature

# package
zip -r spsync.zip manifest.json plugin.js icon.svg

# test in SP (Settings → Plugins → Choose Plugin File), DevTools F12
```

**Prerequisites:** Super Productivity ≥ `14.0.2` (`minSupVersion`), Gitea token with `write:repository` for push (store in `.cred` or env, never in docs).

**Authoritative types:** [`packages/plugin-api/src/types.ts`](https://github.com/johannesjo/super-productivity/blob/master/packages/plugin-api/src/types.ts), [`issue-provider-types.ts`](https://github.com/johannesjo/super-productivity/blob/master/packages/plugin-api/src/issue-provider-types.ts). Examples in-repo: [`packages/plugin-dev/`](https://github.com/johannesjo/super-productivity/tree/master/packages/plugin-dev).

**Testing tips** (from `plugin-development.md`):

- Never test on production data — use https://test-app.super-productivity.com.
- `Ctrl+Shift+I` for console; check `manifest.json` syntax and `minSupVersion`.
- Wrap startup with `plugin.onReady(async () => { … })` (cold-boot safe) and cleanup with `plugin.onUnload(() => clearInterval(…))`.

---

## Security

Per **[plugin-development.md § Security Considerations](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md#security-considerations)** and **[2.15 Develop a Plugin § Security](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin#security)**:

- `plugin.js` runs **in the host renderer via `new Function`**, sharing the page context — it can reach privileged host APIs. **Only install plugins from sources you trust and audit the source.**
- Iframe plugins use `allow-same-origin` (required for `file://` desktop builds) — the filtered `PluginAPI` bridge is a convenience, not a hard boundary; the iframe can read `window.parent.ea`.
- `nodeExecution` is never requested by this plugin. If ever added, it would require an explicit native consent dialog per plugin `id` (local-only, not synced).
- Credentials are local-only via `setSecret`/`getSecret` (never synced/exported). Real tokens live in `.cred` (ignored). Declaring `http` + `allowedHosts` is not needed for `issueProvider` (its `PluginHttp` is pre-authorized); for a `standard` plugin it would be mandatory.

---

## Project Structure & Docs

```
spsync/
├── PROJET.md       # this file — overview & feasibility (EN)
├── FEATURES.md     # features by phase + post-v1 ideas
├── TODO.md         # execution checklist
├── ROADMAP.md      # milestones M0 → M5
├── VERSION         # source of truth M.m.f
├── VERSIONING.md   # M.m.f rules & tooling
├── CHANGELOG.md    # Keep a Changelog per release
├── manifest.json   # PluginManifest (issueProvider ZAMMAD)
├── plugin.js       # registerIssueProvider
├── icon.svg        # plugin icon
├── LICENSE         # MIT (© NehwonLM)
├── .cred           # real credentials (ignored)
├── .cred.example   # template
└── scripts/
    ├── bump.sh             # M.m.f bump helper
    └── hooks/pre-commit    # enforces VERSION bump
```

- **Feasibility (FR history):** previous French analysis is preserved in git history (`git show main:PROJET.md` before this commit). Real endpoints/tokens are in `.cred`.
- **Full plugin guide:** [`docs/plugin-development.md`](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md).

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) — per-commit Keep a Changelog (`M.m.f`), updated at every `Dev` push (mirrored Gitea ↔ GitHub). Documentation badges auto-synced.

## Versioning & Branching

See [VERSIONING.md](VERSIONING.md). Summary:

- `M.m.f` in `VERSION` (and `manifest.json:version`). `f` bumps on **every commit** (even non-fix), `m` on feature, `M` only via **user PR**.
- Work on `Dev`, releases via PR `Dev → main`. `main` is the Gitea default branch (no `master`). Hook `pre-commit` blocks commits without a bump.

```bash
./scripts/bump.sh        # 0.3.0 → 0.3.1
./scripts/bump.sh minor  # → 0.2.0
./scripts/bump.sh major  # → 1.0.0 (PR only)
```

---

## Publishing (MIT)

- License: **MIT** ([LICENSE](LICENSE)) — Copyright (c) 2026 NehwonLM and contributors. Chosen for community compatibility and as suggested for Super Productivity community plugins.
- To propose to the community list: PR to the Super Productivity repo or post on GitHub Discussions / Reddit per [`plugin-development.md § Contributing`](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md#contributing).
- Keep `manifest.json` fields accurate (`id: zammad-spsync`, kebab-case, ≤100 chars for future `nodeExecution` if ever needed), `minSupVersion` honest, and ZIP minimal (no external CDN assets).

---

## License

MIT — see [LICENSE](LICENSE).
