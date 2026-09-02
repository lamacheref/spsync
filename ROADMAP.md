# ROADMAP — SPsync

> Version 0.1 — 2026-09-02 — status: **Analysis done, dev not started**  
> Repository: `<GITEA_URL>` (real URL in `.cred`, ignored). Branch `Dev` → PR → `main`.

## Vision

Zammad → Super Productivity connector (issueProvider): automatically surface relevant Zammad tickets in SP as tasks/subtasks. Primary user: NehwonLM (`<ZAMMAD_USER_ID>` placeholder, real id in `.cred`).

## Milestones

### M0 — Analysis & Feasibility (✅ DONE 2026-09-02)
- Validation `ZAMMAD_URL`, `ZAMMAD_TOKEN` placeholder, resolution `<ZAMMAD_USER_ID>` via `/users/me`, `ZAMMAD_TIMEOUT` & `ZAMMAD_INCLUDE_UPDATED`
- Reverse SP Local REST API (`127.0.0.1:3876`, Bearer `<SP_TOKEN>`, routes `/tasks`, `/projects`, `/status`, `/health`) — now superseded by plugin `PluginAPI`
- Chosen architecture: **issueProvider plugin** (poll 90s, `issueProviderKey: ZAMMAD`) — daemon kept as fallback
- Deliverables: `PROJET.md`, `TODO.md`, `ROADMAP.md`, `FEATURES.md`

### M1 — MVP Foundation (Week 1)
- `plugin.js:registerIssueProvider` + `manifest.json` + `icon.svg` + secret storage
- `getNewIssuesForBacklog` (newly assigned) + `searchIssues`/`getById`
- ZIP installs clean, `testConnection` green

### M2 — Use-case B: Newly Assigned (Week 1-2)
- Polling `owner_id:<ZAMMAD_USER_ID> AND state:new` + peer detection
- Idempotent task creation
- Exit: ticket assigned to `<ZAMMAD_USER_ID>` by peer → SP task in < 90s

### M3 — Use-case A: Out of Waiting (Week 2)
- Poll `open + updated_at` + `stateCache` (`pending reminder(3) → open(2)`)
- Subtask `🔔 Out of waiting` under parent ticket task
- Exit: pending ticket expiry → subtask created

### M4 — Hardening ✅ DONE (0.5.0)
- Pagination, `withRetry` backoff (429/timeout), i18n EN/FR, docs auto-sync + CI

### M5 — Release ✅ DONE (1.0.0-rc1)
- Bump `M` via PR utilisateur → **`1.0.0-rc1`** (tag pré-release, Gitea pre-release + GitHub tag, `archive/spsync-1.0.0-rc1.zip`)
- `CHANGELOG.md` complet, docs à jour
- Next : **7 j d'observation RC** → si verts → tag final **`v1.0.0`** + candidature communauté (Reddit / GitHub Discussions)

## Risks

- SP not launched → plugin still lives (advantage over daemon)
- Zammad no history API → mitigation: local `stateCache` via `persistDataSynced`
- SP subtasks 1 level max → mitigation: flatten

## Post-MVP (see FEATURES.md P1-P4)

- `pending close` (state 7), tag filter, webhook (if infra allows), iframe dashboard

## Dependencies

- Zammad `<ZAMMAD_URL>` reachable + token (placeholder `<ZAMMAD_TOKEN>` in docs, real in `.cred`)
- Super Productivity ≥ `14.0.2` — tested `rendererReady:true`
- Node ≥18 for packaging (zip)
