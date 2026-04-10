import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'

// ── Colour helpers ────────────────────────────────────────────────────────────
const stressColor = s => ({
  LOW:      '#3b82f6',
  MEDIUM:   '#eab308',
  HIGH:     '#f97316',
  CRITICAL: '#ef4444',
}[s] || '#3b82f6')

// Incident cause colours
const CAUSE_COLOR = {
  COLLISION_HUMAN_ERROR:  '#ef4444',
  DERAILMENT_HUMAN_ERROR: '#f97316',
  DERAILMENT_BRIDGE:      '#a855f7',
  DERAILMENT:             '#f97316',
  SABOTAGE:               '#dc2626',
  NATURAL_DISASTER:       '#3b82f6',
  COLLISION:              '#ef4444',
}
const CAUSE_LABEL = {
  COLLISION_HUMAN_ERROR:  'Human Error — Collision',
  DERAILMENT_HUMAN_ERROR: 'Human Error — Derailment',
  DERAILMENT_BRIDGE:      'Bridge Derailment',
  DERAILMENT:             'Derailment',
  SABOTAGE:               'Sabotage',
  NATURAL_DISASTER:       'Natural Disaster',
  COLLISION:              'Collision',
}

// Real Indian Railways corridors
const CORRIDORS = {
  'Golden Quadrilateral N-S': [
    [28.64, 77.22], [27.18, 78.01], [26.22, 78.17], [25.45, 78.60],
    [23.18, 77.41], [22.19, 77.69], [21.15, 79.09], [17.43, 78.50],
    [16.51, 80.65], [13.03, 80.19],
  ],
  'Golden Quadrilateral E-W': [
    [18.97, 72.82], [22.31, 73.19], [23.03, 72.57],
    [22.60, 88.30],
  ],
  'East Coast Corridor': [
    [22.60, 88.30], [22.34, 87.32], [21.49, 86.93], [20.25, 85.83],
    [17.69, 83.22], [16.99, 81.79], [16.51, 80.65], [13.03, 80.19],
  ],
  'Western Corridor': [
    [28.64, 77.22], [26.91, 75.79], [26.46, 74.63], [23.03, 72.57], [18.97, 72.82],
  ],
}

// ── Historical Incident Popup ─────────────────────────────────────────────────
function IncidentPopup({ inc }) {
  const col = CAUSE_COLOR[inc.cause_category] || '#ef4444'
  const isDeadliest = inc.deaths >= 200

  return (
    <div style={{ padding: 14, minWidth: 260, fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#f1f5f9', maxWidth: 300 }}>
      {isDeadliest && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 4, padding: '3px 8px', marginBottom: 8,
          fontSize: '0.6rem', fontWeight: 800, color: '#ef4444', letterSpacing: 1,
        }}>
          ⚑ MASS CASUALTY EVENT
        </div>
      )}
      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: col, marginBottom: 2 }}>
        {inc.station}
      </div>
      <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginBottom: 10 }}>
        {new Date(inc.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        {' · '}{CAUSE_LABEL[inc.cause_category]}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
        {[
          { label: 'Deaths',    val: inc.deaths, col: '#ef4444' },
          { label: 'Injured',   val: inc.injuries || '—', col: '#f97316' },
          { label: 'Signal',    val: inc.signal_state?.replace('_', ' '), col: '#94a3b8' },
          { label: 'Track',     val: inc.track_state?.replace('_', ' '), col: '#94a3b8' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontWeight: 700, color: m.col, fontSize: '0.82rem' }}>{m.val}</div>
          </div>
        ))}
      </div>

      <div style={{
        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
        borderRadius: 6, padding: '8px 10px', marginBottom: 10,
        fontSize: '0.65rem', color: '#cbd5e1', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, color: '#f97316', marginBottom: 4, fontSize: '0.6rem', letterSpacing: 0.5 }}>ROOT CAUSE</div>
        {inc.root_cause}
      </div>

      {inc.narrative_text && (
        <div style={{ fontSize: '0.63rem', color: '#94a3b8', lineHeight: 1.65 }}>
          {inc.narrative_text.substring(0, 200)}{inc.narrative_text.length > 200 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

// ── Node popup (live junctions) ───────────────────────────────────────────────
function NodePopup({ node }) {
  const pct = node.signature_match_pct || 0
  const col = stressColor(node.stress_level)
  return (
    <div style={{ padding: 14, minWidth: 240, fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: col }}>{node.name}</div>
          <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 1 }}>
            {node.id} · Zone {node.zone} · Rank #{node.risk_rank}
          </div>
        </div>
        <div style={{
          padding: '3px 8px', borderRadius: 4,
          background: `${col}22`, border: `1px solid ${col}55`,
          color: col, fontSize: '0.65rem', fontWeight: 700,
        }}>{node.stress_level}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
        {[
          { label: 'Centrality Rank', val: `Top ${Math.round((node.risk_rank / 51) * 100)}%`, col },
          { label: 'Current Delay',   val: `${node.delay_minutes || 0} min`, col: node.delay_minutes > 45 ? '#f97316' : '#94a3b8' },
          { label: 'Cascade Risk',    val: `${((node.cascade_risk || 0) * 100).toFixed(0)}%`, col: node.cascade_risk > 0.5 ? '#ef4444' : '#94a3b8' },
          { label: 'CRS Accidents',   val: node.accident_count > 0 ? `${node.accident_count} on record` : 'None', col: node.accident_count > 0 ? '#ef4444' : '#64748b' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontWeight: 700, color: m.col, fontSize: '0.8rem' }}>{m.val}</div>
          </div>
        ))}
      </div>
      {node.signature_accident_name && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '7px 10px', marginBottom: 10 }}>
          <div style={{ fontSize: '0.62rem', color: '#ef4444', fontWeight: 700, marginBottom: 3 }}>
            ⚠ CRS SIGNATURE MATCH: {pct}%
          </div>
          <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
            {node.signature_accident_name} · {node.signature_date}
          </div>
          {node.signature_deaths > 0 && (
            <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2 }}>
              {node.signature_deaths} deaths on record
            </div>
          )}
        </div>
      )}
      {pct > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', marginBottom: 4 }}>
            <span>Pattern Match</span><span>{pct}%</span>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: pct > 75 ? '#ef4444' : pct > 50 ? '#f97316' : '#eab308', borderRadius: 4 }} />
          </div>
        </div>
      )}
      <Link to={`/alerts?station=${node.id}`} style={{
        display: 'block', textAlign: 'center', padding: '6px',
        background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
        color: '#3b82f6', borderRadius: 5, fontSize: '0.7rem', fontWeight: 700,
      }}>
        View Alerts for {node.id} →
      </Link>
    </div>
  )
}

// ── Incident Timeline Panel ───────────────────────────────────────────────────
function IncidentPanel({ incidents, selected, onSelect }) {
  const sorted = [...incidents].sort((a, b) => new Date(b.date) - new Date(a.date))
  const totalDeaths = incidents.reduce((s, i) => s + i.deaths, 0)

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, width: 300, height: '100%',
      background: 'rgba(4,7,26,0.96)', backdropFilter: 'blur(14px)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column', zIndex: 999,
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Panel header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', letterSpacing: 1, marginBottom: 4 }}>
          ⚑ HISTORICAL INCIDENT REGISTER
        </div>
        <div style={{ fontSize: '0.6rem', color: '#64748b' }}>
          {incidents.length} documented accidents · {totalDeaths.toLocaleString()}+ total deaths · 1961–2024
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {Object.entries(CAUSE_COLOR).slice(0, 4).map(([k, c]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
              <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>{CAUSE_LABEL[k]?.split(' — ')[0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.map(inc => {
          const col = CAUSE_COLOR[inc.cause_category] || '#ef4444'
          const isSelected = selected?.accident_id === inc.accident_id
          return (
            <div
              key={inc.accident_id}
              onClick={() => onSelect(isSelected ? null : inc)}
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                cursor: 'pointer',
                background: isSelected ? 'rgba(239,68,68,0.07)' : 'transparent',
                borderLeft: `3px solid ${isSelected ? col : 'transparent'}`,
                transition: 'all 150ms',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#e2e8f0', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {inc.station}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: '#64748b' }}>
                    {new Date(inc.date).getFullYear()} · {CAUSE_LABEL[inc.cause_category]}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.82rem', fontWeight: 800, color: col }}>
                    {inc.deaths >= 500 ? `${inc.deaths}+` : inc.deaths}
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#64748b' }}>deaths</div>
                </div>
              </div>
              {isSelected && (
                <div style={{ marginTop: 6, fontSize: '0.62rem', color: '#94a3b8', lineHeight: 1.55 }}>
                  {inc.root_cause}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Stats footer */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Human Error', val: incidents.filter(i => i.cause_category?.includes('HUMAN')).length, col: '#ef4444' },
          { label: 'Sabotage', val: incidents.filter(i => i.cause_category === 'SABOTAGE').length, col: '#dc2626' },
          { label: 'Natural', val: incidents.filter(i => i.cause_category === 'NATURAL_DISASTER').length, col: '#3b82f6' },
          { label: 'Deadliest Year', val: '1981', col: '#f97316' },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: '0.55rem', color: '#64748b', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 800, fontSize: '0.85rem', color: s.col }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NetworkMap() {
  const [nodes,      setNodes]      = useState([])
  const [incidents,  setIncidents]  = useState([])
  const [tileKey,    setTileKey]    = useState('dark')
  const [filter,     setFilter]     = useState('ALL')
  const [layer,      setLayer]      = useState('BOTH')      // 'BOTH' | 'NETWORK' | 'INCIDENTS'
  const [causeFilter,setCauseFilter]= useState('ALL')
  const [selectedInc,setSelectedInc]= useState(null)
  const [showPanel,  setShowPanel]  = useState(true)

  const MAP_TILES = {
    dark:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    terrain: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
  }

  // Load network graph
  useEffect(() => {
    fetch('/network_graph.json')
      .then(r => r.json())
      .then(d => setNodes(d.graph?.nodes || []))
      .catch(() => {})
  }, [])

  // Load CRS corpus
  useEffect(() => {
    fetch('/crs_corpus.json')
      .then(r => r.json())
      .then(d => setIncidents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const visibleNodes = useMemo(() => {
    let list = nodes
    if (filter !== 'ALL') list = list.filter(n => n.stress_level === filter)
    return list
  }, [nodes, filter])

  const visibleIncidents = useMemo(() => {
    if (causeFilter === 'ALL') return incidents
    return incidents.filter(i => i.cause_category === causeFilter)
  }, [incidents, causeFilter])

  const showNetwork   = layer === 'BOTH' || layer === 'NETWORK'
  const showIncidents = layer === 'BOTH' || layer === 'INCIDENTS'
  const critCount     = nodes.filter(n => n.stress_level === 'CRITICAL').length
  const totalDeaths   = incidents.reduce((s, i) => s + i.deaths, 0)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 20px', background: 'rgba(4,7,26,0.97)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#e2e8f0' }}>
            National Railway Intelligence Map
          </h2>
          <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: 2 }}>
            Live risk overlay · {incidents.length} historical incidents · {totalDeaths.toLocaleString()}+ documented deaths
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

          {/* Summary pills */}
          {[
            { label: 'Critical', val: critCount, col: '#ef4444' },
            { label: 'Incidents', val: incidents.length, col: '#dc2626' },
            { label: 'Lives Lost', val: `${(totalDeaths/1000).toFixed(1)}k+`, col: '#f97316' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.7rem' }}>
              <span style={{ color: '#64748b' }}>{s.label}:</span>
              <span style={{ fontWeight: 800, fontFamily: 'IBM Plex Mono, monospace', color: s.col }}>{s.val}</span>
            </div>
          ))}

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

          {/* Layer toggle */}
          <div style={{ display: 'flex', gap: 3 }}>
            {[['BOTH','All Layers'],['NETWORK','Live Grid'],['INCIDENTS','Incidents']].map(([v,l]) => (
              <button key={v} onClick={() => setLayer(v)} style={{
                padding: '3px 9px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
                background: layer === v ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                color: layer === v ? '#ef4444' : '#64748b',
                border: `1px solid ${layer === v ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                cursor: 'pointer',
              }}>{l}</button>
            ))}
          </div>

          {/* Cause filter (only shown when incidents visible) */}
          {showIncidents && (
            <select
              value={causeFilter}
              onChange={e => setCauseFilter(e.target.value)}
              style={{
                padding: '3px 7px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
              }}
            >
              <option value="ALL">All Causes</option>
              {Object.entries(CAUSE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          )}

          {/* Stress filter (only shown when network visible) */}
          {showNetwork && (
            <div style={{ display: 'flex', gap: 3 }}>
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '3px 7px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700,
                  background: filter === f ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
                  color: filter === f ? '#3b82f6' : '#64748b',
                  border: `1px solid ${filter === f ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  cursor: 'pointer',
                }}>{f}</button>
              ))}
            </div>
          )}

          {/* Tile + panel */}
          <div style={{ display: 'flex', gap: 3 }}>
            {Object.keys(MAP_TILES).map(t => (
              <button key={t} onClick={() => setTileKey(t)} style={{
                padding: '3px 8px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
                textTransform: 'uppercase',
                background: tileKey === t ? 'rgba(255,255,255,0.14)' : 'transparent',
                color: tileKey === t ? '#e2e8f0' : '#64748b',
                border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
              }}>{t}</button>
            ))}
            <button onClick={() => setShowPanel(v => !v)} style={{
              padding: '3px 8px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
              background: showPanel ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
              color: showPanel ? '#ef4444' : '#64748b',
              border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer',
            }}>
              {showPanel ? 'Hide Panel' : 'Show Panel'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Map + Panel ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[22.5, 80.5]} zoom={5} minZoom={4} maxZoom={14}
          maxBounds={[[5.0, 63.0], [38.0, 100.0]]}
          maxBoundsViscosity={0.8}
          style={{ height: '100%', width: '100%', background: '#02040f' }}
        >
          <TileLayer key={tileKey} url={MAP_TILES[tileKey]} attribution="DRISHTI · © CARTO · © OpenStreetMap" />
          <TileLayer url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png" opacity={0.2} />

          {/* Corridors */}
          {Object.entries(CORRIDORS).map(([name, pts]) => (
            <div key={name}>
              <Polyline positions={pts} pathOptions={{ color: '#1d4ed8', weight: 6, opacity: 0.1 }} />
              <Polyline positions={pts} pathOptions={{ color: '#60a5fa', weight: 1.5, opacity: 0.55, dashArray: '5 8' }} />
            </div>
          ))}

          {/* ── Historical Incidents ───────────────────────────────────────── */}
          {showIncidents && visibleIncidents.filter(i => i.lat && i.lng).map(inc => {
            const col = CAUSE_COLOR[inc.cause_category] || '#ef4444'
            const r = Math.max(8, Math.min(28, inc.deaths / 18))
            const isSelected = selectedInc?.accident_id === inc.accident_id
            const isMassive = inc.deaths >= 200

            return (
              <div key={inc.accident_id}>
                {/* Outer glow ring */}
                <CircleMarker
                  center={[inc.lat, inc.lng]}
                  radius={r + 10}
                  pathOptions={{
                    color: col, fillColor: col,
                    fillOpacity: isMassive ? 0.06 : 0.03,
                    weight: isMassive ? 1.5 : 1, opacity: 0.35,
                    dashArray: '3 5',
                  }}
                />
                {/* Main marker — diamond-like (square rotated via large radius + opacity) */}
                <CircleMarker
                  center={[inc.lat, inc.lng]}
                  radius={r}
                  pathOptions={{ color: col, fillColor: col, fillOpacity: isSelected ? 0.95 : 0.7, weight: 2, opacity: 1 }}
                  eventHandlers={{ click: () => setSelectedInc(isSelected ? null : inc) }}
                >
                  <Popup className="drishti-popup" maxWidth={300}>
                    <IncidentPopup inc={inc} />
                  </Popup>
                </CircleMarker>
              </div>
            )
          })}

          {/* ── Live Network Nodes ─────────────────────────────────────────── */}
          {showNetwork && visibleNodes.filter(n => n.lat && n.lng).map(node => {
            const col    = stressColor(node.stress_level)
            const radius = Math.max(5, (node.centrality || 0.3) * 22)
            const isCrit = node.stress_level === 'CRITICAL'
            const isHigh = node.stress_level === 'HIGH'
            const hasSig = (node.signature_match_pct || 0) > 55

            return (
              <div key={node.id}>
                {(isCrit || isHigh || hasSig) && (
                  <CircleMarker
                    center={[node.lat, node.lng]}
                    radius={radius + 7}
                    pathOptions={{ color: col, fillColor: col, fillOpacity: 0.05, weight: 1, opacity: 0.25 }}
                  />
                )}
                <CircleMarker
                  center={[node.lat, node.lng]}
                  radius={radius}
                  pathOptions={{
                    color: col, fillColor: col,
                    fillOpacity: isCrit ? 0.85 : isHigh ? 0.7 : 0.5,
                    weight: isCrit ? 2 : 1, opacity: 0.9,
                  }}
                >
                  <Popup className="drishti-popup" maxWidth={280}>
                    <NodePopup node={node} />
                  </Popup>
                </CircleMarker>
              </div>
            )
          })}
        </MapContainer>

        {/* ── Incident Panel ─────────────────────────────────────────────── */}
        {showPanel && showIncidents && (
          <IncidentPanel
            incidents={visibleIncidents}
            selected={selectedInc}
            onSelect={setSelectedInc}
          />
        )}

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 24, left: 16, zIndex: 1000,
          background: 'rgba(4,7,26,0.92)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '12px 16px', minWidth: 180,
        }}>
          {showNetwork && (
            <>
              <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Live Network
              </div>
              {[['#3b82f6','Stable Junction'],['#eab308','Medium Stress'],['#f97316','High Stress'],['#ef4444','Critical / Cascade']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, background: c, borderRadius: '50%', boxShadow: `0 0 5px ${c}` }} />
                  <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{l}</span>
                </div>
              ))}
            </>
          )}
          {showIncidents && (
            <>
              <div style={{ borderTop: showNetwork ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: showNetwork ? 8 : 0, marginTop: showNetwork ? 8 : 0, fontSize: '0.58rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Historical Incidents
              </div>
              {Object.entries(CAUSE_COLOR).slice(0, 5).map(([k, c]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, background: c, borderRadius: '50%', boxShadow: `0 0 5px ${c}` }} />
                  <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>{CAUSE_LABEL[k]}</span>
                </div>
              ))}
              <div style={{ fontSize: '0.58rem', color: '#475569', marginTop: 6 }}>
                Circle size = death toll
              </div>
            </>
          )}
        </div>

        {/* ── Critical banner ─────────────────────────────────────────────── */}
        {critCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 24,
            left: showPanel && showIncidents ? '50%' : '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000, background: '#dc2626', color: '#fff',
            padding: '9px 22px', borderRadius: 30,
            fontWeight: 800, fontSize: '0.78rem',
            boxShadow: '0 4px 24px rgba(239,68,68,0.5)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            ⚑ {critCount} CRITICAL CASCADE NODE{critCount > 1 ? 'S' : ''} ACTIVE
          </div>
        )}
      </div>
    </div>
  )
}
