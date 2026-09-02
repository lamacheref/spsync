# FEATURES — SPsync (Plugin issueProvider Zammad)

> Version du document : 0.1.0 — 2026-09-02  
> Architecture cible validée : **Plugin `issueProvider`** Super Productivity (cf. `PROJET.md:143`).  
> Dépôt : https://gitea.smiden.eu/flamachere/spsync.git — branche de travail `Dev`, releases sur `main`.

---

## Conventions

- **M.m.f** : `M`=Major (breaking, PR utilisateur uniquement), `m`=Minor (nouvelle feature), `f`=Fix/Patch (chaque commit bump `f`, même si non-fix — règle projet).
- **Phase** = incrément `m` potentiel. Chaque Phase livre un ZIP installable via `Settings → Plugins → Choose Plugin File`.
- **Source vérité Zammad** : `https://zammad.smiden.eu`, `GET /api/v1/tickets/search` DSL, `GET /api/v1/ticket_articles/by_ticket/:id`, token `Token token=...` (stocké via `setSecret`).

---

## Phase 0 — Socle & Installation (v0.1.0)

**Objectif :** plugin vide qui s'installe, se configure et se débug.

| # | Feature | Description | Critère d'acceptation |
|---|---|---|---|
| F0.1 | Scaffolding plugin | `manifest.json` (`id: zammad-spsync`, `type: issueProvider`, `issueProvider: {pollIntervalMs: 90000, icon: support, humanReadableName: Zammad, issueProviderKey: ZAMMAD}`, `iFrame: false`), `plugin.js`, `icon.svg`, `README` | ZIP s'installe sans erreur, apparaît dans `Settings → Plugins`, `F12` sans exception |
| F0.2 | Config Zammad | `registerIssueProvider.configFields` : `zammadUrl` (input, default `https://zammad.smiden.eu`), `zammadToken` (password), `zammadUserId` (input, vide = auto `/users/me`), `pollInterval` (select 30s/90s/300s), `autoAddBacklog` (checkbox) | Champs visibles, valeurs persistées (config synchée sauf secret), `testConnection` button → `GET /users/me` → `200` |
| F0.3 | Secret storage | Token stocké via `PluginAPI.setSecret("zammadToken")` / `getSecret`, jamais en `configFields` synché, jamais exporté | Après `persistDataSynced` / Export, token absent ; `getHeaders` relit `getSecret` (async) ; après uninstall, secret purgé |
| F0.4 | Health check | `getHeaders` + `testConnection` : `GET /api/v1/users/me`, `GET /api/v1/ticket_states` | `testConnection` → `true` si `id` retourné, `false` sinon + `showSnack(ERROR)` |
| F0.5 | Logs & debug | `console.log` préfixé `[Zammad]` + `showSnack` sur erreur réseau | Erreur réseau visible en DevTools + snackbar |

---

## Phase 1 — Lecture Zammad (v0.2.0)

**Objectif :** le plugin sait parler à Zammad.

| # | Feature | Description | Critère |
|---|---|---|---|
| F1.1 | Client HTTP | Wrapper `PluginHttp` : `get(url, {params, headers})` avec `Authorization: Token token=...` via `getHeaders`, `timeout: ZAMMAD_TIMEOUT=30s` | `GET /tickets/search?q=state.name:new&limit=3` → 200 en <30s |
| F1.2 | Résolution UserId | Si `zammadUserId` vide, `GET /users/me` → `id` (ex: 3) mémorisé en `persistDataSynced` | `owner_id:3` utilisé dans toutes les requêtes suivantes |
| F1.3 | Mapping ticket → issue | `searchIssues(searchTerm, cfg, http)` mappe `ticket` → `PluginSearchResult {id, title:#number title, url: /#ticket/zoom/id, status, assignee, labels}` et `getById` → `PluginIssue {id, title, body, url, state, lastUpdated, comments}` via `ticket_articles` | Issue affichée dans Issue Panel avec lien cliquable Zammad |
| F1.4 | Issue display | `issueDisplay: [{summary link}, {state}, {assignee}, {group}, {pending_time}]`, `commentsConfig: {author:from, body, created:created_at}` | Panneau détail montre articles non-internes, dates lisibles |
| F1.5 | Pagination & limit | `limit=50`, `per_page` + tri `updated_at desc` | >50 tickets : 2e page chargée sans perte |

---

## Phase 2 — Use-case B : Nouveaux affectés (v0.3.0)

**Objectif :** premier besoin métier — tickets `new` affectés par un collègue.

| # | Feature | Description | Critère |
|---|---|---|---|
| F2.1 | Requête Zammad | `getNewIssuesForBacklog` : `owner_id:<userId> AND state.name:new AND updated_at:>lastSyncAt` (DSL validé `PROJET.md:34`). Si `ZAMMAD_INCLUDE_UPDATED=false`, fallback `created_at:>lastSyncAt` | Nouveau ticket affecté à Fabrice par collègue → apparaît en < `pollInterval` |
| F2.2 | Détection "par un collègue" | Comparer `owner_id` courant vs cache `prevOwnerId` + `updated_by_id != userId` → marquer `isNewlyAssignedByPeer=true` | Ticket créé par Fabrice lui-même ≠ notifié ; ticket réaffecté par collègue = notifié |
| F2.3 | Déduplication | Cache `persistDataSynced: {seenIds: Set, lastSyncAt: ISO8601, ownerCache: {id→owner}}` + hook `persistedDataChanged` | Même ticket ne réapparaît pas après import, même après reboot |
| F2.4 | Import | Issue → tâche SP : `title: "🆕 [Zammad #number] title"`, `notes: url + excerpt article 0`, `issueId/idProvider` liés, `issueWasUpdated` si `updated_at` bump | `Add to backlog` crée tâche avec lien Zammad cliquable |
| F2.5 | Notif | `notify({title, body})` + `showSnack(SUCCESS)` si `autoAddBacklog=false` | L'utilisateur est alerté sans spam (max 1 notif / poll) |

---

## Phase 3 — Use-case A : Sortie d'attente (v0.4.0)

**Objectif :** second besoin métier — tickets qui sortent de `pending reminder`.

| # | Feature | Description | Critère |
|---|---|---|---|
| F3.1 | Détection transition | Cache `stateCache: {ticketId→state_id}`. Poll `state.name:open AND updated_at:>lastSyncAt` puis filtrer `prevState==3 (pending reminder)` (id 3 validé `PROJET.md:30`). Heuristique fallback : `pending_time:null` + `updated_at` récent | Ticket #6530 `pending_time 2026-09-08` → `open` → détecté en <90s |
| F3.2 | Création sous-tâche | Hook `taskUpdate` / `persistedDataChanged` : si ticket parent existe, `addTask({title: "🔔 Sorti d'attente — "+pending_time+" → "+now, parentId: parentTaskId})` ; sinon créer tâche mère puis sous-tâche | Sous-tâche sous tâche mère `Zammad #number`, 1 niveau max (cf. `PROJET.md:80`), idempotence via clé `zammad:<id>:pending:<time>` |
| F3.3 | Idempotence | Clé stockée en `notes` ou `tagIds` de la sous-tâche, vérifiée via `getTasks()` avant création | Relance poll ne duplique pas la sous-tâche |
| F3.4 | Lien article | Sous-tâche `notes` = dernier `ticket_articles` (réponse sortie d'attente) + lien zoom | Click `notes` → Zammad ticket |

---

## Phase 4 — Finition & Qualité (v0.5.0 → v1.0.0)

| # | Feature | Description | Critère |
|---|---|---|---|
| F4.1 | Field mappings | `fieldMappings: [{taskField:isDone, issueField:state, pullOnly}, {title, notes off}]` — `isDone` synché si ticket `closed(4)` | Fermer tâche → ne ferme pas ticket (pullOnly) ; fermer ticket Zammad → tâche `issueWasUpdated=true` |
| F4.2 | Backlog auto | `defaultAutoAddToBacklog: true/false` configurable + `getNewIssuesForBacklog` respecte le toggle SP | Nouveaux tickets arrivent auto en backlog si activé |
| F4.3 | Erreurs & offline | `showSnack(ERROR)` si `401 Token`, `429`, `timeout`, `renderer not ready` ; backoff exponentiel | Pas de spam, retry après 2^n * pollInterval |
| F4.4 | i18n | `i18n: {languages: ["en","fr"]}`, traductions `fr.json` (via `PluginAPI.translate`) pour configFields | UI en français si SP en français |
| F4.5 | Packaging & doc | `icon.svg`, `README`, `CHANGELOG.md`, ZIP reproductible (`manifestVersion:1`, `minSupVersion:14.0.2`) | ZIP installable sur `test-app.super-productivity.com` sans warning |

**v1.0.0 = toutes phases 0-4 vertes + tests manuels sur 2 tickets réels (un `new` affecté, un `pending reminder→open`) + doc install.**

---

## Post-v1.0.0 — Fonctionnalités complémentaires (proposées, non priorisées)

> Chaque proposition = futur bump `m` (Minor). Un bump `M` (Major) uniquement via PR utilisateur (règle versioning).

### P1 — Productivité immédiate
- **P1.1 Tri & filtres Issue Panel** : filtre par `group` (Techniciens/Utilisateurs/VIP), `priority`, `escalation_at`. `searchIssues` respecte `searchTerm` déjà supporté, ajouter `configFields: groupFilter` (multiSelect).
- **P1.2 Actions rapides** : `updateIssue` (changer `state` → `open/closed`, `owner_id`) depuis SP via `fieldMappings` `pushOnly` — nécessite droits `group_ids:full` (validé pour Fabrice).
- **P1.3 Création ticket depuis SP** : `createIssue(title, cfg, http)` → `POST /api/v1/tickets` — créer un ticket Zammad depuis une tâche SP.
- **P1.4 Time tracking** : `issueTimeTracked` ↔ `timeSpent` via `fieldMappings` (`time_unit` Zammad).

### P2 — Observabilité
- **P2.1 Dashboard iframe** : `iFrame:true` + `index.html` avec `getTasks()` + stats Zammad (nb `new`, `pending`, `open` par `owner_id`) — UI Kit SP (`--c-primary`, `--card-bg`).
- **P2.2 Compteurs** : `SimpleCounter` (`getCounter/setCounter`) pour `nb sorties d'attente / jour` — visible dans SP.
- **P2.3 Notifications natives** : `PluginAPI.notify` avec `requireInteraction` pour escalades (`escalation_at` proche).

### P3 — Robustesse
- **P3.1 `pending close` (id 7)** : traiter comme `pending reminder` si besoin métier (support le fait, cf. ticket_states).
- **P3.2 Webhook Zammad (si infra le permet)** : endpoint local qui pousse au lieu de poll — divise latence et charge. Nécessite plugin serveur Zammad ou n8n intermédiaire.
- **P3.3 Multi-utilisateur** : config `zammadUserId` = liste, ou mode "équipe" (tous `new` non assignés).
- **P3.4 Offline queue** : si SP offline, `persistDataSynced` queue les créations et rejoue à `persistedDataChanged`.

### P4 — Intégration avancée
- **P4.1 Calendar provider** : `dueWithTime` ↔ `pending_time` pour agenda (comme `google-calendar-provider`).
- **P4.2 Automation** : `registerHook(Hooks.TASK_COMPLETE)` → auto `PATCH /tickets/:id {state: closed}` (avec consentement).
- **P4.3 `nodeExecution` (desktop only)** : avec `permissions: ["nodeExecution"]` + consent dialog, lancer `zammad-cli` ou script local — jamais en web.

Voir `ROADMAP.md` pour l'ordonnancement.
