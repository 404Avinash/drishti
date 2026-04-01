import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from 'react-leaflet'
import { Link } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import { Navigation, Shield, Layers, AlertTriangle, TrendingUp } from 'lucide-react'

// ── Colour helpers ────────────────────────────────────────────────────────────
const stressColor = s => ({
  LOW:      '#3b82f6',
  MEDIUM:   '#eab308',
  HIGH:     '#f97316',
  CRITICAL: '#ef4444',
}[s] || '#3b82f6')

const stressGlow = s => ({
  LOW:      '0 0 6px rgba(59,130,246,0.5)',
  MEDIUM:   '0 0 8px rgba(234,179,8,0.5)',
  HIGH:     '0 0 10px rgba(249,115,22,0.6)',
  CRITICAL: '0 0 14px rgba(239,68,68,0.8)',
}[s] || 'none')

// Real Indian Railways corridors (lat/lng waypoints)
const CORRIDORS = {
  'Golden Quadrilateral N-S': [
    [28.64, 77.22], [27.18, 78.01], [26.22, 78.17], [25.45, 78.60],
    [23.18, 77.41], [22.19, 77.69], [21.15, 79.09], [17.43, 78.50],
    [16.51, 80.65], [13.03, 80.19],
  ],
  'Golden Quadrilateral E-W': [
    [18.97, 72.82], [22.31, 73.19], [23.03, 72.57], [18.97, 72.82],
    [18.98, 72.83], [22.60, 88.30],
  ],
  'East Coast Corridor': [
    [22.60, 88.30], [22.34, 87.32], [21.49, 86.93], [20.25, 85.83],
    [17.69, 83.22], [16.99, 81.79], [16.51, 80.65], [13.03, 80.19],
  ],
  'Western Corridor': [
    [28.64, 77.22], [26.91, 75.79], [26.46, 74.63], [23.03, 72.57],
    [22.31, 73.19], [18.97, 72.82],
  ],
}



// ── Popup Content ─────────────────────────────────────────────────────────────
function NodePopup({ node }) {
  const pct = node.signature_match_pct || 0
  const col = stressColor(node.stress_level)

  return (
    <div style={{ padding: 14, minWidth: 240, fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', color: '#f1f5f9' }}>
      {/* Header */}
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
        }}>
          {node.stress_level}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
        {[
          { label: 'Centrality Rank', val: `Top ${Math.round((node.risk_rank / 51) * 100)}%`, col },
          { label: 'Current Delay',   val: `${node.delay_minutes || 0} min`, col: node.delay_minutes > 45 ? '#f97316' : '#94a3b8' },
          { label: 'Cascade Risk',    val: `${((node.cascade_risk || 0) * 100).toFixed(0)}%`, col: node.cascade_risk > 0.5 ? '#ef4444' : '#94a3b8' },
          { label: 'CRS Accidents',   val: node.accident_count > 0 ? `${node.accident_count} on record` : 'None on record', col: node.accident_count > 0 ? '#ef4444' : '#64748b' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontWeight: 700, color: m.col, fontSize: '0.8rem' }}>{m.val}</div>
          </div>
        ))}
      </div>

      {/* CRS Signature Match */}
      {node.signature_accident_name && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 6, padding: '7px 10px', marginBottom: 10,
        }}>
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

      {/* Match % bar */}
      {pct > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6rem', color: '#64748b', marginBottom: 4 }}>
            <span>Historical Pattern Match</span><span>{pct}%</span>
          </div>
          <div style={{ background: '#1e293b', borderRadius: 4, height: 5, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%',
              background: pct > 75 ? '#ef4444' : pct > 50 ? '#f97316' : '#eab308',
              borderRadius: 4,
            }} />
          </div>
        </div>
      )}

      <Link
        to={`/alerts?station=${node.id}`}
        style={{
          display: 'block', textAlign: 'center', padding: '6px',
          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
          color: '#3b82f6', borderRadius: 5, fontSize: '0.7rem', fontWeight: 700,
        }}
      >
        View Alerts for {node.id} →
      </Link>
    </div>
  )
}

// ── Main: Network Map Page ────────────────────────────────────────────────────
export default function NetworkMap() {
  const [nodes, setNodes] = useState([])
  const [tileKey, setTileKey] = useState('dark')
  const [filter, setFilter] = useState('ALL')
  const [showCriticalOnly, setShowCriticalOnly] = useState(false)

  const MAP_TILES = {
    dark:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    terrain: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    rail:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  }

  // Load static graph topology
  useEffect(() => {
    fetch('/network_graph.json')
      .then(r => r.json())
      .then(d => setNodes(d.graph?.nodes || []))
      .catch(() => {})
  }, [])

  // Subscribe to live stress updates
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.hostname}:8000/ws/live`)

    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'network_pulse' && msg.data?.nodes) {
        setNodes(prev => {
          const liveMap = {}
          msg.data.nodes.forEach(n => { liveMap[n.id] = n })
          return prev.map(n => liveMap[n.id] ? { ...n, ...liveMap[n.id] } : n)
        })
      }
    }

    return () => ws.close()
  }, [])

  const visibleNodes = useMemo(() => {
    let list = nodes
    if (showCriticalOnly)  list = list.filter(n => n.stress_level === 'CRITICAL' || n.stress_level === 'HIGH')
    if (filter !== 'ALL')  list = list.filter(n => n.stress_level === filter)
    return list
  }, [nodes, filter, showCriticalOnly])

  const critCount        = nodes.filter(n => n.stress_level === 'CRITICAL').length
  const highCount        = nodes.filter(n => n.stress_level === 'HIGH').length
  const signatureMatches = nodes.filter(n => (n.signature_match_pct || 0) > 60).length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 20px', background: 'rgba(4,7,26,0.95)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backdropFilter: 'blur(12px)',
      }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Navigation size={16} color="var(--blue)" />
            Network Map — {nodes.length} Junction Intelligence Overlay
          </h2>
          <div style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 2 }}>
            Node size = betweenness centrality · Color = live operational stress · Circle glow = cascade risk
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* Status counts */}
          <div style={{ display: 'flex', gap: 12, fontSize: '0.72rem' }}>
            {[
              { label: '🔴 Critical', val: critCount },
              { label: '🟠 High', val: highCount },
              { label: '⚠ CRS Matches', val: signatureMatches },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ color: 'var(--t3)' }}>{s.label}:</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: '0.6rem', fontWeight: 700,
                  background: filter === f ? 'var(--blue-g)' : 'var(--card)',
                  color: filter === f ? 'var(--blue)' : 'var(--t3)',
                  border: `1px solid ${filter === f ? 'var(--blue-b)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Tile selector */}
          <div style={{ display: 'flex', gap: 3 }}>
            {Object.keys(MAP_TILES).map(t => (
              <button
                key={t}
                onClick={() => setTileKey(t)}
                style={{
                  padding: '3px 8px', borderRadius: 4, fontSize: '0.6rem',
                  fontWeight: 700, textTransform: 'uppercase',
                  background: tileKey === t ? 'var(--t1)' : 'transparent',
                  color: tileKey === t ? '#000' : 'var(--t3)',
                  border: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Map ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[22.5, 80.5]}
          zoom={5}
          minZoom={4}
          maxZoom={14}
          maxBounds={[[5.0, 63.0], [38.0, 100.0]]}
          maxBoundsViscosity={0.8}
          style={{ height: '100%', width: '100%', background: '#02040f' }}
          zoomControl={true}
        >

          {/* Base tile */}
          <TileLayer key={tileKey} url={MAP_TILES[tileKey]} attribution="DRISHTI · © CARTO · © OpenStreetMap" />

          {/* OpenRailwayMap overlay */}
          <TileLayer url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png" opacity={0.25} />

          {/* Golden Quadrilateral corridors */}
          {Object.entries(CORRIDORS).map(([name, pts]) => (
            <div key={name}>
              <Polyline positions={pts} pathOptions={{ color: '#1d4ed8', weight: 6, opacity: 0.12 }} />
              <Polyline positions={pts} pathOptions={{ color: '#60a5fa', weight: 1.5, opacity: 0.7, dashArray: '5 7' }} />
            </div>
          ))}

          {/* Station nodes */}
          {visibleNodes.filter(n => n.lat && n.lng).map(node => {
            const col     = stressColor(node.stress_level)
            const radius  = Math.max(5, (node.centrality || 0.3) * 22)
            const isCrit  = node.stress_level === 'CRITICAL'
            const isHigh  = node.stress_level === 'HIGH'
            const hasSig  = (node.signature_match_pct || 0) > 55

            return (
              <div key={node.id}>
                {/* Glow ring for high-risk nodes */}
                {(isCrit || isHigh || hasSig) && (
                  <CircleMarker
                    center={[node.lat, node.lng]}
                    radius={radius + 7}
                    pathOptions={{
                      color: col, fillColor: col,
                      fillOpacity: 0.06, weight: 1, opacity: 0.3,
                    }}
                  />
                )}

                {/* Main node */}
                <CircleMarker
                  center={[node.lat, node.lng]}
                  radius={radius}
                  pathOptions={{
                    color: col,
                    fillColor: col,
                    fillOpacity: isCrit ? 0.85 : isHigh ? 0.70 : 0.55,
                    weight: isCrit ? 2 : 1,
                    opacity: 0.9,
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

        {/* Floating legend */}
        <div style={{
          position: 'absolute', bottom: 24, left: 16, zIndex: 1000,
          background: 'rgba(4,7,26,0.9)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '12px 16px',
        }}>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            Network Legend
          </div>
          {[
            ['#3b82f6', 'Stable Junction'],
            ['#eab308', 'Medium Stress'],
            ['#f97316', 'High Stress'],
            ['#ef4444', 'Critical / Cascade'],
          ].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, background: c, borderRadius: '50%', boxShadow: `0 0 6px ${c}` }} />
              <span style={{ fontSize: '0.68rem', color: 'var(--t2)' }}>{l}</span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 8, paddingTop: 8, fontSize: '0.62rem', color: 'var(--t3)' }}>
            Circle size = betweenness centrality
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--t3)', marginTop: 2 }}>
            Glow ring = CRS accident signature detected
          </div>
        </div>

        {/* Critical alert banner */}
        {critCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, background: 'var(--red)', color: '#fff',
            padding: '9px 22px', borderRadius: 30,
            fontWeight: 800, fontSize: '0.82rem',
            boxShadow: '0 4px 24px rgba(239,68,68,0.5)',
            display: 'flex', alignItems: 'center', gap: 10,
            animation: 'pulseGlow 1.5s infinite',
          }}>
            <AlertTriangle size={15} />
            {critCount} CRITICAL CASCADE NODE{critCount > 1 ? 'S' : ''} — Zone controllers alerted
          </div>
        )}
      </div>
    </div>
  )
}
