# Changelog

All notable changes to `spsync` will be documented here.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
versioning `M.m.f` (see `VERSIONING.md`).

## [0.1.1] - 2026-09-02

### Changed
- `PROJET.md`: full rewrite to English, readable structure per wiki [2.15 Develop a Plugin](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin) — TOC, badges, Quick Start, Architecture, Security, MIT ready
- `manifest.json` synced to `0.1.1`, `LICENSE` anonymized to NehwonLM
- Added `plugin.js` minimal `issueProvider` (`registerIssueProvider`, `getHeaders` via `setSecret`, `searchIssues`/`getById`/`getNewIssuesForBacklog`) + `icon.svg`

## [0.1.0] - 2026-09-02

### Added
- Feasibility analysis Zammad + Super Productivity Local REST API (`PROJET.md`)
- Validation Zammad access (`<ZAMMAD_URL>`, placeholder token, `user_id` resolved) and SP (`127.0.0.1:3876`) — real values in `.cred` (ignored)
- Plugin `issueProvider` architecture chosen
- `FEATURES.md` by phase (0 → 1.0.0 + post-v1)
- Scaffolding `manifest.json` (type `issueProvider` ZAMMAD, poll 90s)
- Versioning `M.m.f`: `VERSION`, `scripts/bump.sh`, `pre-commit` hook, `VERSIONING.md`
- Gitea repo `<GITEA_URL>` (real URL in `.cred`), branches `main` / `Dev`
