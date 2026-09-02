// SPsync — Zammad issueProvider for Super Productivity
// Per https://github.com/super-productivity/super-productivity/wiki/2.15-Develop-a-Plugin
// and https://github.com/super-productivity/super-productivity/blob/master/docs/plugin-development.md
// Types: packages/plugin-api/src/types.ts + issue-provider-types.ts
//
// plugin.js runs in the host renderer via `new Function` (not sandboxed).
// Only trust audited sources. Secrets are local-only via setSecret/getSecret.

console.log('[Zammad SPsync] plugin.js loaded — 0.1.5 scaffold Phase 0');

const t = (key, fallback) => {
  try { return PluginAPI.translate(key) || fallback; } catch { return fallback; }
};

// Cold-boot safe init — plugin.onReady waits for Electron IPC bridge if needed
if (typeof plugin !== 'undefined' && plugin.onReady) {
  plugin.onReady(async () => {
    console.log('[Zammad SPsync] onReady');
    // Phase 0: just log, future Phase 1 will validate secret + schedule
    try {
      const hasSecret = typeof PluginAPI.getSecret === 'function' ? await PluginAPI.getSecret('zammadToken') : null;
      console.log('[Zammad SPsync] secret present:', !!hasSecret);
    } catch (e) { console.warn('[Zammad SPsync] getSecret check failed', e); }
  });
  plugin.onUnload(() => {
    console.log('[Zammad SPsync] onUnload — cleanup (no interval yet in Phase 0)');
  });
}

// Config complet Phase 0 (arbitrage 2026-09-02: Complet + setSecret + 90s + EN+FR)
PluginAPI.registerIssueProvider({
  configFields: [
    {
      key: 'zammadUrl',
      type: 'input',
      label: t('CFG.ZAMMAD_URL', 'Zammad URL'),
      description: t('CFG.ZAMMAD_URL_DESC', 'Base URL, e.g. https://zammad.example.com'),
      required: true,
      pattern: '^https?://.+',
    },
    {
      key: 'zammadUserId',
      type: 'input',
      label: t('CFG.ZAMMAD_USER_ID', 'Zammad User ID (empty = auto /users/me)'),
      required: false,
      advanced: true,
    },
    {
      key: 'pollInterval',
      type: 'select',
      label: t('CFG.POLL_INTERVAL', 'Poll interval'),
      required: false,
      advanced: true,
      options: [
        { label: '30s', value: '30000' },
        { label: '90s', value: '90000' },
        { label: '5 min', value: '300000' },
      ],
    },
    {
      key: 'autoAddBacklog',
      type: 'checkbox',
      label: t('CFG.AUTO_ADD_BACKLOG', 'Auto-add new issues to backlog'),
      required: false,
      advanced: true,
    },
    {
      key: 'zammadTimeout',
      type: 'input',
      label: t('CFG.TIMEOUT', 'Request timeout (ms)'),
      description: t('CFG.TIMEOUT_DESC', 'Timeout for Zammad API requests'),
      required: false,
      advanced: true,
      pattern: '^[0-9]+$',
    },
    // NOTE: no zammadToken field here — token is collected via index.html (setSecret)
    // to keep it local-only (never synced/exported). See PROJET.md § Security.
  ],

  // Build headers — reads secret (local-only) first, falls back to config for migration
  async getHeaders(config) {
    let token = null;
    try {
      if (typeof PluginAPI.getSecret === 'function') token = await PluginAPI.getSecret('zammadToken');
    } catch {}
    if (!token && config.zammadToken) token = config.zammadToken; // legacy fallback
    return token ? { Authorization: `Token token=${token}` } : {};
  },

  // Phase 0 scaffold: empty search — Phase 1 will implement real Zammad queries
  async searchIssues(searchTerm, config, http) {
    console.log('[Zammad SPsync] searchIssues scaffold', { searchTerm, hasUrl: !!config.zammadUrl });
    // Return empty to prove wiring; Phase 1 will query <ZAMMAD_URL>/api/v1/tickets/search
    return [];
  },

  async getById(issueId, config, http) {
    console.log('[Zammad SPsync] getById scaffold', issueId);
    // Phase 1: GET /api/v1/tickets/:id + /ticket_articles/by_ticket/:id
    return {
      id: String(issueId),
      title: `[scaffold] #${issueId}`,
      body: 'Phase 0 scaffold — no Zammad fetch yet. Next: Phase 1 reading.',
      url: `${(config.zammadUrl || '').replace(/\/+$/, '')}/#ticket/zoom/${issueId}`,
      state: 'open',
      lastUpdated: Date.now(),
      comments: [],
    };
  },

  async getNewIssuesForBacklog(config, http) {
    console.log('[Zammad SPsync] getNewIssuesForBacklog scaffold');
    // Phase 2: owner_id:<me> AND state:new  + Phase 3: pending reminder → open
    return [];
  },

  getIssueLink(issueId, config) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    return `${base}/#ticket/zoom/${issueId}`;
  },

  async testConnection(config, http) {
    const base = (config.zammadUrl || '').replace(/\/+$/, '');
    if (!base) return false;
    try {
      // Scaffold health check — Phase 1: real GET /api/v1/users/me
      console.log('[Zammad SPsync] testConnection scaffold →', `${base}/api/v1/users/me`);
      // Don't actually call yet in scaffold to avoid unauth noise; return true if URL looks valid
      return /^https?:\/\/.+/.test(base);
    } catch {
      return false;
    }
  },

  issueDisplay: [
    { field: 'title', label: 'Title', type: 'link', linkField: 'url' },
    { field: 'status', label: 'State', type: 'text' },
    { field: 'assignee', label: 'Assignee', type: 'text', hideEmpty: true },
  ],

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

console.log('[Zammad SPsync] issueProvider registered (Phase 0 scaffold)');
