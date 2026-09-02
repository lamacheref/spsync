// SPsync — Zammad issueProvider for Super Productivity
// Phase 1: Zammad Reading (F1.1-F1.5) — real PluginHttp calls
// Per https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin
// and docs/plugin-development.md — Types: plugin-api/src/types.ts + issue-provider-types.ts

console.log('[Zammad SPsync] plugin.js loaded — Phase 1 (Reading)');

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
    console.log('[Zammad SPsync] onReady — Phase 1');
    try {
      const hasSecret = typeof PluginAPI.getSecret === 'function' ? await PluginAPI.getSecret('zammadToken') : null;
      console.log('[Zammad SPsync] secret present:', !!hasSecret);
      if (!hasSecret) console.warn('[Zammad SPsync] No secret — set token via index.html (setSecret)');
    } catch (e) { console.warn('[Zammad SPsync] getSecret check failed', e); }
  });
  plugin.onUnload(() => console.log('[Zammad SPsync] onUnload'));
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

  // F2.1 scaffold kept empty for Phase 1 — real logic in Phase 2
  async getNewIssuesForBacklog(config, http) {
    console.log('[Zammad SPsync] getNewIssuesForBacklog — Phase 1 returns [] (Phase 2 will implement owner_id filter)');
    return [];
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
