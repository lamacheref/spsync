# SPsync

> **Zammad → Super Productivity.** A native `issueProvider` plugin that turns your Zammad tickets into Super Productivity tasks — right where you work.

[![License: MIT](https://img.shields.io/badge/License-MIT-success.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.5.0-blue.svg)](VERSION)
[![Manifest](https://img.shields.io/badge/manifest-issueProvider-9cf.svg)](manifest.json)
[![Super Productivity](https://img.shields.io/badge/SP-%3E%3D14.0.2-orange.svg)](https://github.com/johannesjo/super-productivity)
[![Gitea](https://img.shields.io/badge/Gitea-Dev-lightgrey.svg)](#)
[![GitHub](https://img.shields.io/badge/GitHub-lamacheref%2Fspsync-181717.svg?logo=github)](https://github.com/lamacheref/spsync)
[![Plugin Type](https://img.shields.io/badge/type-issueProvider-important.svg)](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin)
[![Docs](https://img.shields.io/badge/docs-EN-blueviolet.svg)](PROJET.md)

**Two things, done automatically:**

| 🔔 | **Out of waiting** | `pending reminder` expired (`pending_time` → `open`) → subtask under its parent ticket task |
|---|---|---|
| 🆕 | **Newly assigned** | `new` ticket assigned to you (`owner_id = me`) by a peer → new backlog task |

*No external daemon, no extra token file — everything lives inside Super Productivity.*

---

## Table of Contents

- [Why SPsync?](#why-spsync)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Documentation](#documentation)
- [Features at a Glance](#features-at-a-glance)
- [Project Structure](#project-structure)
- [Development](#development)
- [Changelog](#changelog)
- [Versioning & Branching](#versioning--branching)
- [Security](#security)
- [Publishing](#publishing)
- [License](#license)

---

## Why SPsync?

Zammad is great at tracking tickets. Super Productivity is great at getting things **done**. SPsync connects the two **natively** — no cron, no `http://127.0.0.1:3876` daemon, no second process to babysit.

It is built as an **`issueProvider` plugin** (same family as GitHub, Jira, ClickUp): SP polls Zammad on a schedule, you browse tickets in the **Issue Panel**, one click adds them to your backlog, and `pending reminder → open` transitions become `🔔` subtasks.

> Full feasibility (live API tests 2026-09-02) → [PROJET.md](PROJET.md)  
> Need the old daemon approach? It’s still documented as a fallback in [PROJET.md § Plugin vs Daemon](PROJET.md#plugin-vs-daemon--decision).

---

## Quick Start

Per **[2.15 Develop a Plugin](https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin)** and **[docs/plugin-development.md](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md)**:

```bash
# 1. Package (manifest.json must be at the root of the ZIP)
zip -r spsync.zip manifest.json plugin.js icon.svg

# 2. Install in Super Productivity
# Settings → Plugins → Choose Plugin File → spsync.zip

# 3. Open DevTools (F12) — look for [Zammad SPsync]
```

> **Tip:** test on https://test-app.super-productivity.com first — never on your production data.

---

## Installation

### For users

1. **Download** `spsync.zip` from *Gitea → Releases* (or build it yourself, see above).
2. **Install:** Super Productivity → **Settings → Plugins → Choose Plugin File** → select the ZIP.
3. **Configure:** set **Zammad URL** (e.g. `https://zammad.example.com`) and paste your **Zammad token** via the secret prompt (never in a text field — see [Security](#security)).
4. Leave **User ID** empty to auto-resolve via `/api/v1/users/me`.

Updating is the same ZIP upload — it triggers `plugin.onUnload` → `plugin.onReady`.  
Uninstalling purges all `zammad-spsync` secrets (local-only).

### Requirements

- Super Productivity **≥ 14.0.2** (`minSupVersion`)
- Zammad reachable at `<ZAMMAD_URL>` (real URL in `.cred`, see [Configuration](#configuration))

---

## Configuration

Real credentials are **never committed**. Placeholders in docs (`<ZAMMAD_URL>`, `<ZAMMAD_TOKEN>`, `<SP_TOKEN>`, `<GITEA_URL>`) map to a local file:

```bash
cp .cred.example .cred   # .cred is ignored (see .gitignore:15)
# edit .cred with your real values
```

| Key | Docs placeholder | Real value lives in |
|---|---|---|
| Zammad URL | `<ZAMMAD_URL>` / `https://zammad.example.com` | `.cred:ZAMMAD_URL` |
| Zammad token | `<ZAMMAD_TOKEN>` | `.cred:ZAMMAD_TOKEN` (via `PluginAPI.setSecret`) |
| SP Local REST token | `<SP_TOKEN>` | `.cred:SP_TOKEN` (daemon fallback only) |
| Gitea repo | `<GITEA_URL>` | `.cred:GITEA_URL` |

> The plugin reads the Zammad token from **secret storage** (`setSecret`/`getSecret` — local-only, never synced, never exported). Do not paste it in `configFields` or `persistDataSynced`.

---

## Documentation

| Document | What it is |
|---|---|
| **[PROJET.md](PROJET.md)** | Project overview, objectives, feasibility (EN), architecture, wiki-compliant quick start, security, publishing guide |
| **[FEATURES.md](FEATURES.md)** | Features by Phase (0 → v1.0.0) + complementary ideas post-v1 |
| **[TODO.md](TODO.md)** | Execution checklist (preparation → delivery) |
| **[ROADMAP.md](ROADMAP.md)** | Milestones M0 → M5, vision, risks, dependencies |
| **[VERSIONING.md](VERSIONING.md)** | `M.m.f` rules, `scripts/bump.sh`, pre-commit hook, branching |
| **[CHANGELOG.md](CHANGELOG.md)** | Keep a Changelog per release |
| **[LICENSE](LICENSE)** | MIT © NehwonLM |

All `.md` in the repo use **placeholders** — real endpoints/tokens are in `.cred`.

---

## Features at a Glance

**Shipped / planned (see [FEATURES.md](FEATURES.md) for criteria):**

- **Phase 0 — Foundation (`v0.1.x`)** → manifest, `issueProvider` scaffold, `configFields`, secret storage, `testConnection`
- **Phase 1 — Reading (`v0.2.0`)** → `PluginHttp` wrapper, `searchIssues`/`getById` over `/tickets/search` + `/ticket_articles`, pagination
- **Phase 2 — Newly Assigned (`v0.3.0`)** → `getNewIssuesForBacklog`: `owner_id:<me> AND state:new` + peer-detection + dedup
- **Phase 3 — Out of Waiting (`v0.4.0`)** → `pending reminder(3) → open(2)` transition → `🔔` subtask (`addTask({parentId})`)
- **Phase 4 — Polish (`v0.5.0 → v1.0.0`)** → `fieldMappings`, backlog auto, backoff, i18n, ZIP

**After v1.0.0** → filters by group/priority, `updateIssue`/`createIssue`, time tracking, iframe dashboard, counters, `pending close` (id 7), webhooks, calendar/time-blocking, `nodeExecution` (desktop only). Each = future `m` bump; `M` only via user PR.

---

## Project Structure

```text
spsync/
├── README.md       # this file — user-facing entry point
├── PROJET.md       # overview & feasibility (EN)
├── FEATURES.md     # features by phase + post-v1
├── TODO.md         # checklist
├── ROADMAP.md      # milestones
├── VERSION         # source of truth M.m.f (0.3.1)
├── VERSIONING.md   # M.m.f tooling
├── CHANGELOG.md    # per-release notes
├── manifest.json   # PluginManifest (issueProvider ZAMMAD 0.1.3)
├── plugin.js       # registerIssueProvider
├── icon.svg        # plugin icon
├── LICENSE         # MIT © NehwonLM
├── .cred.example   # template (commit) — copy to .cred
├── .cred           # real credentials (ignored, 0600)
└── scripts/
    ├── bump.sh            # M.m.f helper
    └── hooks/pre-commit   # enforces VERSION bump
```

---

## Development

```bash
# Clone — mirrored on Gitea and GitHub (kept in sync)
git clone <GITEA_URL>          # or: git@github.com:lamacheref/spsync.git
cd spsync
git checkout Dev
# remotes (already configured): origin pushes to both Gitea and GitHub
#   origin  → Gitea (fetch) + Gitea+GitHub (push)
#   github  → git@github.com:lamacheref/spsync.git
git remote -v

cp .cred.example .cred   # fill real values

# code
# bump version on EVERY commit (hook enforces it)
./scripts/bump.sh        # patch → 0.3.0 → 0.3.1
./scripts/bump.sh minor  # feature → 0.2.0
# major only via user PR: ./scripts/bump.sh major

# package & test
zip -r spsync.zip manifest.json plugin.js icon.svg
# → Settings → Plugins → Choose Plugin File → F12
```

**Authoritative types:** [`plugin-api/src/types.ts`](https://github.com/johannesjo/super-productivity/blob/master/packages/plugin-api/src/types.ts) · [`issue-provider-types.ts`](https://github.com/johannesjo/super-productivity/blob/master/packages/plugin-api/src/issue-provider-types.ts)  
**Examples:** [`packages/plugin-dev/`](https://github.com/johannesjo/super-productivity/tree/master/packages/plugin-dev) (`yesterday-tasks-plugin`, `api-test-plugin`, `boilerplate-solid-js`)

**Tips from the official guide:**

- Wrap startup in `plugin.onReady(async () => …)` (cold-boot safe), cleanup in `plugin.onUnload(() => …)`
- Inline CSS/JS in `index.html` if you add an iframe; use SP theme vars (`--c-primary`, `--card-bg`, …)

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) — updated on every commit (`M.m.f` + Keep a Changelog). Badges in this README and [PROJET.md](PROJET.md) are auto-synced via `scripts/bump.sh` + pre-commit hook + CI.

## Versioning & Branching

**`M.m.f`** (see [VERSIONING.md](VERSIONING.md)):

- `f` bumps on **every commit** (even docs)
- `m` bumps on feature (at least one `FEATURES.md` entry delivered)
- `M` bumps **only via user PR** (breaking change)

Branching: `Dev` (work) → PR → `main` (releases, Gitea default, no `master`).  
Pre-commit hook blocks commits without a `VERSION` bump and checks `manifest.json:version == VERSION`.

---

## Security

Per **[plugin-development.md § Security Considerations](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md#security-considerations)**:

- `plugin.js` runs in the host renderer via `new Function` — **not strongly sandboxed**, can reach host APIs. Only install from sources you trust and audit.
- Iframe `allow-same-origin` is required for `file://` desktop builds — the `PluginAPI` bridge is a convenience, not a hard isolation.
- Credentials: `setSecret`/`getSecret` are **local-only, never synced, never exported**, purged on uninstall. Real tokens live in `.cred` (ignored).  
  This plugin never requests `nodeExecution`; if it ever does, it would need an explicit native consent dialog per `id`.

---

## Publishing

- **License:** MIT ([LICENSE](LICENSE)) — © 2026 NehwonLM. Chosen for community compatibility (suggested for SP community plugins).
- **To propose:** PR / Discussion on [super-productivity](https://github.com/johannesjo/super-productivity) or Reddit, per [Contributing](https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md#contributing).
- Keep `manifest.json` accurate (`id: zammad-spsync`, kebab-case ≤100 chars, honest `minSupVersion`, minimal ZIP — no CDN assets).

---

## License

MIT — see [LICENSE](LICENSE).  
Crafted by **NehwonLM** and contributors.

*Super Productivity is by [Johannes Millan](https://github.com/johannesjo) — this plugin is not affiliated, just a grateful extension.*
