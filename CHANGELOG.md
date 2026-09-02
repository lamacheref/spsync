# Changelog

Toutes les modifications notables de `spsync` seront documentées ici.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
versioning `M.m.f` (cf. `VERSIONING.md`).

## [0.1.0] - 2026-09-02

### Added
- Analyse faisabilité Zammad + Super Productivity Local REST API (PROJET.md:14)
- Validation accès Zammad (`zammad.smiden.eu`, token, user_id=3) et SP (`127.0.0.1:3876`)
- Session plugin `issueProvider` — architecture recommandée (PROJET.md:143)
- FEATURES.md par phase (0 → 1.0.0 + post-v1)
- Scaffolding plugin `manifest.json` (type issueProvider ZAMMAD, poll 90s)
- Versioning M.m.f : `VERSION`, `scripts/bump.sh`, hook `pre-commit`, `VERSIONING.md`
- Dépôt Gitea https://gitea.smiden.eu/flamachere/spsync.git, branches `main` / `Dev`
