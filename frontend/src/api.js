/**
 * DRISHTI API Client
 * Normalizes all backend response shapes so pages get clean, consistent data.
 *
 * Backend response shapes:
 *   GET /api/trains/current         → Train[] (direct array from DB)
 *   GET /api/trains/:id/current     → { train_id, latest_telemetry, ... }
 *   GET /api/trains/:id/history     → { telemetry: [...] }
 *   GET /api/trains/ingestion/summary → { total_records: { received, valid, persisted }, by_source }
 *   GET /api/alerts/history         → { alerts: [...], total }
 *   GET /api/network/pulse          → { nodes: [...], links: [...] }
 *   GET /api/health                 → { status: "healthy", connections, ... }
 *   GET /api/stats                  → { total, critical, high, medium, low, ... }
 */

const BASE = '/api'

async function _get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`)
  return res.json()
}

// ── Health ─────────────────────────────────────────────────────────────────────

export async function getHealth() {
  try {
    const d = await _get('/health')
    return {
      status:               d.status === 'healthy' || d.status === 'ok' ? 'ok' : d.status,
      websocket_connections: d.connections ?? 0,
      database:             d.status === 'healthy' ? 'ok' : 'unknown',
      started_at:           null,      // not exposed by backend yet
      bayesian_network:     d.bayesian_network ?? false,
      cascade_engine:       d.cascade_engine   ?? false,
      nodes_watched:        d.nodes_watched    ?? 51,
      trains_monitored:     d.trains_monitored ?? 0,
    }
  } catch {
    return { status: 'offline' }
  }
}

// ── Stats ──────────────────────────────────────────────────────────────────────

export async function getStats() {
  try { return await _get('/stats') }
  catch { return { total: 0, critical: 0, high: 0, medium: 0, low: 0 } }
}

// ── Trains ─────────────────────────────────────────────────────────────────────

/**
 * All active trains. Normalized to include stress_level, speed, delay_minutes, zone.
 * DB trains don't have stress/speed yet, so we merge with live alert buffer via /api/stats.
 */
export async function getCurrentTrains() {
  try {
    const data = await _get('/trains/current')
    if (!Array.isArray(data)) return []
    // Normalize field names
    return data.map(t => ({
      train_id:        t.train_id,
      train_name:      t.train_name     ?? '—',
      current_station: t.current_station ?? t.current_station_code ?? '—',
      zone:            t.zone            ?? t.source ?? '—',
      route:           t.route           ?? '—',
      stress_level:    t.stress_level    ?? 'STABLE',
      speed:           t.speed           ?? t.speed_kmh ?? null,
      delay_minutes:   t.delay_minutes   ?? null,
      timestamp:       t.updated_at      ?? t.timestamp ?? null,
    }))
  } catch { return [] }
}

/**
 * Single train current state. Flattens nested latest_telemetry.
 */
export async function getTrainCurrent(trainId) {
  try {
    const d = await _get(`/trains/${encodeURIComponent(trainId)}/current`)
    const tel = d.latest_telemetry || {}
    return {
      train_id:        d.train_id,
      train_name:      d.train_name,
      current_station: d.current_station ?? d.current_station_code ?? tel.station_code,
      zone:            d.zone ?? '—',
      route:           d.route ?? '—',
      source:          d.source ?? '—',
      stress_level:    d.stress_level ?? 'STABLE',
      stress_score:    d.stress_score  ?? null,
      speed:           tel.speed_kmh   ?? d.speed ?? null,
      delay_minutes:   tel.delay_minutes ?? d.delay_minutes ?? null,
      latitude:        tel.latitude,
      longitude:       tel.longitude,
      timestamp:       tel.timestamp_utc ?? d.updated_at,
    }
  } catch { return null }
}

/**
 * Train telemetry history. Backend returns { telemetry: [...] }, we return the array.
 */
export async function getTrainHistory(trainId, hours = 24) {
  try {
    const d = await _get(`/trains/${encodeURIComponent(trainId)}/history?hours=${hours}`)
    // Shape: { telemetry: [...] } or array directly
    const arr = Array.isArray(d) ? d : (d.telemetry ?? [])
    return arr.map(t => ({
      timestamp:     t.timestamp_utc ?? t.timestamp,
      station_code:  t.station_code,
      speed:         t.speed_kmh   ?? t.speed ?? 0,
      delay_minutes: t.delay_minutes ?? 0,
      stress_score:  t.stress_score  ?? null,
      latitude:      t.latitude,
      longitude:     t.longitude,
    }))
  } catch { return [] }
}

/**
 * Trains at a station. Returns array.
 */
export async function getTrainsAtStation(stationCode) {
  try {
    const d = await _get(`/trains/station/${encodeURIComponent(stationCode)}/current`)
    return Array.isArray(d) ? d : (d.trains ?? [])
  } catch { return [] }
}

/**
 * Ingestion summary. Backend returns { total_records: { received, valid, persisted }, by_source }.
 * We flatten to { received, valid, persisted, by_source, error_rate }.
 */
export async function getIngestionSummary() {
  try {
    const d = await _get('/trains/ingestion/summary')
    const totals = d.total_records ?? {}
    // Flatten by_source counts
    const flatSrc = {}
    if (d.by_source) {
      Object.entries(d.by_source).forEach(([src, info]) => {
        flatSrc[src] = typeof info === 'object' ? (info.persisted ?? info.received ?? 0) : info
      })
    }
    const received  = totals.received  ?? 0
    const valid     = totals.valid     ?? 0
    const persisted = totals.persisted ?? 0
    return {
      received,
      valid,
      persisted,
      by_source:   flatSrc,
      error_rate:  received > 0 ? (received - valid) / received : 0,
      last_run:    d.latest_run?.finished_at ?? null,
    }
  } catch {
    return { received: 0, valid: 0, persisted: 0, by_source: {}, error_rate: 0, last_run: null }
  }
}

// ── Alerts ─────────────────────────────────────────────────────────────────────

/**
 * Alert history. Backend returns { alerts: [...], total } — we return the array.
 * Also normalizes field names so frontend pages don't need to know backend shape.
 */
export async function getAlerts(limit = 200) {
  try {
    const d = await _get(`/alerts/history?limit=${limit}`)
    // Backend wraps in { alerts: [...] }
    const arr = Array.isArray(d) ? d : (d.alerts ?? [])
    return arr.map(a => ({
      // ID
      id:           a.id ?? a.alert_id,
      // Classification
      severity:     a.severity   ?? 'LOW',
      alert_type:   a.alert_type ?? a.type ?? 'System Alert',
      // Location
      node_id:      a.station_code ?? a.node_id,
      station:      a.station_name ?? a.station,
      zone:         a.zone,
      train_id:     a.train_id,
      // Scores
      stress_score:     a.risk_score   ?? a.stress_score,
      crs_match_score:  a.signature_match_pct != null ? a.signature_match_pct / 100 : (a.crs_match_score ?? 0),
      bayesian_risk:    a.bayesian_risk,
      anomaly_score:    a.anomaly_score,
      speed:            a.speed,
      // Meta
      timestamp:        a.timestamp,
      description:      a.explanation ?? a.description,
      actions:          a.actions,
    }))
  } catch { return [] }
}

// ── Network ────────────────────────────────────────────────────────────────────

export async function getNetworkPulse() {
  try { return await _get('/network/pulse') }
  catch { return { nodes: [], links: [] } }
}

export async function getNetworkNodes(zone, minStress) {
  try {
    const params = new URLSearchParams()
    if (zone)      params.set('zone', zone)
    if (minStress) params.set('min_stress', minStress)
    const d = await _get(`/network/nodes?${params}`)
    return d.nodes ?? []
  } catch { return [] }
}

// ── Zone coverage ──────────────────────────────────────────────────────────────

export async function getZoneCoverage() {
  try {
    const d = await _get('/trains/coverage/zones')
    // Returns { by_zone: [{ zone, train_count }] }
    const result = {}
    if (Array.isArray(d.by_zone)) {
      d.by_zone.forEach(({ zone, train_count }) => { result[zone] = train_count })
    }
    return result
  } catch { return {} }
}

// ── Live stats aggregator ──────────────────────────────────────────────────────

export async function getLiveStats() {
  try {
    // Prefer /api/stats which gives us critical/high/medium/low counts
    const [statsData, trainsData] = await Promise.allSettled([
      getStats(),
      getCurrentTrains(),
    ])
    const s = statsData.status === 'fulfilled' ? statsData.value : {}
    const trains = trainsData.status === 'fulfilled' ? trainsData.value : []
    return {
      total:    s.total    ?? trains.length,
      critical: s.critical ?? trains.filter(t => t.stress_level === 'CRITICAL').length,
      high:     s.high     ?? trains.filter(t => t.stress_level === 'HIGH').length,
      trains:   s.trains_monitored ?? trains.length,
      nodes:    s.nodes_watched ?? 51,
    }
  } catch { return { total: 0, critical: 0, high: 0, trains: 0, nodes: 51 } }
}

// ── Polling helpers ────────────────────────────────────────────────────────────

export function setupPolling(callback, fetchFn, interval = 5000) {
  fetchFn().then(callback).catch(err => console.error('[Poll]', err))
  return setInterval(() => {
    fetchFn().then(callback).catch(err => console.error('[Poll]', err))
  }, interval)
}

export function clearPolling(id) {
  if (id) clearInterval(id)
}
