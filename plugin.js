// SPsync — Zammad issueProvider for Super Productivity
// Phase 1: Zammad Reading (F1.1-F1.5) — real PluginHttp calls
// Per https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin
// and docs/plugin-development.md — Types: plugin-api/src/types.ts + issue-provider-types.ts

console.log('[Zammad SPsync] plugin.js loaded — Phase 2 (Newly Assigned)');

const t = (key, fallback) => {
  try {
    const v = PluginAPI.translate(key);
    // PluginAPI.translate returns the key itself when missing — fallback to English
    return v && v !== key ? v : fallback;
  } catch { return fallback; }
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

// Helper: resolve login/email (or legacy numeric id) to numeric id via /users/search or /users/me
const resolveZammadUser = async (config, http, base, timeout, cached) => {
  // New field zammadUser (login or email) takes precedence, fallback to legacy zammadUserId
  const rawInput = (config.zammadUser && String(config.zammadUser).trim()) || (config.zammadUserId && String(config.zammadUserId).trim()) || '';
  if (rawInput && /^\d+$/.test(rawInput)) {
    // numeric ID directly
    return String(rawInput);
  }
  if (rawInput) {
    // login or email → search
    const field = rawInput.includes('@') ? 'email' : 'login';
    try {
      const res = await http.get(`${base}/api/v1/users/search`, { params: { query: `${field}:${rawInput}` }, timeout });
      const list = Array.isArray(res) ? res : [];
      if (list.length > 0 && list[0].id) {
        const id = String(list[0].id);
        console.log('[Zammad SPsync] resolveZammadUser', rawInput, '→', id);
        return id;
      }
      // try opposite field if not found
      const altField = field === 'email' ? 'login' : 'email';
      try {
        const res2 = await http.get(`${base}/api/v1/users/search`, { params: { query: `${altField}:${rawInput}` }, timeout });
        const list2 = Array.isArray(res2) ? res2 : [];
        if (list2.length > 0 && list2[0].id) return String(list2[0].id);
      } catch {}
    } catch (e) {
      console.warn('[Zammad SPsync] resolveZammadUser search failed', e && e.message);
    }
    // fallback: if we couldn't resolve, return rawInput to try direct query like owner.email:xxx
    // But for dedup we need numeric id, so we try to still use it as is for query
    // Return rawInput prefixed to indicate direct login/email query
    return `__login:${rawInput}`;
  }
  // empty → auto via /users/me (cached)
  if (cached && cached.cachedUserId) return String(cached.cachedUserId);
  try {
    const me = await http.get(`${base}/api/v1/users/me`, { timeout });
    if (me && me.id) {
      const id = String(me.id);
      cached.cachedUserId = id;
      try { await PluginAPI.persistDataSynced(JSON.stringify(cached)); } catch {}
      console.log('[Zammad SPsync] resolveZammadUser via /users/me →', id);
      return id;
    }
  } catch {}
  return '';
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
    { key: 'zammadUrl', type: 'input', label: 'Zammad URL', description: 'Base URL, e.g. https://zammad.example.com', required: true, pattern: '^https?://.+' },
    { key: 'zammadToken', type: 'password', label: 'Zammad Token', description: 'API token (Token token=…) — stored local-only, also settable in Debug panel', required: true },
    { key: 'zammadUser', type: 'input', label: 'Zammad login or email', description: 'Login or email (e.g. nehwonlm@example.com) — empty = auto /users/me', required: false, placeholder: 'login or email' },
    { key: 'zammadUserId', type: 'input', label: 'Zammad User ID (legacy)', description: 'Legacy numeric ID — prefer login/email above', required: false, advanced: true },
    { key: 'pollInterval', type: 'select', label: 'Poll interval', required: false, advanced: true, options: [{ label: '30s', value: '30000' }, { label: '90s', value: '90000' }, { label: '5 min', value: '300000' }] },
    { key: 'autoAddBacklog', type: 'checkbox', label: 'Auto-add new issues to backlog', required: false, advanced: true },
    { key: 'zammadTimeout', type: 'input', label: 'Request timeout (ms)', description: 'Timeout for Zammad API requests', required: false, advanced: true, pattern: '^[0-9]+$' },
  ],

  async getHeaders(config) {
    let token = null;
    try { if (typeof PluginAPI.getSecret === 'function') token = await PluginAPI.getSecret('zammadToken'); } catch {}
    if (!token && config.zammadToken) {
      token = String(config.zammadToken).trim();
      // Migrate config token to local-only secret (so it doesn't stay synced)
      if (token) {
        try {
          await PluginAPI.setSecret('zammadToken', token);
          console.log('[Zammad SPsync] migrated zammadToken from config to secret');
        } catch {}
      }
    }
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

  // F2.1-F2.5: newly assigned by peer → owner.login/email:<me> AND state:new AND updated_at:>lastSyncAt
  async getNewIssuesForBacklog(config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) return [];
    const timeout = getTimeout(config);

    // Resolve login/email or legacy id → numeric id (placeholder <ZAMMAD_USER> → real login, see .cred)
    let cached = {};
    try {
      const raw = await PluginAPI.loadSyncedData();
      cached = raw ? JSON.parse(raw) : {};
    } catch {}
    let userId = await resolveZammadUser(config, http, base, timeout, cached);
    if (!userId) {
      console.warn('[Zammad SPsync] getNewIssuesForBacklog: cannot resolve user');
      return [];
    }
    // If resolve returned __login:xxx (search failed), use direct owner.email/login query
    let useDirectLoginQuery = false;
    let directLogin = '';
    if (String(userId).startsWith('__login:')) {
      directLogin = String(userId).slice(8);
      useDirectLoginQuery = true;
      console.log('[Zammad SPsync] using direct login/email query', directLogin);
    }

    // F2.3: load dedup cache
    let seenIds = new Set(Array.isArray(cached.seenIds) ? cached.seenIds : []);
    let ownerCache = cached.ownerCache && typeof cached.ownerCache === 'object' ? cached.ownerCache : {};
    let lastSyncAt = cached.lastSyncAt ? new Date(cached.lastSyncAt).getTime() : 0;
    // Fallback: if lastSyncAt missing, look back 7 days to avoid flooding on first run
    if (!lastSyncAt) lastSyncAt = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Build Zammad DSL query: prefer login/email field per user request (<ZAMMAD_USER>), fallback to owner_id
    const iso = new Date(lastSyncAt).toISOString();
    const timeField = 'updated_at';
    let q;
    if (useDirectLoginQuery) {
      const field = directLogin.includes('@') ? 'owner.email' : 'owner.login';
      q = `${field}:${directLogin} AND state.name:new AND ${timeField}:>${iso}`;
    } else {
      q = `owner_id:${userId} AND state.name:new AND ${timeField}:>${iso}`;
    }
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

      // F2.2: peer detection — compare previous owner vs current (supports login/email placeholder <ZAMMAD_USER>)
      const prevOwner = ownerCache[idStr];
      const curOwner = String(ticket.owner_id ?? '');
      const updatedBy = String(ticket.updated_by_id ?? '');
      // For direct login query, effectiveUserId is the ticket's current owner (since we filtered by login)
      const effectiveUserId = useDirectLoginQuery ? curOwner : String(userId);
      const isPeerAssigned = (
        curOwner === effectiveUserId &&
        ticket.state_id === 1 && // new
        updatedBy !== effectiveUserId && // not self-assigned
        (prevOwner === undefined || prevOwner !== effectiveUserId) // was not mine before
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

  // F1.2: resolve user (login/email <ZAMMAD_USER> or legacy id) → GET /users/me or /users/search, cache via persistDataSynced
  async testConnection(config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) {
      try { PluginAPI.showSnack({ msg: 'Zammad URL missing', type: 'ERROR' }); } catch {}
      return false;
    }
    // Check token is present (via secret or config password field)
    let token = null;
    try { if (typeof PluginAPI.getSecret === 'function') token = await PluginAPI.getSecret('zammadToken'); } catch {}
    if (!token && config.zammadToken) token = String(config.zammadToken).trim();
    if (!token) {
      console.warn('[Zammad SPsync] testConnection: no token');
      try { PluginAPI.showSnack({ msg: 'Zammad token missing — set it in Zammad Token field or Debug panel', type: 'ERROR' }); } catch {}
      return false;
    }
    const timeout = getTimeout(config);
    try {
      console.log('[Zammad SPsync] testConnection →', `${base}/api/v1/users/me`);
      const me = await http.get(`${base}/api/v1/users/me`, { timeout });
      if (me && me.id) {
        console.log('[Zammad SPsync] testConnection me.id', me.id, 'login', me.login);
        // Cache resolved id for Phase 2 (supports login/email placeholder)
        const hasUserConfig = (config.zammadUser && String(config.zammadUser).trim()) || (config.zammadUserId && String(config.zammadUserId).trim());
        if (!hasUserConfig) {
          try {
            const existing = await PluginAPI.loadSyncedData();
            const data = existing ? JSON.parse(existing) : {};
            if (!data.cachedUserId || String(data.cachedUserId) !== String(me.id)) {
              data.cachedUserId = String(me.id);
              // Also cache login for placeholder display
              data.cachedUserLogin = me.login || me.email || '';
              await PluginAPI.persistDataSynced(JSON.stringify(data));
              console.log('[Zammad SPsync] cachedUserId/Login persisted', me.id, data.cachedUserLogin);
            }
          } catch (cacheErr) { console.warn('[Zammad SPsync] cache userId failed', cacheErr); }
        }
        try { await http.get(`${base}/api/v1/ticket_states`, { timeout }); } catch {}
        try { PluginAPI.showSnack({ msg: `Zammad OK — user ${me.id}`, type: 'SUCCESS' }); } catch {}
        return true;
      }
      try { PluginAPI.showSnack({ msg: 'Zammad: unexpected response (no id)', type: 'ERROR' }); } catch {}
      return false;
    } catch (e) {
      const msg = e && (e.message || e.status || e.error || String(e));
      const status = e && e.status;
      console.error('[Zammad SPsync] testConnection failed', status, msg, e);
      let userMsg = `Zammad connection failed: ${msg}`;
      if (status === 401) userMsg = 'Zammad 401 — invalid token (check Token token=…)';
      else if (status === 403) userMsg = 'Zammad 403 — forbidden';
      try { PluginAPI.showSnack({ msg: userMsg, type: 'ERROR' }); } catch {}
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
