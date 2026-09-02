# ROADMAP — SPsync

> Version 0.1 — 2026-09-02 — statut : **Analyse terminée, dev non démarré**

## Vision
Connecteur Zammad → Super Productivity : refléter automatiquement dans SP les tickets pertinents pour Fabrice (id 3) sous forme de tâches / sous-tâches.

## Jalons

### M0 — Analyse & faisabilité (✅ FAIT le 2026-09-02)
- Validation `ZAMMAD_URL`, `ZAMMAD_TOKEN`, résolution `ZAMMAD_USER_ID=3`, test `ZAMMAD_TIMEOUT` & `ZAMMAD_INCLUDE_UPDATED`
- Reverse SP Local REST API (`127.0.0.1:3876`, Bearer `URw8qzHTXD0J27bwOltuls7DpTOCyCR8`, routes `/tasks`, `/projects`, `/status`, `/health`)
- Preuve création/suppression tâche SP, preuve search Zammad DSL `owner_id:3 AND state.name:new` et `state:pending reminder`
- Livrables : `PROJET.md` § Analyse, `TODO.md`, `ROADMAP.md`

### M1 — MVP Socle (Semaine 1)
- Clients HTTP Zammad + SP + persistance `lastSyncAt` + cache état
- Commande `spsync --once --dry-run` qui liste sans écrire
- Critère sortie : `GET /status` OK, `search` Zammad OK, logs sans erreur

### M2 — Use-case B : Nouveau affecté (Semaine 1-2)
- Polling `owner_id:3 AND state:new` + détection affectation par tiers
- Création tâche SP idempotente
- Critère sortie : ticket mis à `new` et affecté à Fabrice par un collègue → tâche SP apparaît < 2 min

### M3 — Use-case A : Sortie d'attente (Semaine 2)
- Polling `open + updated_at` + comparaison cache `pending reminder → open`
- Sous-tâche `🔔 Sorti d'attente` sous tâche parente du ticket
- Critère sortie : ticket `pending reminder` dont `pending_time` expire → sous-tâche créée

### M4 — Durcissement (Semaine 3)
- Pagination, retry 503/429, rotation token SP, gestion `401 Zammad`
- Tests auto + doc install
- Critère sortie : 7 jours sans doublon ni perte, dry-run vs live identique

### M5 — Déploiement (Semaine 3-4)
- Service systemd `spsync.service`, autostart, monitoring `GET /health`
- Critère sortie : service actif au boot, logs journald

## Risques
- SP non lancé → 503 ; mitigation : retry + notif
- Zammad sans history API → mitigation : cache local
- SP sous-tâches 1 niveau max → mitigation : aplatir

## Post-MVP (idées, non priorisées)
- Support `pending close` (state 7)
- Tag SP dédié `zammad` + filtre
- Webhook Zammad si infra le permet
- UI config dans SP (plugin)

## Dépendances
- Zammad https://zammad.smiden.eu accessible + token valide (testé)
- Super Productivity ≥ vX avec Local REST API activé (Settings → Misc → Enable Local REST API) — testé `rendererReady:true`
- Python ≥3.11 ou Node ≥18
