# TODO — SPsync

> Généré le 2026-09-02 depuis `PROJET.md:7`. Faisabilité validée manuellement (cf. `PROJET.md` § Analyse).

## Phase 0 — Préparation (sans code métier si déjà fait)
- [ ] Renseigner `ZAMMAD_USER_ID=3` dans `.env` / `config.json` (auto-déduit de `fabrice.lamachere@smiden.fr`)
- [ ] Choisir `SP_PROJECT_ID` cible (ex: `INBOX_PROJECT` ou créer projet SP "Zammad" et noter son id via `GET /projects`)
- [ ] Décider stockage `lastSyncAt` + cache `ticketId→state/owner` (fichier `state.json` ou sqlite)
- [ ] Fixer `SP_POLL_INTERVAL` (recommandé 90s) et `ZAMMAD_TIMEOUT=30`

## Phase 1 — Socle connecteur
- [ ] Créer squelette projet (Python + `requests` ou Node + `fetch`, `.env` loader, logger)
- [ ] Implémenter `ZammadClient` : `GET /users/me`, `GET /tickets/search`, `GET /tickets/:id`, `GET /ticket_articles/by_ticket/:id` avec header `Authorization: Token token=...`
- [ ] Implémenter `SPClient` : wrapper `GET /status`, `GET /health`, `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id`, `DELETE`, `POST /tasks/:id/start` avec `Authorization: Bearer ...`
- [ ] Implémenter persistance `lastSyncAt` (ISO8601 UTC) et mapping `zammadId → spTaskId`
- [ ] Ajouter retry/backoff si SP `503 APP_NOT_READY` ou `429 TOO_MANY_REQUESTS` (max 50 concurrents)

## Phase 2 — Use-case A : Sortie d'attente
- [ ] Définir requête : `state.name:open AND updated_at:>lastSyncAt` puis filtrer `prev_state == pending reminder` (cache) OU heuristic `pending_time:NULL + updated_at récent`
- [ ] Tester sur ticket réel en `pending reminder` (ex: #6530, pending_time 2026-09-08) en avançant `lastSyncAt` artificiellement
- [ ] Créer tâche SP parente `Zammad #<number> - <title> — https://zammad.smiden.eu/#ticket/zoom/<id>` (idempotente)
- [ ] Ajouter sous-tâche `🔔 Sorti d'attente — <pending_time> → <now>` via `POST /tasks {parentId}`
- [ ] Gérer idempotence : ne pas recréer si sous-tâche `zammad:<id>:pending:<time>` déjà présente (scan `GET /tasks?query=...`)

## Phase 3 — Use-case B : Nouveau affecté par collègue
- [ ] Définir requête : `owner_id:3 AND state.name:new AND updated_at:>lastSyncAt` (DSL validé : `owner_id:3 AND state.name:new`)
- [ ] Détecter transition `owner_id !=3 → 3` + `updated_by_id !=3` pour "affecté par un collègue"
- [ ] Créer tâche SP / sous-tâche `🆕 Nouveau affecté par <auteur> — <title>`
- [ ] Tester avec ticket possédé par 3 (ex: #6598 open — changer temporairement en new si possible, ou mocker)

## Phase 4 — Robustesse & Ops
- [ ] Pagination `limit/per_page` et tri `sort_by:updated_at, order:asc` (Zammad)
- [ ] Gestion erreurs Zammad `401 Token authorization failed` → alerte
- [ ] Gestion token SP rotation (relire `~/.config/superProductivity/local-rest-api-token` si `401 Invalid authorization token`)
- [ ] Logs structurés + dry-run flag
- [ ] Tests unitaires sur parsing `pending_time`, détection transitions, idempotence

## Phase 5 — Livraison
- [ ] `README.md` installation + `.env.example`
- [ ] Service systemd / autostart (Linux) ou `pm2`
- [ ] Doc `ROADMAP.md` tenue à jour

## Hors scope immédiat
- Webhooks Zammad (nécessite plugin serveur)
- Sync bidirectionnelle SP → Zammad
- Gestion `pending close` (id 7) — à clarifier si besoin
