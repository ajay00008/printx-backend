/**
 * Integration Controller
 *
 * Static data layer — all integration metadata and per-user connection state
 * is served from here. Replace the `STATIC_INTEGRATIONS` catalogue and the
 * in-memory `userConnections` store with real DB queries when you are ready
 * to wire up OAuth / third-party SDKs.
 */

// ---------------------------------------------------------------------------
// Catalogue — mirrors the frontend integrationConfigs but without JSX icons.
// The frontend renders its own icons; these fields drive the connection state.
// ---------------------------------------------------------------------------
const STATIC_INTEGRATIONS = [
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    category: 'calendar',
    description: 'Sync your calendar events and automatically join scheduled meetings for transcription.',
    badge: 'Popular',
    badgeVariant: 'default',
    learnMoreUrl: null,
    requiresEnterprise: false,
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    category: 'storage',
    description: 'Import audio/video files from Google Drive and save transcriptions back to your Drive.',
    badge: null,
    badgeVariant: null,
    learnMoreUrl: null,
    requiresEnterprise: false,
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    description: 'Share transcriptions to Slack channels and get notifications for completed recordings.',
    badge: 'NEW',
    badgeVariant: 'default',
    learnMoreUrl: null,
    requiresEnterprise: false,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'communication',
    description: 'Automatically join and transcribe your Zoom meetings in real-time.',
    badge: null,
    badgeVariant: null,
    learnMoreUrl: 'https://zoom.us',
    requiresEnterprise: false,
  },
  {
    id: 'microsoft_teams',
    name: 'Microsoft Teams',
    category: 'communication',
    description: 'Join and transcribe Microsoft Teams meetings automatically.',
    badge: null,
    badgeVariant: null,
    learnMoreUrl: null,
    requiresEnterprise: false,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    category: 'storage',
    description: 'Sync audio/video files from Dropbox and save transcripts back to your account.',
    badge: null,
    badgeVariant: null,
    learnMoreUrl: null,
    requiresEnterprise: false,
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'productivity',
    description: 'Export transcriptions and meeting notes directly to your Notion workspace.',
    badge: 'Beta',
    badgeVariant: 'secondary',
    learnMoreUrl: null,
    requiresEnterprise: false,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'productivity',
    description: 'Sync meeting notes to Salesforce contacts and enrich your CRM with conversation insights.',
    badge: 'Enterprise',
    badgeVariant: 'outline',
    learnMoreUrl: null,
    requiresEnterprise: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'productivity',
    description: 'Automatically enrich deals and contacts with insights from every recorded call.',
    badge: 'Enterprise',
    badgeVariant: 'outline',
    learnMoreUrl: null,
    requiresEnterprise: true,
  },
]

// ---------------------------------------------------------------------------
// In-memory connection store — keyed by userId (or 'anonymous').
// Replace with a DB model (e.g. Integration collection in Mongoose) later.
// Shape: { [userId]: { [integrationId]: { connected, account, lastSync } } }
// ---------------------------------------------------------------------------
const userConnections = {}

function getUserKey(req) {
  return req.user?.id || 'anonymous'
}

function getConnections(req) {
  const key = getUserKey(req)
  if (!userConnections[key]) userConnections[key] = {}
  return userConnections[key]
}

function buildResponse(integration, connections) {
  const conn = connections[integration.id] || {}
  return {
    id: integration.id,
    name: integration.name,
    category: integration.category,
    description: integration.description,
    badge: integration.badge,
    badgeVariant: integration.badgeVariant,
    learnMoreUrl: integration.learnMoreUrl,
    requiresEnterprise: integration.requiresEnterprise,
    connected: conn.connected || false,
    account: conn.account || null,
    lastSync: conn.lastSync || null,
  }
}

// ---------------------------------------------------------------------------
// GET /api/integrations
// ---------------------------------------------------------------------------
export async function listIntegrations(req, res) {
  const connections = getConnections(req)
  const result = STATIC_INTEGRATIONS.map((i) => buildResponse(i, connections))
  res.json(result)
}

// ---------------------------------------------------------------------------
// POST /api/integrations/:type/connect
// ---------------------------------------------------------------------------
export async function connectIntegration(req, res) {
  const { type } = req.params
  const integration = STATIC_INTEGRATIONS.find((i) => i.id === type)

  if (!integration) {
    return res.status(404).json({ error: `Integration '${type}' not found` })
  }

  if (integration.requiresEnterprise) {
    return res.status(403).json({ error: 'This integration requires an Enterprise plan' })
  }

  const connections = getConnections(req)
  connections[type] = {
    connected: true,
    account: req.body?.account || 'user@example.com',
    lastSync: new Date().toISOString(),
  }

  res.json(buildResponse(integration, connections))
}

// ---------------------------------------------------------------------------
// POST /api/integrations/:type/disconnect
// ---------------------------------------------------------------------------
export async function disconnectIntegration(req, res) {
  const { type } = req.params
  const integration = STATIC_INTEGRATIONS.find((i) => i.id === type)

  if (!integration) {
    return res.status(404).json({ error: `Integration '${type}' not found` })
  }

  const connections = getConnections(req)
  delete connections[type]

  res.json({ success: true })
}

// ---------------------------------------------------------------------------
// POST /api/integrations/:type/sync
// ---------------------------------------------------------------------------
export async function syncIntegration(req, res) {
  const { type } = req.params
  const integration = STATIC_INTEGRATIONS.find((i) => i.id === type)

  if (!integration) {
    return res.status(404).json({ error: `Integration '${type}' not found` })
  }

  const connections = getConnections(req)

  if (!connections[type]?.connected) {
    return res.status(400).json({ error: `Integration '${type}' is not connected` })
  }

  const syncedAt = new Date().toISOString()
  connections[type].lastSync = syncedAt

  res.json({ success: true, synced_at: syncedAt })
}
