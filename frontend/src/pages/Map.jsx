import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Layers, Filter, Compass, Navigation } from 'lucide-react'

// --- GEO-DATA: The Core Network (Golden Quadrilateral & Diagonals) ---
// High-density waypoints mimicking actual topographical IRCTC rail alignments
const S = {
  // Hubs
  NDLS: [28.6430, 77.2185], JHS: [25.4604, 78.5772], ET: [22.6111, 77.7601], 
  NGP: [21.1472, 79.0881], BZA: [16.5062, 80.6480], MAS: [13.0827, 80.2707],
  MMCT: [18.9696, 72.8194], HWH: [22.5841, 88.3435],
  // North-South In-betweens
  AGC: [27.1767, 78.0081], GWL: [26.2183, 78.1828], BPL: [23.2599, 77.4126], 
  BPQ: [19.8488, 79.3564], WL: [17.9818, 79.5960], OGL: [15.5057, 80.0499], NLR: [14.4426, 79.9865],
  // West-East In-betweens
  KYN: [19.2396, 73.1360], IGP: [19.6974, 73.5539], NK: [19.9975, 73.7898], MMR: [20.2520, 74.4371],
  BSL: [21.0455, 75.7725], AK: [20.7059, 77.0058], BD: [20.8653, 77.7479], G: [21.4624, 80.1961],
  DURG: [21.1891, 81.2849], R: [21.2514, 81.6296], BSP: [22.0797, 82.1409], JSG: [21.8601, 84.0505],
  ROU: [22.2511, 84.8582], CKP: [22.6841, 85.6267], TATA: [22.7720, 86.2081], KGP: [22.3396, 87.3204],
  // East Coast In-betweens
  BLS: [21.4934, 86.9337], BHC: [21.0553, 86.4977], CTC: [20.4625, 85.8828], BUB: [20.2961, 85.8245],
  KUR: [20.1534, 85.6268], BAM: [19.3149, 84.7941], VZM: [18.1133, 83.3977], VSKP: [17.6868, 83.2185],
  RJY: [17.0005, 81.8040],
  // West Corridor In-betweens
  RE: [28.1923, 76.6212], AWR: [27.5530, 76.6346], JP: [26.9196, 75.7878], AII: [26.4499, 74.6399],
  MJ: [25.7275, 73.6067], ABR: [24.4789, 72.7766], PNU: [24.1718, 72.4334], MSH: [23.5880, 72.3693],
  ADI: [23.0256, 72.5977], BRC: [22.3072, 73.1812], ST: [21.1702, 72.8311], VAPI: [20.3705, 72.9048], 
  BVI: [19.2307, 72.8567]
}

// Actual rail corridor approximations curving safely across landmass
const RUT = {
  northSouth: [S.NDLS, S.AGC, S.GWL, S.JHS, S.BPL, S.ET, S.NGP, S.BPQ, S.WL, S.BZA, S.OGL, S.NLR, S.MAS],
  westEast: [S.MMCT, S.KYN, S.IGP, S.NK, S.MMR, S.BSL, S.AK, S.BD, S.NGP, S.G, S.DURG, S.R, S.BSP, S.JSG, S.ROU, S.CKP, S.TATA, S.KGP, S.HWH],
  eastCoast: [S.HWH, S.KGP, S.BLS, S.BHC, S.CTC, S.BUB, S.KUR, S.BAM, S.VZM, S.VSKP, S.RJY, S.BZA, S.OGL, S.NLR, S.MAS],
  westCorridor: [S.NDLS, S.RE, S.AWR, S.JP, S.AII, S.MJ, S.ABR, S.PNU, S.MSH, S.ADI, S.BRC, S.ST, S.VAPI, S.BVI, S.MMCT]
}
const ALL_TRACKS = Object.values(RUT)

const RISKS = {
  CRITICAL: { col: '#ef4444', speed: 0.1 }, // Critical trains creep or halt
  HIGH:     { col: '#f97316', speed: 0.4 }, // Delayed speed
  MEDIUM:   { col: '#eab308', speed: 0.8 },
  LOW:      { col: '#22c55e', speed: 1.0 }, // Operating 110km/h
}

const MAP_TILES = {
  dark:     'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  gmap:     'https://mt1.google.com/vt/lyrs=m,transit&x={x}&y={y}&z={z}',
  gterrain: 'https://mt1.google.com/vt/lyrs=p,transit&x={x}&y={y}&z={z}',
}

// SVG Locomotive marker
const getTrainIcon = (color, isCritical) => new L.DivIcon({
  className: 'custom-loco-icon',
  html: `<div style="
          background-color: ${color}; 
          width: 20px; height: 20px; 
          display: flex; align-items: center; justify-content: center; 
          border-radius: 50%; 
          border: 2px solid ${isCritical ? '#fff' : 'rgba(255,255,255,0.8)'}; 
          box-shadow: 0 0 ${isCritical ? '20px 4px' : '8px'} ${color};
          transition: all 1s linear;">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${isCritical ? '#000' : '#1e293b'}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
         </div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10]
})

// Native JS lerp math
function lerpPosition(p1, p2, ratio) {
  return [p1[0] + (p2[0] - p1[0]) * ratio, p1[1] + (p2[1] - p1[1]) * ratio]
}

// -------------------------------------------------------------
// The Live Tracking Controller
// Receives the exact physics ratio from the Python Redis Daemon
// -------------------------------------------------------------
function SimulatedKafkaTrain({ train_id, routeKey, currentRatio, severity, trainName }) {
  const line = RUT[routeKey]
  const isCrit = severity === 'CRITICAL'
  const col = RISKS[severity]?.col || '#22c55e'

  // We no longer simulate locally! The python daemon provides pristine coordinates over Redis.
  const ratio = currentRatio || 0

  // Map 0-1 ratio to a specific line segment visually
  const totalWaypoints = line.length
  const pseudoIndex = ratio * (totalWaypoints - 1)
  const idx = Math.floor(pseudoIndex)
  const remainder = pseudoIndex - idx
  
  const currentPos = idx < totalWaypoints - 1 
    ? lerpPosition(line[idx], line[idx+1], remainder)
    : line[idx]

  return (
    <Marker position={currentPos} icon={getTrainIcon(col, isCrit)}>
      <Popup className="drishti-popup">
        <div style={{ padding: 12, minWidth: 220, fontFamily: 'var(--mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontWeight: 800, color: col }}>{train_id}</span>
            <span style={{ fontSize: '0.65rem', border: `1px solid ${col}`, padding: '1px 5px', borderRadius: 4, color: col }}>{severity}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--t2)', marginBottom: 4 }}>
            GPS Lock: {currentPos[0].toFixed(3)}N, {currentPos[1].toFixed(3)}E
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--t2)', marginBottom: 8 }}>
            Corridor: <strong style={{color:'var(--t1)'}}>{routeKey.toUpperCase()}</strong>
          </div>
          <Link to={`/train/${train_id}`} onClick={(e) => isCrit && e.preventDefault()} style={{
            display: 'block', textAlign: 'center', background: isCrit ? 'var(--red)' : 'var(--blue-gg)',
            color: isCrit ? '#fff' : 'var(--blue)', fontSize: '0.7rem', padding: '6px', borderRadius: 4, fontWeight: 700
          }}>
            {isCrit ? 'CASCADE LOCKOUT: STOPPED' : 'TRACK TELEMETRY ->'}
          </Link>
        </div>
      </Popup>
    </Marker>
  )
}


export default function NetworkMap() {
  const [tileKey, setTileKey] = useState('dark')
  const [filter, setFilter] = useState('ALL')
  const [trains, setTrains] = useState([])

  // Subscribe exclusively to the DevOps Server Python Pipeline over WS
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/live`)
    
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      // Plumb into the DevOps stream Native WebSocket feed!
      if (msg.type === 'telemetry') {
        // payload is an array of train state snapshots
        setTrains(msg.data)
      }
    }
    return () => ws.close()
  }, [])

  const visible = filter === 'ALL' ? trains : trains.filter(t => t.severity === filter)
  const critCounts = trains.filter(t => t.severity === 'CRITICAL').length

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* DARPA UI Header */}
      <div style={{
        padding: '12px 20px', background: '#02040f', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10
      }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Navigation size={18} color="var(--blue)" />
            LIVE FLEET TELEMETRY
          </h2>
          <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: 2 }}>
            Awaiting Kafka stream... Currently tracking {trains.length} targets on {Object.keys(RUT).length} active geometric corridors.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* Status Filters */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={filter === f ? 'active-filter' : ''} style={{
                padding: '4px 10px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700,
                background: filter === f ? 'var(--blue-g)' : 'var(--card)',
                color: filter === f ? 'var(--blue)' : 'var(--t3)',
                border: `1px solid ${filter === f ? 'var(--blue-b)' : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.2s'
              }}>
                {f} ({f === 'ALL' ? trains.length : trains.filter(t => t.severity === f).length})
              </button>
            ))}
          </div>

          {/* Tile Selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.keys(MAP_TILES).map(t => (
              <button key={t} onClick={() => setTileKey(t)} style={{
                padding: '4px 8px', borderRadius: 4, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                background: tileKey === t ? 'var(--t1)' : 'transparent',
                color: tileKey === t ? '#000' : 'var(--t3)', border: '1px solid var(--border)', cursor: 'pointer'
              }}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* The Geographic Engine */}
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={[22.5, 79.0]} zoom={5.4} maxBounds={[[6.5, 68.0], [35.5, 97.0]]} style={{ height: '100%', width: '100%', background: '#02040f' }} zoomControl={false}>
          {/* The Base Map (Carto Dark) */}
          <TileLayer key={tileKey} url={MAP_TILES[tileKey]} attribution="DRISHTI Geo-Intelligence | © OpenStreetMap contributors" />
          
          {/* Authentic OpenRailwayMap Overlay highlighting every explicit physical track in India */}
          <TileLayer url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png" opacity={0.35} />

          {/* Layer 1: The Drawn Railway Network Lines */}
          {ALL_TRACKS.map((points, i) => (
            <div key={i}>
              {/* Glow backdrop layer for lines */}
              <Polyline positions={points} pathOptions={{ color: '#2563eb', weight: 8, opacity: 0.15 }} />
              {/* Thin sharp line */}
              <Polyline positions={points} pathOptions={{ color: '#60a5fa', weight: 2, opacity: 0.8, dashArray: '4 6' }} />
            </div>
          ))}

          {/* Layer 2: The Network-Synchronized Locomotives */}
          {visible.map(t => (
            <SimulatedKafkaTrain 
              key={t.id} 
              train_id={t.id} 
              routeKey={t.routeKey} 
              currentRatio={t.ratio} 
              severity={t.severity} 
            />
          ))}
        </MapContainer>

        {/* Floating Health HUD */}
        {critCounts > 0 && (
          <div style={{
            position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
            background: 'var(--red)', color: '#fff', padding: '10px 24px', borderRadius: 30,
            fontWeight: 800, fontSize: '0.85rem', boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
            display: 'flex', alignItems: 'center', gap: 10, animation: 'pulse-red 2s infinite'
          }}>
            <Navigation size={16} /> 
            {critCounts} CASCADE EVENTS DETECTED ON TRACK. ENGAGING DE-ESCALATION.
          </div>
        )}
        
      </div>
    </div>
  )
}
