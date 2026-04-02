/**
 * Railway DRISHTI Frontend API Utilities
 * Interfaces with new DB-backed train APIs instead of WebSocket memory buffers
 */

const API_BASE = '/api'

// ── Trains API ──────────────────────────────────────────────────────────────

/**
 * Get current state of all active trains
 * @returns {Promise<Object[]>} Array of trains with latest telemetry
 */
export async function getCurrentTrains() {
  try {
    const res = await fetch(`${API_BASE}/trains/current`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to fetch current trains:', err)
    return []
  }
}

/**
 * Get current state of a specific train
 * @param {string} trainId
 * @returns {Promise<Object>} Train object with latest telemetry
 */
export async function getTrainCurrent(trainId) {
  try {
    const res = await fetch(`${API_BASE}/trains/${trainId}/current`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`Failed to fetch train ${trainId}:`, err)
    return null
  }
}

/**
 * Get 24-hour telemetry history for a train
 * @param {string} trainId
 * @param {number} hours - Look back period (default 24)
 * @returns {Promise<Object[]>} Array of telemetry records
 */
export async function getTrainHistory(trainId, hours = 24) {
  try {
    const res = await fetch(`${API_BASE}/trains/${trainId}/history?hours=${hours}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`Failed to fetch train history for ${trainId}:`, err)
    return []
  }
}

/**
 * Get all trains at a specific station
 * @param {string} stationCode - Railway station code (e.g., "NDLS", "CST")
 * @returns {Promise<Object[]>} Array of trains at station
 */
export async function getTrainsAtStation(stationCode) {
  try {
    const res = await fetch(`${API_BASE}/trains/station/${stationCode}/current`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`Failed to fetch trains at ${stationCode}:`, err)
    return []
  }
}

/**
 * Get ingestion pipeline metrics
 * @returns {Promise<Object>} Metrics with received/valid/persisted counts by source
 */
export async function getIngestionSummary() {
  try {
    const res = await fetch(`${API_BASE}/trains/ingestion/summary`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to fetch ingestion summary:', err)
    return {
      received: 0,
      valid: 0,
      persisted: 0,
      by_source: {},
      last_run: null,
      error_rate: 0
    }
  }
}

/**
 * Get train distribution by IR zone
 * @returns {Promise<Object>} Zone codes mapped to train counts
 */
export async function getZoneCoverage() {
  try {
    const res = await fetch(`${API_BASE}/trains/coverage/zones`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to fetch zone coverage:', err)
    return {}
  }
}

// ── Health API ──────────────────────────────────────────────────────────────

/**
 * Get backend health status
 * @returns {Promise<Object>} Health metrics (uptime, connections, etc)
 */
export async function getHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to fetch health:', err)
    return { status: 'offline' }
  }
}

// ── Alerts API ──────────────────────────────────────────────────────────────

/**
 * Get recent alerts/incidents
 * @param {number} limit - Max results (default 200)
 * @returns {Promise<Object[]>} Array of alert objects
 */
export async function getAlerts(limit = 200) {
  try {
    const res = await fetch(`${API_BASE}/alerts/history?limit=${limit}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('Failed to fetch alerts:', err)
    return []
  }
}

// ── Live Stats Aggregator ──────────────────────────────────────────────────

/**
 * Compute live dashboard statistics from current train data
 * @returns {Promise<Object>} { total: number, critical: number, trains: number, nodes: number }
 */
export async function getLiveStats() {
  try {
    const trains = await getCurrentTrains()
    const criticalCount = trains.filter(t => t.stress_level === 'CRITICAL' || t.stress_level === 'HIGH').length
    const stations = new Set(trains.flatMap(t => [t.current_station, t.next_station])).size
    
    return {
      total: trains.length,
      critical: criticalCount,
      trains: trains.length,
      nodes: stations
    }
  } catch (err) {
    console.error('Failed to compute live stats:', err)
    return { total: 0, critical: 0, trains: 0, nodes: 0 }
  }
}

// ── Polling Helper ──────────────────────────────────────────────────────────

/**
 * Set up polling interval for live data updates
 * @param {Function} callback - Called with new data each poll
 * @param {Function} fetchFn - Async fetch function to poll
 * @param {number} interval - Poll interval in ms (default 5000)
 * @returns {number} Interval ID for cleanup
 */
export function setupPolling(callback, fetchFn, interval = 5000) {
  // Initial fetch
  fetchFn().then(callback).catch(err => console.error('Poll error:', err))
  
  // Set up recurring
  return setInterval(() => {
    fetchFn().then(callback).catch(err => console.error('Poll error:', err))
  }, interval)
}

/**
 * Cleanup polling interval
 * @param {number} intervalId
 */
export function clearPolling(intervalId) {
  if (intervalId) clearInterval(intervalId)
}
