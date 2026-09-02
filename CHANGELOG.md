# Changelog

All notable changes to `spsync` will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
versioning `M.m.f` (see `VERSIONING.md`). Real credentials never appear here (`<ZAMMAD_URL>` etc. — see `.cred`).

## [0.3.18] - 2026-09-02

### Fixed
- `plugin.js:searchIssues` + `getById` now truly global — `+` from any open area (Today/Inbox/Zammad/other) creates task **in that area** (SP's current work context), not only Zammad; previous `0.3.17` already had global search (`NOT closed`) but `+` still failed for some due to missing `projectId` handling — now verified `6608` via direct fetch in any context

## [0.3.17] - 2026-09-02

### Fixed
- `plugin.js`: `+` in **any open area** (Today/Inbox/project ≠ Zammad) now works — `searchIssues` is global (no project filter, `NOT closed` only) and `getById` is now robust for `+` click (direct `GET /tickets/:id` + pagination fallback for `number`/`title`, e.g. `6608`/`202609029400038` even when not yet indexed); SP creates the task **in the currently open folder** (Today/Inbox/selected project) as requested, not only in Zammad

## [0.3.16] - 2026-09-02

### Fixed
- `plugin.js`: plain English labels (was `t('CFG.ZAMMAD_URL',…)`) now `'Zammad URL'` etc., keep `open` visible, `defaultAutoAddToBacklog: true→false` already in `0.3.13`, archive kept 3

## [0.3.15] - 2026-09-02

### Added
- Archive `spsync-0.3.15.zip` etc.

## [0.3.14] - 2026-09-02

### Changed
- Keep 3 archives

## [0.3.13] - 2026-09-02

### Changed
- `plugin.js:getNewIssuesForBacklog` now **does NOT use backlog at all** — returns `[]` so SP doesn't add to backlog (user: “backlog is shit”); tasks are created **directly as real tasks in the selected folder / dedicated “Zammad” project** via `addTask({projectId: <Zammad>})` only
- `manifest.json:defaultAutoAddToBacklog` `true → false` (backlog disabled by default, per user request)

### Fixed
- `plugin.js`: backlog was empty — `getNewIssuesForBacklog` now **directly indexes in dedicated “Zammad” project** (via `getAllProjects`/`addProject`, `addTask` with `projectId`) in addition to backlog, so tasks appear even if `isEnableBacklog` is off or backlog hidden; also handles `+` click via `getById` fallback already in `0.3.11` (now in `0.3.13` only direct, no backlog)

## [0.3.12] - 2026-09-02

### Fixed
- `plugin.js`: backlog was empty — `getNewIssuesForBacklog` now **directly indexes in dedicated “Zammad” project** (via `getAllProjects`/`addProject`, `addTask` with `projectId`) in addition to backlog, so tasks appear even if `isEnableBacklog` is off or backlog hidden; also handles `+` click via `getById` fallback already in `0.3.11`
- `manifest.json`: add `getAllProjects`/`addProject` to `permissions` (needed for Zammad project auto-create), kept `defaultAutoAddToBacklog: true`

## [0.3.11] - 2026-09-02

### Fixed
- `plugin.js:getById`: robust for `+` click — direct `GET /tickets/:id` now handles number-as-id and recent index delay (pagination scan for `number`/`id`, body truncated, `showSnack` on fail); `getNewIssuesForBacklog` already fixed `open` in `0.3.10`, now also handles `+` via `getById` fallback

## [0.3.10] - 2026-09-02

### Fixed
- `plugin.js:getNewIssuesForBacklog`: include `open` in addition to `new` (`owner_id AND (new OR open)`, was `new` only) — ticket 6608 `open` assigned to owner 3 was missed; add pagination fallback for `updated_at` index delay (like `searchIssues`) and set `defaultAutoAddToBacklog: true` (was `false`, so `+` nor auto-add triggered even when search found ticket)

## [0.3.9] - 2026-09-02

### Changed
- `icon.svg`: replace generic support icon with official **Zammad** icon from https://selfh.st/icons/ (`zammad.svg`, `cdn.jsdelivr.net/gh/selfhst/icons@main/svg/zammad.svg`, 1.7K, CC) — `manifest.json:icon` unchanged
- Archive: keep 3 latest `spsync-0.3.7.zip` (13K), `0.3.8.zip` (13K), `0.3.9.zip` (13K) — pruned `0.3.6` (still available as tag `0.3.6` + Release)

## [0.3.8] - 2026-09-02

### Changed
- Keep 3 archives only: `archive/` now `spsync-0.3.6.zip` (12K), `0.3.7.zip` (13K), `0.3.8.zip` (13K) — deleted `0.3.0-0.3.5` (still available as Gitea Releases assets + tags `0.3.0-0.3.5`); `!archive/*.zip` exception kept

## [0.3.7] - 2026-09-02

### Fixed
- `plugin.js:searchIssues`: handle **recent tickets not yet in search index** (e.g. `#202609029400038` / 6608 `open`, owner 3, created today) — search `202609029400038` returned `[]` due to Elasticsearch delay; now fallback to `GET /api/v1/tickets/:id` direct fetch + pagination scan (`page 131` recent, `number`/`id` match, `title` substring) and default `NOT closed` supplements recent `open` via pagination (tested `6608` direct fetch + pagination supplement)

## [0.3.6] - 2026-09-02

### Fixed
- `plugin.js:searchIssues`: fix ticket number search (e.g. `202609019400031` → no result) — was `state.name:new OR state.name:open` default filter; now `NOT state.name:closed AND NOT state.name:merged` (keeps `open` visible per user request, only filters `closed`/`merged`), and `searchTerm` now `AND NOT state.name:closed` (tested `202609019400031` → `#6605`)

## [0.3.5] - 2026-09-02

### Added
- **Phase 3 Out of Waiting** (`F3.1-F3.4`): `pending reminder(3) → open(2)` → `🔔` subtask via `PluginAPI.addTask({parentId})` — `stateCache` + `pendingDone` (capped 500) in `persistDataSynced`, `findParentTaskId` (issueId → `#number`), `handlePendingToOpen` (title `Out of waiting — pending until ... → now`, notes with link + `pending_time`), idempotence via `notes` + `getTasks()`, `showSnack` + `notify`, integrated in `getNewIssuesForBacklog` poll + `onReady` interval, `manifest` `permissions: ["addTask","getTasks"]` + `hooks: ["taskUpdate"]`

### Changed
- `manifest.json` `0.3.4 → 0.3.5`, badges auto-synced

## [0.3.4] - 2026-09-02

### Fixed
- `plugin.js`: use **plain English labels** in `configFields` (was `t('CFG.ZAMMAD_URL',…)`, now `'Zammad URL'` etc.) to eliminate i18n placeholders `CFG.ZAMMAD_URL` when `PluginAPI.translate` not ready at `registerIssueProvider` time; `i18n/en.json`+`fr.json` kept for `index.html` and future host translation (per `docs/plugin-development.md` § i18n). Labels now show correctly without needing translate.
- Verified `archive/spsync-0.3.3.zip` was built from **old** `0.3.2` code (hence token field invisible for user) — rebuilt as `0.3.4` from `0.3.3` with correct `zammadToken` (password, `required: true`) + `zammadUser` login/email

## [0.3.3] - 2026-09-02

### Added
- Archive: `archive/spsync-0.3.0.zip` (8.9K), `0.3.1.zip` (9.4K), `0.3.2.zip` (11K) + build `0.3.3.zip` (11K, 6 files, `manifest.json` at root, `!archive/*.zip` exception to `.gitignore:*.zip`), `spsync-0.3.2.zip` ready for `tag 0.3.2` release

### Changed
- Docs: `TODO.md` last update → `0.3.3`, `PROJET.md`/`README.md` badges already `0.3.3` via `scripts/bump.sh`

## [0.3.2] - 2026-09-02

### Fixed
- `plugin.js`: use **login/email** `<ZAMMAD_USER>` instead of numeric `USER_ID` — `configFields` now `zammadUser` (`Zammad login or email`, e.g. `nehwonlm@example.com`) + legacy `zammadUserId`; `resolveZammadUser` searches `login`/`email` via `/users/search` and falls back to `owner.email`/`owner.login` DSL; `testConnection` and `getNewIssuesForBacklog` updated; placeholders in docs now `<ZAMMAD_USER>` (login/email) not `<ZAMMAD_USER_ID>`
- `plugin.js`: `testConnection` and `getNewIssuesForBacklog` now correctly handle login/email vs `owner_id` (was using `USER_ID` placeholder, now login per user request)
- `i18n`: add `CFG.ZAMMAD_USER`/`_DESC` + `CFG.ZAMMAD_USER_ID_DESC` EN/FR; token field `CFG.ZAMMAD_TOKEN` already in `0.3.1`

## [0.3.1] - 2026-09-02

### Fixed
- `plugin.js`: config now asks for **Zammad Token** (`zammadToken` `type: password` field) — `testConnection` was failing with no token prompt; now migrates `config.zammadToken` to `setSecret('zammadToken')` (local-only) and validates token presence (401/403 snacks)
- `plugin.js`: i18n placeholder fix — `t()` now falls back when `PluginAPI.translate` returns key itself (was showing `CFG.ZAMMAD_URL`); added `CFG.ZAMMAD_TOKEN`/`_DESC` to `i18n/en.json`+`fr.json`
- `testConnection`: now checks `base` + `token` presence, shows `SUCCESS`/`ERROR` snack with status-specific messages

## [0.3.0] - 2026-09-02

### Added
- **Phase 2 Newly Assigned** (`F2.1-F2.5`): `plugin.js:getNewIssuesForBacklog` real — `owner_id:<ZAMMAD_USER_ID> AND state.name:new AND updated_at:>lastSyncAt` (ISO, limit 50, sort `updated_at desc`, `timeout` from `zammadTimeout`, fallback 7d), peer detection `ownerCache` + `updated_by_id ≠me` → `_isPeerAssigned`/`_prevOwner`, dedup `persistDataSynced` (`seenIds` capped 500 + `ownerCache` + `lastSyncAt` ISO) + `PERSISTED_DATA_CHANGED` hook, `🆕 #number title`, `showSnack` + `notify` once per poll
- **Phase 1 Reading** consolidated (was `0.1.8`): `searchIssues`/`getById`/`testConnection` + `issueDisplay`/`commentsConfig` (now part of `0.3.0` package)
- Build: `spsync-0.3.0.zip` (`manifest.json` at root, `i18n` EN/FR, `icon.svg`, no CDN assets) — installable via `Settings → Plugins → Choose Plugin File`

### Changed
- Version jump `0.1.9 → 0.3.0` (minor, Phase 2 delivery per `FEATURES.md:45`), `TODO.md` Phase 2 ✅ DONE

## [0.1.9] - 2026-09-02

### Added
- **Phase 2 Newly Assigned** (`F2.1-F2.5`): `plugin.js:getNewIssuesForBacklog` real — `owner_id:<ZAMMAD_USER_ID> AND state.name:new AND updated_at:>lastSyncAt` (ISO, limit 50, sort `updated_at desc`, `timeout` from `zammadTimeout`, fallback 7d), peer detection `ownerCache` + `updated_by_id ≠me` → `_isPeerAssigned`/`_prevOwner`, dedup `persistDataSynced` (`seenIds` capped 500 + `ownerCache` + `lastSyncAt` ISO) + `PERSISTED_DATA_CHANGED` hook, `🆕 #number title`, `showSnack` + `notify` once per poll
- `plugin.js:0.1.8 → 0.1.9` (`Phase 2`), `onReady` logs `syncedData`, `persistedDataChanged` hook

## [0.1.8] - 2026-09-02

### Added
- **Phase 1 Reading** (`F1.1-F1.5`): `plugin.js` wired to real Zammad (`PluginHttp` `timeout` from `zammadTimeout`, `searchIssues` `limit 50` `sort_by updated_at desc`, `getById` `ticket` + `ticket_articles` → `PluginIssue` with `pendingTime`/`ownerId`/`commentsConfig`, `testConnection` real `GET /users/me` + `GET /ticket_states` + `cachedUserId` via `persistDataSynced`, `issueDisplay` pendingTime/group, `commentsConfig`, `fieldMappings`, error `showSnack`)
- Verified `node --check`, ZIP `manifest.json` at root

## [0.1.7] - 2026-09-02

### Changed
- Docs maintenance: `TODO.md` Phase 0 ✅ DONE update, `CHANGELOG.md` linked in `README.md`/`PROJET.md` `## Changelog` sections (TOC + badge auto-sync), bump `0.1.6 → 0.1.7`
- `PROJET.md`/`README.md` badges auto-synced via `scripts/bump.sh` + CI

## [0.1.6] - 2026-09-02

### Changed
- Docs auto-sync on every push: `scripts/bump.sh` now syncs `README.md`/`PROJET.md` badges `version-*` + `manifest.json` on every `patch`/`minor`/`major`
- Pre-commit hook now verifies `badge == VERSION`, blocks commit if docs desynced
- CI `.gitea/workflows/docs.yml` + `.github/workflows/docs.yml` checks `VERSION == manifest == badges` on push `Dev`/`main`
- Fix drift `0.1.4 badge` vs `0.1.5 VERSION` → `0.1.6`

### Added
- Dual CI workflows for Gitea and GitHub mirrors

## [0.1.5] - 2026-09-02

### Added
- **Phase 0 scaffold** (complete per 2026-09-02 arbitration: `setSecret` + Complet + iFrame oui minimal + 90s + EN/FR)
  - `manifest.json`: `iFrame:true` + `i18n` EN/FR (`pollIntervalMs 90000`, `0.1.5`)
  - `plugin.js`: `configFields` complet (`zammadUrl`, `zammadUserId` auto, `pollInterval` 30s/90s/5min, `autoAddBacklog`, `zammadTimeout` advanced) + `getHeaders` via `getSecret('zammadToken')` (local-only) + scaffold `searchIssues`/`getById`/`getNewIssuesForBacklog` (empty, logs) + `testConnection` + `issueDisplay`/`fieldMappings` + `onReady`/`onUnload`
  - `index.html`: debug UI inline (CSS/JS inlined, UI Kit `var(--s3)`) — `setSecret`/`getSecret`/`deleteSecret`, `testConnection`, `persistDataSynced` demo, logs, `onReady`
  - `i18n/en.json` + `fr.json` (`CFG.*` + `UI.*`)
  - `.cred.example` (+ `POLL_INTERVAL`, `AUTO_ADD_BACKLOG`, `GITHUB_URL`) — ZIP validated (`manifest` at root, no CDN assets)
- Verified `python -m json.tool` + `node --check` + ZIP `manifest.json` at root per `docs/plugin-development.md § Best Practices`

## [0.1.4] - 2026-09-02

### Added
- GitHub mirror `git@github.com:lamacheref/spsync.git` + dual-push `origin` (Gitea https + GitHub ssh)
- `README.md` + `PROJET.md`: badges GitHub + dual-clone instructions (`git clone <GITEA_URL>` or `git@github.com:lamacheref/spsync.git`, `git remote -v`)

### Changed
- `PROJET.md` badge `0.1.3 → 0.1.4` sync

## [0.1.3] - 2026-09-02

### Added
- `README.md` polished landing: shields (MIT, `0.1.3`, `issueProvider`, SP≥14.0.2), TOC, Why/Quick Start (wiki 2.15), Installation, Configuration (`.cred` placeholders), Documentation table, Features at a Glance, Structure, Dev, Versioning, Security, Publishing (MIT © NehwonLM)

### Changed
- `PROJET.md` badge `0.1.1 → 0.1.3` (via manual sync before auto-sync)

## [0.1.2] - 2026-09-02

### Changed
- Anonymization: `PROJET.md`/`FEATURES.md`/`TODO.md`/`ROADMAP.md` → placeholders `<ZAMMAD_TOKEN>`/`<SP_TOKEN>`/`<ZAMMAD_URL>`/`https://zammad.example.com`/`<GITEA_URL>`/`<ZAMMAD_USER_EMAIL>` (real values moved to `.cred` ignored, `.cred.example` template)
- `LICENSE`: `Fabrice Lamachère (SMiDeN)` → `NehwonLM`
- `.gitignore`: ignore `.cred`/`.cred.local`, keep `.cred.example`
- `plugin.js` example URL anonymized

## [0.1.1] - 2026-09-02

### Changed
- `PROJET.md`: full rewrite to English, readable structure per wiki [2.15 Develop a Plugin](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin) — TOC, badges, Quick Start, Architecture, Security, MIT ready
- `manifest.json` synced to `0.1.1`, `LICENSE` anonymized to NehwonLM (later fully to `NehwonLM` in `0.1.2`)
- Added `plugin.js` minimal `issueProvider` (`registerIssueProvider`, `getHeaders` via `setSecret`, `searchIssues`/`getById`/`getNewIssuesForBacklog`) + `icon.svg`

## [0.1.0] - 2026-09-02

### Added
- Feasibility analysis Zammad + Super Productivity Local REST API (`PROJET.md`)
- Validation Zammad access (`<ZAMMAD_URL>`, placeholder token, `user_id` resolved) and SP (`127.0.0.1:3876`) — real values in `.cred` (ignored)
- Plugin `issueProvider` architecture chosen
- `FEATURES.md` by phase (0 → 1.0.0 + post-v1)
- Scaffolding `manifest.json` (type `issueProvider` ZAMMAD, poll 90s)
- Versioning `M.m.f`: `VERSION`, `scripts/bump.sh`, `pre-commit` hook, `VERSIONING.md`
- Gitea repo `<GITEA_URL>` (real URL in `.cred`), branches `main` / `Dev`, GitHub mirror pending (added in `0.1.4`)
