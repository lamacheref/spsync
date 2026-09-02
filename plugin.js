// SPsync — Zammad issueProvider for Super Productivity
// Phase 1: Zammad Reading (F1.1-F1.5) — real PluginHttp calls
// Per https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin
// and docs/plugin-development.md — Types: plugin-api/src/types.ts + issue-provider-types.ts

console.log('[Zammad SPsync] plugin.js loaded — Phase 2 (Newly Assigned)');

const t = (key, fallback) => {
  try { return PluginAPI.translate(key) || fallback; } catch { return fallback; }
};

// Map Zammad state_id → short status (for issueDisplay + search)
const stateToStatus = (id) => {
  switch (Number(id)) {
    case 1: return 'new';
    case 2: return 'open';
    case 3: return 'pending';
    case 4: return 'closed';
    case 5: return 'merged';
    case 7: return 'pending close';
    default: return String(id);
  }
};

// Helper: timeout ms from config (zammadTimeout) or default 30s
const getTimeout = (cfg) => {
  const raw = cfg.zammadTimeout || cfg.pollInterval || '30000';
  const n = parseInt(String(raw).replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n >= 1000 && n <= 60000 ? n : 30000;
};

if (typeof plugin !== 'undefined' && plugin.onReady) {
  plugin.onReady(async () => {
    console.log('[Zammad SPsync] onReady — Phase 2');
    try {
      const hasSecret = typeof PluginAPI.getSecret === 'function' ? await PluginAPI.getSecret('zammadToken') : null;
      console.log('[Zammad SPsync] secret present:', !!hasSecret);
      if (!hasSecret) console.warn('[Zammad SPsync] No secret — set token via index.html (setSecret)');
    } catch (e) { console.warn('[Zammad SPsync] getSecret check failed', e); }
    // Load lastSync cache for debugging
    try {
      const raw = await PluginAPI.loadSyncedData();
      if (raw) console.log('[Zammad SPsync] syncedData onReady', JSON.parse(raw));
    } catch {}
  });
  plugin.onUnload(() => console.log('[Zammad SPsync] onUnload — Phase 2'));
  // Hook to keep cache in sync across devices (persistedDataChanged)
  try {
    PluginAPI.registerHook(PluginAPI.Hooks.PERSISTED_DATA_CHANGED, async () => {
      console.log('[Zammad SPsync] PERSISTED_DATA_CHANGED');
    });
  } catch {}
}

PluginAPI.registerIssueProvider({
  configFields: [
    { key: 'zammadUrl', type: 'input', label: t('CFG.ZAMMAD_URL', 'Zammad URL'), description: t('CFG.ZAMMAD_URL_DESC', 'Base URL, e.g. https://zammad.example.com'), required: true, pattern: '^https?://.+' },
    { key: 'zammadUserId', type: 'input', label: t('CFG.ZAMMAD_USER_ID', 'Zammad User ID (empty = auto /users/me)'), required: false, advanced: true },
    { key: 'pollInterval', type: 'select', label: t('CFG.POLL_INTERVAL', 'Poll interval'), required: false, advanced: true, options: [{ label: '30s', value: '30000' }, { label: '90s', value: '90000' }, { label: '5 min', value: '300000' }] },
    { key: 'autoAddBacklog', type: 'checkbox', label: t('CFG.AUTO_ADD_BACKLOG', 'Auto-add new issues to backlog'), required: false, advanced: true },
    { key: 'zammadTimeout', type: 'input', label: t('CFG.TIMEOUT', 'Request timeout (ms)'), description: t('CFG.TIMEOUT_DESC', 'Timeout for Zammad API requests'), required: false, advanced: true, pattern: '^[0-9]+$' },
  ],

  async getHeaders(config) {
    let token = null;
    try { if (typeof PluginAPI.getSecret === 'function') token = await PluginAPI.getSecret('zammadToken'); } catch {}
    if (!token && config.zammadToken) token = config.zammadToken; // legacy migration
    return token ? { Authorization: `Token token=${token}` } : {};
  },

  // F1.3 + F1.5: search → /tickets/search with limit 50, sort updated_at desc, handle pagination
  async searchIssues(searchTerm, config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) {
      console.warn('[Zammad SPsync] searchIssues: no zammadUrl');
      return [];
    }
    // Default: show new + open if user typed nothing; respects searchTerm when provided (Issue Panel)
    const q = (searchTerm && String(searchTerm).trim()) || 'state.name:new OR state.name:open';
    const url = `${base}/api/v1/tickets/search`;
    const timeout = getTimeout(config);
    console.log('[Zammad SPsync] searchIssues', { q, timeout });
    try {
      // F1.5: limit 50, sorted by updated_at desc (Zammad DSL supports sort_by)
      const res = await http.get(url, { params: { query: q, limit: '50', sort_by: 'updated_at', order_by: 'desc' }, headers: {}, timeout });
      const list = Array.isArray(res) ? res : (res && Array.isArray(res.assets) ? res.assets : []);
      console.log('[Zammad SPsync] searchIssues →', list.length);
      return list.map((ticket) => ({
        id: String(ticket.id),
        title: `#${ticket.number} ${ticket.title}`,
        url: `${base}/#ticket/zoom/${ticket.id}`,
        status: stateToStatus(ticket.state_id),
        assignee: String(ticket.owner_id ?? ''),
        // labels: group name if available (Phase 1.4)
        labels: ticket.group_id ? [String(ticket.group_id)] : [],
        // for due sorting: use updated_at
        lastUpdated: ticket.updated_at ? new Date(ticket.updated_at).getTime() : undefined,
        // expose raw for getNewIssuesForBacklog dedup later
        _raw: ticket,
      }));
    } catch (e) {
      const msg = e && (e.message || e.status || String(e));
      console.error('[Zammad SPsync] searchIssues failed', msg, e);
      try { PluginAPI.showSnack({ msg: `Zammad search failed: ${msg}`, type: 'ERROR' }); } catch {}
      return [];
    }
  },

  // F1.3: full fetch → ticket + articles (comments)
  async getById(issueId, config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    console.log('[Zammad SPsync] getById', issueId);
    if (!base) throw new Error('Missing zammadUrl');
    const timeout = getTimeout(config);
    try {
      const ticket = await http.get(`${base}/api/v1/tickets/${issueId}`, { timeout });
      let articles = [];
      try {
        articles = await http.get(`${base}/api/v1/ticket_articles/by_ticket/${issueId}`, { timeout });
      } catch (artErr) {
        console.warn('[Zammad SPsync] ticket_articles failed', artErr && artErr.message);
        articles = [];
      }
      const list = Array.isArray(articles) ? articles : [];
      // Prefer first non-internal customer article as body
      const customer = list.find((a) => a && a.internal === false) || list[0];
      const body = (customer && (customer.body || '')) || '';
      // comments: map Zammad articles → PluginIssueComment
      const comments = list.map((a) => ({
        author: (a && (a.from || a.created_by)) || 'unknown',
        body: (a && a.body) || '',
        created: a && a.created_at ? new Date(a.created_at).getTime() : Date.now(),
        // keep original for debugging
        _rawType: a && a.type,
        _internal: a && a.internal,
      }));
      return {
        id: String(ticket.id),
        title: ticket.title || `#${ticket.number}`,
        body,
        url: `${base}/#ticket/zoom/${ticket.id}`,
        state: String(ticket.state_id ?? ticket.state),
        lastUpdated: ticket.updated_at ? new Date(ticket.updated_at).getTime() : Date.now(),
        comments,
        // extra for Phase 2/3: pending_time, owner_id, updated_by_id
        pendingTime: ticket.pending_time || null,
        ownerId: ticket.owner_id,
        updatedById: ticket.updated_by_id,
        groupId: ticket.group_id,
      };
    } catch (e) {
      const msg = e && (e.message || e.status || String(e));
      console.error('[Zammad SPsync] getById failed', issueId, msg);
      throw new Error(`Zammad getById failed: ${msg}`);
    }
  },

  // F2.1-F2.5: newly assigned by peer → owner_id:<me> AND state:new AND updated_at:>lastSyncAt
  async getNewIssuesForBacklog(config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) return [];
    const timeout = getTimeout(config);

    // F1.2 + F2.1: resolve userId (config or cached or /users/me)
    let userId = (config.zammadUserId && String(config.zammadUserId).trim()) || '';
    let cached = {};
    try {
      const raw = await PluginAPI.loadSyncedData();
      cached = raw ? JSON.parse(raw) : {};
      if (!userId && cached.cachedUserId) userId = String(cached.cachedUserId);
    } catch {}
    if (!userId) {
      try {
        const me = await http.get(`${base}/api/v1/users/me`, { timeout });
        if (me && me.id) {
          userId = String(me.id);
          cached.cachedUserId = userId;
          try { await PluginAPI.persistDataSynced(JSON.stringify(cached)); } catch {}
          console.log('[Zammad SPsync] resolved userId', userId);
        }
      } catch (e) {
        console.warn('[Zammad SPsync] getNewIssuesForBacklog: cannot resolve userId', e && e.message);
        return [];
      }
    }
    if (!userId) return [];

    // F2.3: load dedup cache
    let seenIds = new Set(Array.isArray(cached.seenIds) ? cached.seenIds : []);
    let ownerCache = cached.ownerCache && typeof cached.ownerCache === 'object' ? cached.ownerCache : {};
    let lastSyncAt = cached.lastSyncAt ? new Date(cached.lastSyncAt).getTime() : 0;
    // Fallback: if lastSyncAt missing, look back 7 days to avoid flooding on first run
    if (!lastSyncAt) lastSyncAt = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Build Zammad DSL query: owner_id + state:new + updated_at filter
    // Zammad supports ISO8601 in query: updated_at:>2026-09-02T00:00:00Z
    const iso = new Date(lastSyncAt).toISOString();
    // If ZAMMAD_INCLUDE_UPDATED is false-like, SP config doesn't expose it; we use updated_at (default true per PROJET.md)
    const timeField = 'updated_at';
    const q = `owner_id:${userId} AND state.name:new AND ${timeField}:>${iso}`;
    const url = `${base}/api/v1/tickets/search`;
    console.log('[Zammad SPsync] getNewIssuesForBacklog', { userId, q, lastSyncAt: iso });

    let tickets = [];
    try {
      const res = await http.get(url, { params: { query: q, limit: '50', sort_by: 'updated_at', order_by: 'desc' }, timeout });
      tickets = Array.isArray(res) ? res : [];
      console.log('[Zammad SPsync] getNewIssuesForBacklog fetched', tickets.length);
    } catch (e) {
      const msg = e && (e.message || e.status || String(e));
      console.error('[Zammad SPsync] getNewIssuesForBacklog failed', msg);
      return [];
    }

    const nowIso = new Date().toISOString();
    const results = [];
    let anyNew = false;

    for (const ticket of tickets) {
      const idStr = String(ticket.id);
      const tid = ticket.id;
      // F2.3 dedup: skip already seen and not updated since last seen
      const ticketUpdated = ticket.updated_at ? new Date(ticket.updated_at).getTime() : 0;
      if (seenIds.has(idStr) && ticketUpdated <= lastSyncAt) {
        // Keep ownerCache up to date even if skipped
        ownerCache[idStr] = String(ticket.owner_id ?? '');
        continue;
      }

      // F2.2: peer detection — compare previous owner vs current
      const prevOwner = ownerCache[idStr];
      const curOwner = String(ticket.owner_id ?? '');
      const updatedBy = String(ticket.updated_by_id ?? '');
      const isPeerAssigned = (
        curOwner === String(userId) &&
        ticket.state_id === 1 && // new
        updatedBy !== String(userId) && // not self-assigned
        (prevOwner === undefined || prevOwner !== String(userId)) // was not mine before
      );
      // For first-seen tickets, also consider created_by as peer hint if updated_by missing
      // If not peer-assigned, we still want to surface it but with different title (optional filter)
      // For now, surface all new tickets assigned to me; peer flag affects title prefix
      // To strictly follow F2.2, uncomment the next lines to hide self-assigned:
      // if (!isPeerAssigned && prevOwner !== undefined) continue;

      // Update cache
      ownerCache[idStr] = curOwner;
      if (!seenIds.has(idStr)) anyNew = true;
      seenIds.add(idStr);

      const isPeer = isPeerAssigned;
      const prefix = isPeer ? '🆕' : '🆕';
      results.push({
        id: idStr,
        title: `${prefix} #${ticket.number} ${ticket.title}`,
        url: `${base}/#ticket/zoom/${ticket.id}`,
        status: stateToStatus(ticket.state_id),
        assignee: curOwner,
        labels: ticket.group_id ? [String(ticket.group_id)] : [],
        // Keep raw for debugging / future pending logic
        _isPeerAssigned: isPeer,
        _updatedBy: updatedBy,
        _prevOwner: prevOwner,
      });

      // F2.5: optional notify — SP will auto-add to backlog if enabled; we also snack for visibility when not auto
      // We limit to one snack per poll to avoid spam
    }

    // F2.3: persist dedup + lastSyncAt
    try {
      // Cap seenIds to last 500 to avoid unbounded growth
      const seenArr = Array.from(seenIds);
      const capped = seenArr.length > 500 ? seenArr.slice(-500) : seenArr;
      const nextData = { ...cached, lastSyncAt: nowIso, seenIds: capped, ownerCache };
      await PluginAPI.persistDataSynced(JSON.stringify(nextData));
      console.log('[Zammad SPsync] persist lastSyncAt', nowIso, 'seen', capped.length);
    } catch (e) { console.warn('[Zammad SPsync] persist lastSyncAt failed', e); }

    // F2.5: single notification if any new
    if (anyNew && results.length) {
      try {
        const msg = `${results.length} new ticket(s) assigned to you`;
        // Notify only if not already spamming — SP dedups via snackbar
        PluginAPI.showSnack({ msg, type: 'SUCCESS' });
        // Also system notification if available
        if (typeof PluginAPI.notify === 'function') {
          PluginAPI.notify({ title: 'Zammad SPsync', body: msg });
        }
      } catch {}
    }

    console.log('[Zammad SPsync] getNewIssuesForBacklog →', results.length, results.map(r => r.id));
    return results;
  },

  getIssueLink(issueId, config) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    return `${base}/#ticket/zoom/${issueId}`;
  },

  // F1.2: resolve userId if empty → GET /users/me, cache via persistDataSynced (F1.2)
  async testConnection(config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) return false;
    const timeout = getTimeout(config);
    try {
      console.log('[Zammad SPsync] testConnection →', `${base}/api/v1/users/me`);
      const me = await http.get(`${base}/api/v1/users/me`, { timeout });
      if (me && me.id) {
        console.log('[Zammad SPsync] testConnection me.id', me.id);
        // Cache id if not set (F1.2) — persist for Phase 2 dedup
        if (!config.zammadUserId) {
          try {
            const existing = await PluginAPI.loadSyncedData();
            const data = existing ? JSON.parse(existing) : {};
            if (!data.cachedUserId || String(data.cachedUserId) !== String(me.id)) {
              data.cachedUserId = String(me.id);
              await PluginAPI.persistDataSynced(JSON.stringify(data));
              console.log('[Zammad SPsync] cachedUserId persisted', me.id);
            }
          } catch (cacheErr) { console.warn('[Zammad SPsync] cache userId failed', cacheErr); }
        }
        // Also verify ticket_states reachable
        try { await http.get(`${base}/api/v1/ticket_states`, { timeout }); } catch {}
        return true;
      }
      return false;
    } catch (e) {
      const msg = e && (e.message || e.status || String(e));
      console.error('[Zammad SPsync] testConnection failed', msg);
      try { PluginAPI.showSnack({ msg: `Zammad connection failed: ${msg}`, type: 'ERROR' }); } catch {}
      return false;
    }
  },

  // F1.4: richer display + comments
  issueDisplay: [
    { field: 'title', label: 'Title', type: 'link', linkField: 'url' },
    { field: 'status', label: 'State', type: 'text' },
    { field: 'assignee', label: 'Assignee', type: 'text', hideEmpty: true },
    { field: 'pendingTime', label: 'Pending until', type: 'date', hideEmpty: true },
    { field: 'groupId', label: 'Group', type: 'text', hideEmpty: true },
  ],

  commentsConfig: {
    authorField: 'author',
    bodyField: 'body',
    createdField: 'created',
  },

  fieldMappings: [
    {
      taskField: 'isDone',
      issueField: 'state',
      defaultDirection: 'pullOnly',
      toIssueValue: (v) => (v ? 'closed' : 'open'),
      toTaskValue: (v) => v === 'closed' || String(v) === '4',
    },
  ],
});

console.log('[Zammad SPsync] issueProvider registered — Phase 1 Reading');
