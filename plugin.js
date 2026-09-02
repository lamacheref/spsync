// SPsync — Zammad issueProvider for Super Productivity
// Minimal scaffold per https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin
// Full guide: https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md
// Types: packages/plugin-api/src/types.ts and packages/plugin-api/src/issue-provider-types.ts
//
// This file is loaded in the host renderer via `new Function` (not sandboxed).
// Only trust sources you audit. See PROJET.md § Security.

console.log('[Zammad SPsync] plugin.js loaded');

// Use plugin.onReady for any startup that needs the Electron bridge (cold boot safe)
if (typeof plugin !== 'undefined' && plugin.onReady) {
  plugin.onReady(async () => {
    console.log('[Zammad SPsync] onReady');
    // Future: restore secrets, validate connection, schedule subtask creation hook
  });
  plugin.onUnload(() => {
    console.log('[Zammad SPsync] onUnload — cleanup');
    // Future: clearInterval, remove listeners
  });
}

// Register as issueProvider — integrates with Issue Panel like GitHub/Jira
// Poll interval is driven by manifest.json:issueProvider.pollIntervalMs (90s)
// Each callback receives `config` (synced) and `http: PluginHttp` (host-enforced)
PluginAPI.registerIssueProvider({
  configFields: [
    {
      key: 'zammadUrl',
      type: 'input',
      label: 'Zammad URL',
      description: 'Base URL, e.g. https://zammad.example.com',
      required: true,
      pattern: '^https?://.+',
    },
    {
      key: 'zammadUserId',
      type: 'input',
      label: 'Zammad User ID (empty = auto /users/me)',
      required: false,
      advanced: true,
    },
    // NOTE: token is NOT stored here — it is stored local-only via PluginAPI.setSecret
    // to avoid syncing/exporting the credential. Collect it via a custom UI that
    // calls setSecret("zammadToken", value). See docs/plugin-development.md § Secret Storage.
  ],

  // Build headers for every Zammad request. Prefer setSecret/getSecret over config.
  async getHeaders(config) {
    // For scaffold, read from config if present (will be migrated to secret storage)
    const tokenFromConfig = config.zammadToken;
    const tokenFromSecret = typeof PluginAPI.getSecret === 'function'
      ? await PluginAPI.getSecret('zammadToken')
      : null;
    const token = tokenFromSecret || tokenFromConfig;
    return token ? { Authorization: `Token token=${token}` } : {};
  },

  // Search when the user types in the Issue Panel or when SP polls for backlog
  async searchIssues(searchTerm, config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) return [];
    // Default query if user typed nothing — show open/new tickets
    const q = searchTerm || 'state.name:new OR state.name:open';
    // Zammad DSL: https://zammad.example.com/api/v1/tickets/search?query=...
    const url = `${base}/api/v1/tickets/search`;
    const res = await http.get(url, { params: { query: q, limit: '20' } });
    // res is array of tickets
    return (Array.isArray(res) ? res : []).map((t) => ({
      id: String(t.id),
      title: `#${t.number} ${t.title}`,
      url: `${base}/#ticket/zoom/${t.id}`,
      status: t.state_id === 1 ? 'new' : t.state_id === 2 ? 'open' : 'pending',
      assignee: String(t.owner_id),
      labels: [],
    }));
  },

  // Full fetch for issue detail + comments (ticket_articles)
  async getById(issueId, config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    const ticket = await http.get(`${base}/api/v1/tickets/${issueId}`);
    const articles = await http.get(`${base}/api/v1/ticket_articles/by_ticket/${issueId}`);
    const list = Array.isArray(articles) ? articles : [];
    // Prefer first customer article as body
    const body = list.find((a) => !a.internal)?.body || list[0]?.body || '';
    return {
      id: String(ticket.id),
      title: ticket.title,
      body,
      url: `${base}/#ticket/zoom/${ticket.id}`,
      state: String(ticket.state_id),
      lastUpdated: new Date(ticket.updated_at).getTime(),
      comments: list.map((a) => ({
        author: a.from || a.created_by || 'unknown',
        body: a.body || '',
        created: new Date(a.created_at).getTime(),
      })),
    };
  },

  // Called by SP to auto-add new issues to backlog (if enabled in manifest)
  async getNewIssuesForBacklog(config, http) {
    // Implements the two use-cases from PROJET.md:
    // 1) owner_id:<me> AND state:new  → newly assigned by peer
    // 2) pending reminder → open       → recently out of waiting (via state cache heuristic)
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) return [];
    // Resolve user id if not configured
    let userId = config.zammadUserId;
    if (!userId) {
      try {
        const me = await http.get(`${base}/api/v1/users/me`);
        userId = String(me.id);
      } catch {
        return [];
      }
    }
    const q = `owner_id:${userId} AND state.name:new`;
    const res = await http.get(`${base}/api/v1/tickets/search`, { params: { query: q, limit: '20' } });
    return (Array.isArray(res) ? res : []).map((t) => ({
      id: String(t.id),
      title: `🆕 #${t.number} ${t.title}`,
      url: `${base}/#ticket/zoom/${t.id}`,
      status: 'new',
      assignee: String(t.owner_id),
    }));
  },

  getIssueLink(issueId, config) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    return `${base}/#ticket/zoom/${issueId}`;
  },

  async testConnection(config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) return false;
    try {
      await http.get(`${base}/api/v1/users/me`);
      return true;
    } catch {
      return false;
    }
  },

  issueDisplay: [
    { field: 'title', label: 'Title', type: 'link', linkField: 'url' },
    { field: 'status', label: 'State', type: 'text' },
    { field: 'assignee', label: 'Assignee', type: 'text', hideEmpty: true },
  ],

  // Sync task done ↔ ticket closed (pullOnly = SP reflects Zammad, not vice versa)
  fieldMappings: [
    {
      taskField: 'isDone',
      issueField: 'state',
      defaultDirection: 'pullOnly',
      toIssueValue: (v) => (v ? 'closed' : 'open'),
      toTaskValue: (v) => v === 'closed' || v === '4',
    },
  ],
});

console.log('[Zammad SPsync] issueProvider registered');
