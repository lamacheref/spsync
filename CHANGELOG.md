# Changelog

All notable changes to `spsync` will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
versioning `M.m.f` (see `VERSIONING.md`). Real credentials never appear here (`<ZAMMAD_URL>` etc. — see `.cred`).

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
