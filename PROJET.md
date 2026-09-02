# SPsync

## Objectifs



Créer un connecteur permettant de créer les tâches dans Super-productivity grace à la REST API ( http://127.0.0.1:3876 ) et le token URw8qzHTXD0J27bwOltuls7DpTOCyCR8

-> Permettre de retrouver dans des sous-tâches les fichiers qui viennent de sortir d'attente,
-> Permettre de retrouver les fichiers qui me sont affectés par des collègues et qui sont en état "nouveau",

Ces deux fonctions sont nécessaire dans un premier temps.

## Analyse — Validation faisabilité (2026-09-02)

> Tests exécutés en live le 2026-09-02 depuis ce poste. Aucun code métier n'a été écrit.

### 1. Validation accès Zammad

| Paramètre | Valeur testée | Résultat |
|---|---|---|
| `ZAMMAD_URL` | `https://zammad.smiden.eu` | ✅ 200 OK, `GET /api/v1/users/me` répond |
| `ZAMMAD_TOKEN` | `IoL1Esqh...Rgoz2kL` | ✅ Token valide, type `Token token=...` (header `Authorization: Token token=...`) |
| `ZAMMAD_USER_ID` | (vide dans config) | ✅ Déduit = `3` via `/api/v1/users/me` → `fabrice.lamachere@smiden.fr` (Fabrice Lamachère, id=3, org=2, dept PTI) |
| `ZAMMAD_TIMEOUT` | `30` | ✅ Pertinent, latence mesurée ~56ms (`x-runtime: 0.056`) |
| `ZAMMAD_INCLUDE_UPDATED` | `true` | ✅ Supporté : `GET /api/v1/tickets/search?query=updated_at:>...` fonctionne |

**Preuves:**
- `GET /api/v1/users/me` → `HTTP 200`, `id:3`, `role_ids:[1,2,3]`, `group_ids:{1:["full"],2:["full"],3:["full"]}`. Source: `spsync/PROJET.md:19`.
- `GET /api/v1/ticket_states` → 6 états actifs : `new(1), open(2), pending reminder(3), closed(4), merged(5), pending close(7)`.
- `GET /api/v1/groups` → 3 groupes dont Techniciens (id 3).
- `GET /api/v1/tickets/search?query=state.name:new` → ✅ retourne 3 tickets (ex: #6605 "câble PC-vidéoprojecteur").
- `GET /api/v1/tickets/search?query=state.name:"pending reminder"` → ✅ retourne tickets avec `pending_time: "2026-09-08T22:12:00.000Z"` et `state_id:3`.
- `GET /api/v1/tickets/search?query=owner_id:3 AND state.name:new` → ✅ `[]` (aucun ticket nouveau actuellement affecté à Fabrice — comportement normal, la requête DSL est valide).
- `GET /api/v1/tickets/search?query=owner_id:3` → ✅ 2+ tickets (ex: #6598 owner_id 3, state open).
- `GET /api/v1/ticket_overviews` n'existe pas, mais `GET /api/v1/overviews` existe (200 sans auth token header mal formé ; nécessite même token).
- `GET /api/v1/tickets/:id/history` → `404 This page doesn't exist` — endpoint non exposé en API REST publique. Historique à déduire via `updated_at` + `article_ids` / `ticket_articles`.

**Points d'attention Zammad:**
- Zammad n'a pas de webhook natif côté client sans plugin serveur ; polling obligatoire. `ZAMMAD_INCLUDE_UPDATED=true` impose de stocker `lastSyncAt` et interroger `updated_at:>lastSyncAt` (ou `GET /api/v1/tickets/search` avec `sort_by:updated_at`).
- Pas d'endpoint `history` public → détection "sortie d'attente" = comparer `state_id` précédent (cache local) vs `state_id` courant, OU requête `pending_time` passé + `state:open` + `updated_at` récent. Le `updated_by_id:1` (système) sur les `pending reminder` indique que la mise à jour est faite par Zammad lui-même (scheduler).
- Rate-limit non observé, mais limiter le polling (ex: 60-120s, `limit` + pagination `per_page`).
- `ZAMMAD_USER_ID` doit être renseigné à `3` dans la config finale (ou auto-résolu via `/users/me`).

### 2. Validation Super Productivity Local REST API

| Paramètre | Valeur | Résultat |
|---|---|---|
| Host:Port | `127.0.0.1:3876` | ✅ Electron écoute (`electron` pid 10668) |
| Token | `URw8qzHTXD0J27bwOltuls7DpTOCyCR8` | ✅ Fichier `~/.config/superProductivity/local-rest-api-token` contient exactement ce token (mode 0600, validé par `local-rest-api.js:58-119`) ; `GET /status` avec `Authorization: Bearer <token>` → `200 {ok:true}` |
| Auth scheme | `Bearer` | ✅ Case-insensitive, timingSafeEqual (cf. `local-rest-api.js:261-332`) |
| `GET /health` | sans auth | ✅ `{server:"up", rendererReady:true}` |
| `GET /status` | Bearer | ✅ `{currentTask, taskCount:200}` |
| `GET /tasks?includeDone=false` | Bearer | ✅ 200 tasks retournées |
| `POST /tasks` + `DELETE /tasks/:id` | Bearer | ✅ Création/suppression validée (test task `uVrM_OMjcWg...` créé puis supprimé, dueDay auto = today) |
| `GET /projects` / `GET /tags` | Bearer | ✅ Projets et tags listés |

**Routes réelles découvertes par reverse du `app.asar` (2026-09-02, `/electron/local-rest-api.js:455-532` + renderer `chunk-*.js` → service `FR`):**
```
GET    /status
GET    /health                          (no auth, rendererReady flag)
GET    /task-control/current
POST   /task-control/current  {taskId | null}
POST   /task-control/stop
GET    /tasks?query=&projectId=&tagId=&includeDone=&source=active|archived|all
POST   /tasks                 {title, notes, isDone, timeEstimate, projectId, tagIds, dueDay, dueWithTime, plannedAt}
GET    /tasks/:id
PATCH  /tasks/:id            {WritableTaskFields}  (parentId/subTaskIds interdits)
DELETE /tasks/:id
POST   /tasks/:id/start
POST   /tasks/:id/archive
POST   /tasks/:id/restore
GET    /projects?query=
GET    /tags?query=
```
Contraintes : `max 50 requêtes concurrentes`, `max body 1 MiB`, `timeout renderer 15s` (`local-rest-api.model.js:6-8`). Host header strict (`127.0.0.1:3876` / `localhost:3876`), rejet `Origin` web (anti-CSRF).

**Feasabilité SP pour les 2 use-cases:**
- Créer une tâche mère par ticket Zammad (ex: projet `ZAMMAD_INBOX` ou projet dédié) → `POST /tasks`.
- Ajouter les 2 cas en **sous-tâches** du ticket parent → `POST /tasks {parentId: <taskIdParent>}`. Vérifié dans le code : `addSubTaskTo(parentId, {title})` hérite `projectId/tagIds` du parent, interdit `projectId/tagIds` explicites (erreur `UNSUPPORTED_FIELD`). Les sous-tâches ne peuvent pas être imbriquées (1 niveau max).

### 3. Mapping fonctionnel des 2 besoins

#### A) "Fichiers qui viennent de sortir d'attente" → sous-tâches sous ticket parent
- **Définition Zammad:** ticket `state: pending reminder` + `pending_time <= now()` → transition automatique vers `open` (state 2) par le scheduler Zammad (champ `updated_by_id:1`, `updated_at` bump).
- **Détection fiable:** polling `GET /api/v1/tickets/search?query=state.name:open AND updated_at:>lastSyncAt` puis filtrer ceux dont `previous_state == pending reminder` (cache local `ticketId → state_id`). Fallback sans cache : heuristic `pending_time IS NULL` + `state_id:2` + `updated_at` récent + précédent `pending reminder` trouvé dans `article_ids` de type note système. Le champ `pending_time` passe à `null` après sortie d'attente.
- **Action SP:** pour chaque ticket détecté, créer/mettre à jour tâche SP parente `Zammad #<number> - <title>` puis ajouter sous-tâche `"🔔 Sorti d'attente — <date> — <url>"`. Idempotence via clé `zammad:<ticketId>:pending:<pending_time>` stockée en `notes` ou tag.
- **Limite testée:** `GET /api/v1/ticket_states` confirme `pending reminder` = id 3 ; `pending close` = id 7 (à ignorer pour ce cas).

#### B) "Fichiers qui me sont affectés par des collègues et qui sont en état `nouveau`" 
- **Définition Zammad:** `owner_id = ZAMMAD_USER_ID (3)` AND `state.name:new` (state_id 1) AND `updated_at` récent OU `created_at` récent si `ZAMMAD_INCLUDE_UPDATED=false`.
- **Requête validée:** `GET /api/v1/tickets/search?query=owner_id:3%20AND%20state.name:new` → syntaxe DSL Zammad `AND` supportée, retour `[]` actuellement = pas de ticket dans cet état (normal), alors que `owner_id:3` seul retourne des tickets `open`.
- **Action SP:** polling `updated_at:>lastSyncAt` + filtre `owner_id:3` + `state_id:1` → créer tâche SP ou sous-tâche sous projet "Nouveaux affectés".
- **Événement "affecté par un collègue":** détecter `owner_id` passe de `!=3` à `3` OU `owner_id:3 && updated_by_id !=3 && state:new`. Nécessite cache `owner_id` précédent.

### 4. Architecture proposée (sans dev)

```
[Zammad] --poll 60s--> [spsync daemon] --Bearer--> [SP Local REST API 127.0.0.1:3876]
                           | stocke lastSyncAt + cache ticket states (json/shelve)
                           +-- dedup via SP notes/tag
```
- Type : daemon Python (ou Node) léger, interval configurable, `ZAMMAD_TIMEOUT=30`.
- Config via `.env` ou `config.json` reprenant le bloc `Plugin Zammad`.
- Idempotence obligatoire : SP n'a pas d'upsert par externalId → vérifier existence via `GET /tasks?query=Zammad #<number>` ou stocker mapping `zammadId → spTaskId` en fichier local.
- Gestion `ZAMMAD_INCLUDE_UPDATED`: si `true` → `query=updated_at:>ISO8601` ; sinon `query=created_at:>...` ou full scan `state:new`.

### 5. Risques & prérequis

- **Risque 1 — SP doit être lancé** : `GET /health` → `rendererReady:true` requis, sinon `503 APP_NOT_READY`. Le daemon doit retry/backoff.
- **Risque 2 — SP sous-tâches = 1 niveau** : impossible de faire sous-sous-tâches. Contrôler `parentId` et `subTaskIds`.
- **Risque 3 — Zammad polling vs webhook** : polling = charge + latence. Interval conseillé 90-120s.
- **Risque 4 — Token SP rotation** : `local-rest-api-token` (0600) peut être régénéré depuis Settings → Misc → Regenerate. Prévoir lecture fichier ou var d'env.
- **Prérequis** : renseigner `ZAMMAD_USER_ID=3` ; créer projet SP dédié (ex: `Zammad`) ou utiliser `INBOX_PROJECT`.

### 6. Configuration finale recommandée

```ini
ZAMMAD_URL=https://zammad.smiden.eu
ZAMMAD_TOKEN=IoL1Esqh1084U1dMIYsQlcMj80RUdn8BMF-KFljb0cXyZbA5s7gcULyDfRgoz2kL
ZAMMAD_USER_ID=3  # auto-résolu via /api/v1/users/me = fabrice.lamachere@smiden.fr
ZAMMAD_TIMEOUT=30
ZAMMAD_INCLUDE_UPDATED=true

SP_URL=http://127.0.0.1:3876
SP_TOKEN=URw8qzHTXD0J27bwOltuls7DpTOCyCR8
SP_PROJECT_ID=INBOX_PROJECT  # ou id projet dédié Zammad
SP_POLL_INTERVAL=90
```

### 7. TODO (exportable → TODO.md)

Voir `TODO.md`.

### 8. ROADMAP (exportable → ROADMAP.md)

Voir `ROADMAP.md`.

> **Conclusion faisabilité : ✅ FAISABLE.** Les deux APIs sont accessibles, authentifiées et testées avec succès depuis ce poste. Aucun développement bloquant identifié. Les deux use-cases sont réalisables avec polling + cache d'état.

---

## Analyse — Session Plugin Super Productivity (2026-09-02 complément)

> Question ajoutée le 2026-09-02 : *peut-on rendre spsync comme un plugin SP plutôt que comme un daemon externe via Local REST API ?* Analyse basée sur reverse du `app.asar` (`/tmp/sp-extract`) + `docs/plugin-development.md` + `packages/plugin-api/src/types.ts` + manifests des 17 bundled-plugins.

### 1. Synthèse : 2 voies possibles

| Critère | **Voie A — Daemon externe** (déjà analysée) | **Voie B — Plugin SP natif** |
|---|---|---|
| Processus | Processus séparé (Python/Node) qui poll Zammad et pousse via `http://127.0.0.1:3876` | Code JS qui tourne **dans** SP (renderer Electron / Web), pas de processus externe |
| Dépendance SP lancé | Oui, doit être lancé sinon `503 APP_NOT_READY` | Non — plugin vit tant que l'app vit |
| Auth SP | `Bearer` + fichier `~/.config/superProductivity/local-rest-api-token` (0600) | Aucune — `PluginAPI.addTask()` / `PluginAPI.getTasks()` direct, sans token |
| Réseau Zammad | `requests` / `fetch` natif du daemon | `PluginAPI.request()` (bridge HTTP filtré) OU `http` helper de l'issueProvider |
| Config | `.env` hors SP | `manifest.json` + `config-schema.json` / `configFields` intégré aux Settings → Plugins |
| Sync multi-device | Mapping fichier local non synché | `persistDataSynced` synché via le backend de sync SP (Dropbox/WebDAV/etc) si l'utilisateur l'active |
| Maintenance | Service systemd/pm2 externe | Install ZIP via Settings → Plugins, auto-update avec l'app |
| Isolation | Totale | **Aucune sandbox forte** — `plugin.js` tourne via `new Function` dans le renderer, `iframe` = `allow-same-origin` (cf. `plugin-development.md:Security`) — ne jamais installer de plugin non audité |

**Verdict : les deux voies sont faisables. Le plugin est plus élégant/maintenable pour un usage "tout dans SP". Le daemon reste pertinent si on veut une automatisation hors SP (cron serveur, headless). Recommandation : développer en plugin et garder le daemon comme fallback/architecture alternative.**

### 2. Types de plugin exploitables pour spsync

Super Productivity connaît 2 types (`PluginManifest.type`):

- `type: "standard"` (défaut) : plugin générique avec `plugin.js` (host) et/ou `index.html` (iframe). API : `getTasks`, `addTask`, `updateTask`, `getAllProjects`, `showSnack`, `persistDataSynced`, `request` (si `permissions: ["http"]` + `allowedHosts`).
- `type: "issueProvider"` : plugin métier qui s'intègre au **Issue Panel** (même UX que GitHub/Jira/ClickUp). Manifest additionnel `issueProvider: { pollIntervalMs, icon, humanReadableName, issueProviderKey }`. Définition JS `PluginAPI.registerIssueProvider({ configFields, getHeaders, searchIssues, getById, getNewIssuesForBacklog, ... })`. C'est la voie native pour "tickets externes → tâches SP" — c'est exactement le pattern GitHub (`github-issue-provider/plugin.js:1`) validé sur `spsync`.

**Pour spsync, `issueProvider` est le choix idiomatique :** il donne gratuitement la recherche, l'import backlog, le panneau d'issues, la synchro `isDone ↔ state`, les commentaires (articles Zammad), sans recoder l'UI. Un plugin `standard` reste possible si on veut créer des sous-tâches avec logique custom (ex: "sorti d'attente" → sous-tâche sous tâche mère), mais on peut aussi le faire en `issueProvider` via `fieldMappings` + hook `taskUpdate`.

### 3. Faisabilité détaillée

#### 3.1 Plugin `standard` (JS + iframe optionnel)

- **Manifest minimal (`manifest.json:5`):**
  ```json
  {
    "id": "zammad-spsync",
    "name": "Zammad SPsync",
    "version": "0.1.0",
    "manifestVersion": 1,
    "minSupVersion": "14.0.2",
    "description": "Sync Zammad tickets sortis d'attente + nouveaux affectés",
    "permissions": ["getTasks","addTask","updateTask","getAllProjects","getAllTags","showSnack","notify","persistDataSynced","loadSyncedData","http"],
    "allowedHosts": ["zammad.smiden.eu"],
    "hooks": ["taskUpdate","taskDelete","persistedDataChanged"],
    "iFrame": true,
    "jsonSchemaCfg": "config-schema.json"
  }
  ```
- **Permissions `http` + `allowedHosts: ["zammad.smiden.eu"]` obligatoires** pour que `PluginAPI.request()` sorte vers Zammad (`plugin-development.md:allowedHosts`). Sans les deux, `request` est bloqué (`PluginHttp: not in allowedHosts`). Vérifié dans `chunk-FWXJDZFW.js:PluginAPI.request`.
- **Polling :** `setInterval` dans `plugin.js` (host) ou dans l'iframe. Le host est préféré car il tourne même si l'iframe n'est pas visible. Utiliser `plugin.onReady()` pour attendre le bridge (`plugin-development.md:Node.js Script Execution`). Nettoyer avec `plugin.onUnload(() => clearInterval(...))` (`plugin-development.md:onUnload`).
- **HTTP :** `await PluginAPI.request({url: ZAMMAD_URL+"/api/v1/tickets/search?q=...", method: "GET", headers: {Authorization: "Token token="+token}})`. Alternative `fetch` direct possible mais passe par `PluginHttpService` qui enforce `allowedHosts` + bloque les redirects.
- **Tâches :** `await PluginAPI.addTask({title: "Zammad #"+number+" - "+title, notes: url, projectId, tagIds})` ; sous-tâche = `await PluginAPI.addTask({title: "🔔 Sorti d'attente", parentId: parentId})` (le plugin hérite du parent, comme le daemon).
- **Persistance :** `await PluginAPI.persistDataSynced(JSON.stringify({lastSyncAt, cache}))` + hook `persistedDataChanged` pour resync inter-device. `localStorage` possible en host mais non synché.
- **Limite :** `PluginAPI` iframe n'expose pas `registerHeaderButton`/`registerShortcut` — les mettre en `plugin.js`.

#### 3.2 Plugin `issueProvider` (recommandé)

- **Manifest :**
  ```json
  {
    "id": "zammad-issue-provider",
    "name": "Zammad",
    "version": "0.1.0",
    "manifestVersion": 1,
    "minSupVersion": "14.0.2",
    "type": "issueProvider",
    "issueProvider": {
      "pollIntervalMs": 90000,
      "icon": "support",
      "humanReadableName": "Zammad",
      "issueProviderKey": "ZAMMAD",
      "defaultAutoAddToBacklog": false
    },
    "permissions": [],
    "hooks": []
  }
  ```
  Note : `issueProvider` n'a pas besoin de `permissions: ["http"]` ni `allowedHosts` — le `PluginHttp` passé à `searchIssues`/`getById` est pré-autorisé pour l'host déclaré dans la définition (voir `issue-provider-types.ts:PluginHttp`).
- **Définition (`plugin.js`):**
  ```js
  PluginAPI.registerIssueProvider({
    configFields: [
      {key: "zammadUrl", type: "input", label: "Zammad URL", required: true},
      {key: "zammadToken", type: "password", label: "Token Zammad", required: true},
      {key: "zammadUserId", type: "input", label: "User ID (vide = /users/me)", required: false, advanced: true},
      {key: "pollInterval", type: "select", label: "Poll interval", options: [{label:"90s",value:"90000"}], advanced: true}
    ],
    getHeaders: async (cfg) => ({Authorization: "Token token="+cfg.zammadToken}),
    searchIssues: async (searchTerm, cfg, http) => {
      // searchTerm = ce que l'utilisateur tape dans le champ Issues
      // + polling interne getNewIssuesForBacklog
      const q = searchTerm || "state.name:new OR state.name:open";
      const res = await http.get(`${cfg.zammadUrl}/api/v1/tickets/search`, {params: {query: q, limit:"20"}});
      return res.map(t => ({id: String(t.id), title: `#${t.number} ${t.title}`, url: `${cfg.zammadUrl}/#ticket/zoom/${t.id}`, status: t.state_id===1?"new":t.state_id===2?"open":"pending", assignee: String(t.owner_id)}));
    },
    getById: async (id, cfg, http) => {
      const t = await http.get(`${cfg.zammadUrl}/api/v1/tickets/${id}`);
      const arts = await http.get(`${cfg.zammadUrl}/api/v1/ticket_articles/by_ticket/${id}`);
      return {id: String(t.id), title: t.title, body: arts[0]?.body, url: `${cfg.zammadUrl}/#ticket/zoom/${id}`, state: String(t.state_id), lastUpdated: new Date(t.updated_at).getTime(), comments: arts.map(a=>({author:a.from, body:a.body, created: new Date(a.created_at).getTime()}))};
    },
    getNewIssuesForBacklog: async (cfg, http) => { /* même logique que searchIssues mais avec owner_id:3 AND state:new + pending→open */ },
    issueDisplay: [{field:"summary",label:"Titre",type:"link",linkField:"url"},{field:"state",label:"État"},{field:"assignee",label:"Assigné"}],
    fieldMappings: [{taskField:"isDone",issueField:"state",defaultDirection:"pullOnly", toIssueValue: v=>v?"closed":"open", toTaskValue: v=>v==="closed"}]
  });
  ```
  Mapping validé sur `github-issue-provider/plugin.js:1` (configFields, getHeaders, searchIssues, getById, testConnection, getNewIssuesForBacklog, issueDisplay, fieldMappings).
- **Mapping Zammad → `PluginSearchResult` / `PluginIssue`:**
  - `id` = `ticket.id` (string)
  - `title` = `#${number} ${title}` (comme GitHub `#123 title`)
  - `url` = `${ZAMMAD_URL}/#ticket/zoom/${id}`
  - `status` = `new|open|pending reminder|closed` via `state_id`
  - `assignee` = `owner_id`
  - `labels` = `group.name` ou `tags` Zammad si exposés
  - `lastUpdated` = `new Date(updated_at).getTime()` — utilisé par SP pour détecter les updates (`issueWasUpdated`)
  - `comments` = `ticket_articles` (filtrer `internal:false` pour le client)
- **Polling :** géré par SP lui-même via `pollIntervalMs` (90s recommandé vs 600s GitHub par défaut). Pas de `setInterval` manuel.
- **Sous-tâches "sorti d'attente" :** avec `issueProvider`, chaque ticket = une tâche. Pour créer les sous-tâches demandées, deux options :
  1. Hook `taskUpdate` + `PluginAPI.addTask({parentId})` depuis `plugin.js` (plugin hybride : `type: issueProvider` + `permissions: ["addTask","getTasks"]` + `hooks`). Vérifié que `hooks` coexiste avec `issueProvider`.
  2. Ou traiter "sorti d'attente" comme un `PluginSearchResult` distinct (ex: ticket réouvert = nouvel issue) et laisser l'utilisateur l'importer.

### 4. Sécurité & secrets

- **Token Zammad** : ne jamais le mettre en `configFields` text si on veut qu'il soit synché — il partirait dans `persistDataSynced` / export. Le mettre en `type: "password"` reste **synché** (même risque). La bonne pratique est `PluginAPI.setSecret("zammadToken", token)` / `getSecret` (stockage **local-only, jamais synché, jamais exporté**, supprimé à l'uninstall) — cf. `plugin-development.md:Secret Storage`. L'`issueProvider` peut lire `getSecret` dans `getHeaders` (async) : `const token = await PluginAPI.getSecret("zammadToken")`.
- **Host-side `plugin.js` non sandboxé** (`new Function`) + iframe `allow-same-origin` — le plugin peut lire `window.parent.ea` — ce n'est pas une barrière de sécurité (`plugin-development.md:Security Considerations`). Ne pas distribuer sans audit.

### 5. Comparatif final & recommandation

| Besoin | Daemon + Local REST API | Plugin `standard` | Plugin `issueProvider` (reco) |
|---|---|---|---|
| Créer tâches / sous-tâches custom | ✅ | ✅ | ✅ (via hook additionnel) |
| Panneau Issues natif, recherche, backlog auto-import | ❌ | ❌ | ✅ |
| Besoin token SP | Oui | Non | Non |
| Besoin SP lancé | Oui (Electron) | Non (tourne dans SP) | Non |
| Config dans SP | Non | Oui (`config-schema.json`) | Oui (`configFields`) |
| Sync config multi-device | Non | Oui (`persistDataSynced`) | Oui (config synchée SAUF secrets) |
| Effort dev | Faible (script externe) | Moyen | Moyen-faible (s'appuie sur le framework issue) |

**Recommandation :**
1. **Cible principale = Plugin `issueProvider` "Zammad"** (90s poll, `zammad.smiden.eu` en `allowedHosts` si besoin, `getNewIssuesForBacklog` implémente les 2 filtres : `owner_id:3 AND state:new` + `pending reminder→open`). Ajouter un `plugin.js` léger pour créer les sous-tâches "🔔 Sorti d'attente" via `addTask({parentId})`.
2. **Garder le daemon comme plan B** si besoin headless/serveur ou si l'équipe refuse les plugins (install manuelle ZIP via Settings → Plugins → Choose Plugin File).

### 6. TODO plugin (à ajouter à `TODO.md`)

- [ ] Choisir voie : `issueProvider` (reco) vs `standard` vs daemon — valider avec l'équipe
- [ ] Scaffolder le plugin (`manifest.json`, `plugin.js`, `icon.svg`, `config-schema.json` pour standard OU `registerIssueProvider` pour issueProvider)
- [ ] Déclarer `allowedHosts: ["zammad.smiden.eu"]` + `permissions: ["http", ...]` si `standard` ; rien si `issueProvider`
- [ ] Implémenter `getHeaders` + stockage secret `setSecret`/`getSecret` pour le token
- [ ] Implémenter `searchIssues` / `getById` / `getNewIssuesForBacklog` avec les 2 requêtes Zammad validées (`state:new`, `pending reminder`, `owner_id:3`)
- [ ] Tester ZIP en local (Settings → Plugins → Choose Plugin File, DevTools F12)
- [ ] Gérer `lastSyncAt` via `persistDataSynced` + `persistedDataChanged` hook
- [ ] (Optionnel) Hook `taskUpdate` pour générer les sous-tâches "sorti d'attente"

### 7. Références

- `docs/plugin-development.md` (guide complet, types `packages/plugin-api/src/types.ts`, exemples `yesterday-tasks-plugin`, `api-test-plugin`, `boilerplate-solid-js`)
- `packages/plugin-api/src/issue-provider-types.ts:PluginHttp`, `IssueProviderPluginDefinition`, `IssueProviderManifestConfig`
- `github-issue-provider/plugin.js`, `todoist-import/manifest.json:22` (`allowedHosts`), `api-test-plugin/manifest.json:14` (`permissions` + `jsonSchemaCfg`)
- Cette session complète la §1-8 du daemon sans les remplacer — les deux architectures peuvent coexister.


