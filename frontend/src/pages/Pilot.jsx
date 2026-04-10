/**
 * DRISHTI — Howrah Zone Pilot
 * Live train tracking for 5 Eastern Railway zones.
 *
 * WebSocket receives { type:"telemetry", data:[{id,lat,lng,speed,delay,severity}] }
 * from the producer, and renders each train as a moving marker on the map.
 *
 * Zones covered: ER · SER · ECR · ECoR · NFR
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Popup, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// ── Zone definitions ──────────────────────────────────────────────────────────
const ZONES = {
  ER:   { name: 'Eastern Railway',          color: '#3b82f6', center: [24.5, 87.5] },
  SER:  { name: 'South Eastern Railway',    color: '#10b981', center: [22.0, 86.0] },
  ECR:  { name: 'East Central Railway',     color: '#f59e0b', center: [25.5, 84.5] },
  ECoR: { name: 'East Coast Railway',       color: '#8b5cf6', center: [20.5, 85.5] },
  NFR:  { name: 'North Frontier Railway',   color: '#ef4444', center: [26.5, 92.5] },
}

// ── Real station coordinates for Howrah zone corridors ───────────────────────
const STATIONS = {
  // ER — Eastern Railway (Howrah division)
  HWH:  { lat: 22.5841, lng: 88.3435, zone: 'ER',   name: 'Howrah Jn' },
  ASN:  { lat: 23.6830, lng: 86.9880, zone: 'ER',   name: 'Asansol Jn' },
  DKAE: { lat: 23.7982, lng: 86.4267, zone: 'ER',   name: 'Dhanbad Jn' },
  MGS:  { lat: 25.2819, lng: 83.1199, zone: 'ER',   name: 'Mughal Sarai' },
  PNBE: { lat: 25.6022, lng: 85.1376, zone: 'ECR',  name: 'Patna Jn' },
  // SER — South Eastern Railway
  KGP:  { lat: 22.3396, lng: 87.3204, zone: 'SER',  name: 'Kharagpur Jn' },
  TATA: { lat: 22.7720, lng: 86.2081, zone: 'SER',  name: 'Tatanagar' },
  ROU:  { lat: 22.2511, lng: 84.8582, zone: 'SER',  name: 'Rourkela' },
  JSG:  { lat: 21.8601, lng: 84.0505, zone: 'SER',  name: 'Jharsuguda' },
  BSP:  { lat: 22.0797, lng: 82.1409, zone: 'SER',  name: 'Bilaspur' },
  // ECR — East Central Railway
  DHN:  { lat: 23.7993, lng: 86.4303, zone: 'ECR',  name: 'Dhanbad' },
  GAYA: { lat: 24.7955, lng: 84.9994, zone: 'ECR',  name: 'Gaya Jn' },
  DDU:  { lat: 25.2819, lng: 83.1199, zone: 'ECR',  name: 'Pt. DD Upadhyaya Jn' },
  // ECoR — East Coast Railway
  BBS:  { lat: 20.2961, lng: 85.8245, zone: 'ECoR', name: 'Bhubaneswar' },
  CTC:  { lat: 20.4625, lng: 85.8828, zone: 'ECoR', name: 'Cuttack' },
  PURI: { lat: 19.8134, lng: 85.8315, zone: 'ECoR', name: 'Puri' },
  BLS:  { lat: 21.4934, lng: 86.9337, zone: 'ECoR', name: 'Balasore' },
  VSKP: { lat: 17.6868, lng: 83.2185, zone: 'ECoR', name: 'Visakhapatnam' },
  // NFR — North Frontier Railway
  GHY:  { lat: 26.1445, lng: 91.7362, zone: 'NFR',  name: 'Guwahati' },
  NJP:  { lat: 26.7043, lng: 88.3638, zone: 'NFR',  name: 'New Jalpaiguri' },
  DBRG: { lat: 27.4728, lng: 94.9120, zone: 'NFR',  name: 'Dibrugarh' },
  // Shared key junctions
  NDLS: { lat: 28.6431, lng: 77.2197, zone: 'NR',   name: 'New Delhi' },
  MAS:  { lat: 13.0288, lng: 80.1859, zone: 'SR',   name: 'Chennai Central' },
}

// ── Howrah-centric rail corridors (waypoints for interpolation) ───────────────
const CORRIDORS = {
  // ER: HWH → Asansol → Dhanbad → DDU → NDLS (Howrah-Delhi main line)
  'HWH-NDLS': [
    STATIONS.HWH, STATIONS.ASN, STATIONS.DHN, STATIONS.DDU, STATIONS.MGS,
    { lat: 25.4500, lng: 81.5000, zone: 'ER', name: 'Prayagraj' },
    { lat: 27.2000, lng: 78.0000, zone: 'NR', name: 'Agra' },
    STATIONS.NDLS,
  ],
  // SER: HWH → KGP → TATA → ROU → JSG → BSP (Mumbai corridor)
  'HWH-BSP':  [STATIONS.HWH, STATIONS.KGP, STATIONS.TATA, STATIONS.ROU, STATIONS.JSG, STATIONS.BSP],
  // ECoR: HWH → BLS → BBS → Puri (East Coast)
  'HWH-PURI': [STATIONS.HWH, STATIONS.KGP, STATIONS.BLS, STATIONS.BBS, STATIONS.PURI],
  // ECoR: HWH → BBS → VSKP → MAS (Coromandel)
  'HWH-MAS':  [
    STATIONS.HWH, STATIONS.KGP, STATIONS.BLS, STATIONS.BBS, STATIONS.CTC,
    { lat: 18.5, lng: 84.0, zone: 'ECoR', name: 'Vizianagaram' },
    STATIONS.VSKP, STATIONS.MAS,
  ],
  // NFR: HWH → NJP → GHY → DBRG (Northeast corridor)
  'HWH-GHY':  [
    STATIONS.HWH, STATIONS.ASN,
    { lat: 24.5, lng: 88.3, zone: 'ER', name: 'Berhampore' },
    STATIONS.NJP, STATIONS.GHY,
  ],
  'HWH-DBRG': [STATIONS.HWH, STATIONS.ASN, STATIONS.NJP, STATIONS.GHY, STATIONS.DBRG],
  // ECR: HWH → DHN → PNBE → DDU
  'HWH-PNBE': [STATIONS.HWH, STATIONS.ASN, STATIONS.DHN, STATIONS.GAYA, STATIONS.PNBE],
}

// ── Trains operating in Howrah zone ──────────────────────────────────────────
const HOWRAH_TRAINS = [
  // Rajdhani/Premier services
  { id: '12301', name: 'Howrah Rajdhani',       corridor: 'HWH-NDLS', zone: 'ER',   dir: 1 },
  { id: '12302', name: 'New Delhi Rajdhani',     corridor: 'HWH-NDLS', zone: 'ER',   dir: 0 },
  { id: '12273', name: 'Howrah Duronto',         corridor: 'HWH-NDLS', zone: 'ER',   dir: 1 },
  { id: '12274', name: 'Delhi Duronto',          corridor: 'HWH-NDLS', zone: 'ER',   dir: 0 },
  // Coromandel / East Coast
  { id: '12841', name: 'Coromandel Express',     corridor: 'HWH-MAS',  zone: 'ECoR', dir: 1 },
  { id: '12842', name: 'Coromandel (Return)',    corridor: 'HWH-MAS',  zone: 'ECoR', dir: 0 },
  { id: '12703', name: 'Falaknuma Express',      corridor: 'HWH-MAS',  zone: 'ECoR', dir: 1 },
  { id: '12864', name: 'Yesvantpur Express',     corridor: 'HWH-MAS',  zone: 'ECoR', dir: 0 },
  // Puri corridor
  { id: '12801', name: 'Purushottam Express',    corridor: 'HWH-PURI', zone: 'ECoR', dir: 1 },
  { id: '12802', name: 'Purushottam (Return)',   corridor: 'HWH-PURI', zone: 'ECoR', dir: 0 },
  { id: '18409', name: 'Shri Jagannath Exp',     corridor: 'HWH-PURI', zone: 'ECoR', dir: 1 },
  // Northeast
  { id: '12423', name: 'Dibrugarh Rajdhani',     corridor: 'HWH-DBRG', zone: 'NFR',  dir: 1 },
  { id: '12424', name: 'Dibrugarh (Return)',     corridor: 'HWH-DBRG', zone: 'NFR',  dir: 0 },
  { id: '12345', name: 'Saraighat Express',      corridor: 'HWH-GHY',  zone: 'NFR',  dir: 1 },
  { id: '12346', name: 'Saraighat (Return)',     corridor: 'HWH-GHY',  zone: 'NFR',  dir: 0 },
  // Bilaspur / SER
  { id: '18030', name: 'Shalimar-BSP Express',  corridor: 'HWH-BSP',  zone: 'SER',  dir: 1 },
  { id: '18029', name: 'BSP-Shalimar Express',  corridor: 'HWH-BSP',  zone: 'SER',  dir: 0 },
  { id: '12129', name: 'AZAD HIND Express',     corridor: 'HWH-BSP',  zone: 'SER',  dir: 1 },
  // Patna / ECR
  { id: '12381', name: 'Poorva Express',         corridor: 'HWH-PNBE', zone: 'ECR',  dir: 1 },
  { id: '12382', name: 'Poorva (Return)',        corridor: 'HWH-PNBE', zone: 'ECR',  dir: 0 },
  { id: '13005', name: 'Amritsar Mail',          corridor: 'HWH-NDLS', zone: 'ER',   dir: 1 },
  { id: '13006', name: 'Amritsar Mail (Rtn)',   corridor: 'HWH-NDLS', zone: 'ER',   dir: 0 },
  { id: '12259', name: 'Sealdah Duronto',        corridor: 'HWH-NDLS', zone: 'ER',   dir: 1 },
  { id: '12260', name: 'Sealdah Duronto (Rtn)', corridor: 'HWH-NDLS', zone: 'ER',   dir: 0 },
  { id: '15959', name: 'Kamrup Express',         corridor: 'HWH-GHY',  zone: 'NFR',  dir: 1 },
  { id: '15960', name: 'Kamrup (Return)',        corridor: 'HWH-GHY',  zone: 'NFR',  dir: 0 },
  { id: '12375', name: 'Padatik Express',        corridor: 'HWH-NDLS', zone: 'ER',   dir: 1 },
  { id: '18001', name: 'Jagdalpur Express',      corridor: 'HWH-BSP',  zone: 'SER',  dir: 1 },
  { id: '12507', name: 'Guwahati-OKHA Exp',     corridor: 'HWH-GHY',  zone: 'NFR',  dir: 0 },
  { id: '12552', name: 'Kamakhya Express',       corridor: 'HWH-DBRG', zone: 'NFR',  dir: 1 },
]

// ── Severity config ───────────────────────────────────────────────────────────
const SEV = {
  CRITICAL: { color: '#ef4444', glow: '#ef444466', speed: 20 + Math.random() * 30 },
  HIGH:     { color: '#f97316', glow: '#f9731666', speed: 60 + Math.random() * 40 },
  MEDIUM:   { color: '#eab308', glow: '#eab30866', speed: 80 + Math.random() * 40 },
  LOW:      { color: '#3b82f6', glow: '#3b82f666', speed: 100 + Math.random() * 60 },
}
const getSeverityColor = s => SEV[s]?.color || '#3b82f6'

// ── Lerp along a corridor polyline ────────────────────────────────────────────
function interpolateCorridor(waypoints, ratio) {
  if (!waypoints || waypoints.length < 2) return null
  const clamped = Math.max(0, Math.min(1, ratio))
  const n = waypoints.length - 1
  const idx = Math.floor(clamped * n)
  const local = (clamped * n) - idx
  if (idx >= n) return { lat: waypoints[n].lat, lng: waypoints[n].lng }
  const a = waypoints[idx], b = waypoints[idx + 1]
  return {
    lat: a.lat + (b.lat - a.lat) * local,
    lng: a.lng + (b.lng - a.lng) * local,
  }
}

// ── Zone Pressure Indicator ───────────────────────────────────────────────────
function ZonePressure({ zoneId, trains }) {
  const inZone = trains.filter(t => t.zone === zoneId)
  const critical = inZone.filter(t => t.severity === 'CRITICAL').length
  const high = inZone.filter(t => t.severity === 'HIGH').length
  const pressure = Math.min(100, ((critical * 4 + high * 2 + inZone.length) / (HOWRAH_TRAINS.length * 0.4)) * 100)
  const z = ZONES[zoneId]
  const col = critical > 0 ? '#ef4444' : high > 2 ? '#f97316' : z.color

  return (
    <div style={{
      background: 'rgba(4,7,26,0.92)', border: `1px solid ${col}33`,
      borderRadius: 8, padding: '10px 14px', minWidth: 170,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: '0.65rem', fontWeight: 800, color: col, letterSpacing: 1 }}>{zoneId}</div>
          <div style={{ fontSize: '0.55rem', color: '#64748b', marginTop: 1 }}>{z.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: col, fontFamily: 'IBM Plex Mono,monospace' }}>
            {inZone.length}
          </div>
          <div style={{ fontSize: '0.5rem', color: '#64748b' }}>trains</div>
        </div>
      </div>
      {/* Pressure bar */}
      <div style={{ background: '#1e293b', borderRadius: 3, height: 4, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%', borderRadius: 3, width: `${pressure}%`,
          background: `linear-gradient(90deg, ${col}, ${col}aa)`,
          transition: 'width 0.5s ease',
          boxShadow: `0 0 6px ${col}88`,
        }} />
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: '0.53rem', color: '#64748b' }}>
        {critical > 0 && <span style={{ color: '#ef4444' }}>⚑ {critical} CRIT</span>}
        {high > 0 && <span style={{ color: '#f97316' }}>▲ {high} HIGH</span>}
        <span style={{ marginLeft: 'auto', color: '#475569' }}>
          {pressure.toFixed(0)}% load
        </span>
      </div>
    </div>
  )
}

// ── Train popup card ───────────────────────────────────────────────────────────
function TrainCard({ train }) {
  const col = getSeverityColor(train.severity)
  const corridor = CORRIDORS[train.corridorKey] || []
  const origin = corridor[0]?.name || '—'
  const dest = corridor[corridor.length - 1]?.name || '—'

  return (
    <div style={{ padding: 10, minWidth: 220, fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: col }}>{train.name}</div>
          <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: 1 }}>#{train.id} · {train.zone}</div>
        </div>
        <div style={{
          padding: '2px 7px', borderRadius: 4,
          background: `${col}22`, border: `1px solid ${col}55`,
          color: col, fontSize: '0.6rem', fontWeight: 700,
        }}>
          {train.severity}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 8 }}>
        {[
          { label: 'Speed',   val: `${Math.round(train.speed || 0)} km/h`,  col: train.speed > 120 ? '#10b981' : '#94a3b8' },
          { label: 'Delay',   val: `+${Math.round(train.delay || 0)} min`,  col: train.delay > 30 ? '#f97316' : '#94a3b8' },
          { label: 'From',    val: origin,  col: '#94a3b8' },
          { label: 'To',      val: dest,    col: '#94a3b8' },
        ].map(m => (
          <div key={m.label}>
            <div style={{ fontSize: '0.52rem', color: '#64748b', marginBottom: 1 }}>{m.label}</div>
            <div style={{ fontWeight: 700, color: m.col, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.val}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 4, padding: '4px 7px', fontSize: '0.57rem', color: '#64748b' }}>
        Progress: {(train.ratio * 100).toFixed(1)}% along route
      </div>
    </div>
  )
}

// ── Main Pilot Component ───────────────────────────────────────────────────────
export default function HowrahZonePilot() {
  const [trainPositions, setTrainPositions] = useState(() =>
    // Initialize trains with spread ratios so they start at different points
    HOWRAH_TRAINS.map((t, i) => ({
      ...t,
      corridorKey: t.corridor,
      ratio: (i / HOWRAH_TRAINS.length),
      speed: 80 + Math.random() * 80,
      delay: Math.random() > 0.7 ? Math.round(Math.random() * 60) : 0,
      severity: ['LOW', 'LOW', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'CRITICAL'][Math.floor(Math.random() * 7)],
      lat: null, lng: null, connected: false,
    }))
  )

  const [wsStatus, setWsStatus] = useState('connecting')
  const [selectedZone, setSelectedZone] = useState(null)
  const [tick, setTick] = useState(0)
  const wsRef = useRef(null)
  const animRef = useRef(null)
  const trainStateRef = useRef(trainPositions)

  // Keep ref in sync with state
  useEffect(() => { trainStateRef.current = trainPositions }, [trainPositions])

  // ── Local physics animation (runs every 500ms to move trains smoothly) ───────
  useEffect(() => {
    const animate = () => {
      setTrainPositions(prev => prev.map(t => {
        const step = (0.0008 + Math.random() * 0.0004) * (t.dir === 1 ? 1 : -1)
        let ratio = t.ratio + step
        // Bounce at endpoints
        if (ratio >= 1) { ratio = 1 - (ratio - 1); t = { ...t, dir: t.dir === 1 ? 0 : 1 } }
        if (ratio <= 0) { ratio = Math.abs(ratio); t = { ...t, dir: t.dir === 1 ? 0 : 1 } }

        const corridor = CORRIDORS[t.corridorKey]
        const pos = interpolateCorridor(corridor, ratio)

        // Occasionally update severity
        const newSeverity = Math.random() > 0.995
          ? ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][Math.floor(Math.random() * 4)]
          : t.severity

        return {
          ...t, ratio, severity: newSeverity,
          lat: pos?.lat ?? t.lat,
          lng: pos?.lng ?? t.lng,
          speed: Math.max(0, Math.min(160, (t.speed || 100) + (Math.random() - 0.5) * 5)),
          delay: Math.max(0, (t.delay || 0) + (Math.random() > 0.95 ? (Math.random() > 0.5 ? 2 : -2) : 0)),
        }
      }))
      setTick(n => n + 1)
    }

    animRef.current = setInterval(animate, 800)
    return () => clearInterval(animRef.current)
  }, [])

  // ── WebSocket for real-time updates from server (enhances local animation) ───
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${proto}//${window.location.host}/ws`
    let ws, reconnect

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => setWsStatus('live')
        ws.onclose = () => {
          setWsStatus('reconnecting')
          reconnect = setTimeout(connect, 3000)
        }
        ws.onerror = () => setWsStatus('offline')

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data)
            if (msg.type === 'telemetry' && Array.isArray(msg.data)) {
              // Merge server telemetry into our train state
              const serverMap = {}
              msg.data.forEach(d => { serverMap[d.id] = d })

              setTrainPositions(prev => prev.map(t => {
                const srv = serverMap[t.id]
                if (!srv) return t
                const corridor = CORRIDORS[t.corridorKey]
                const ratio = srv.ratio !== undefined ? srv.ratio : t.ratio
                const pos = interpolateCorridor(corridor, ratio)
                return {
                  ...t, ratio,
                  severity: srv.severity || t.severity,
                  lat: pos?.lat ?? t.lat,
                  lng: pos?.lng ?? t.lng,
                  connected: true,
                }
              }))
            }
          } catch { /* ignore bad frames */ }
        }
      } catch { setWsStatus('offline') }
    }

    connect()
    return () => {
      clearTimeout(reconnect)
      try { ws?.close() } catch {}
    }
  }, [])

  // ── Derived zone stats ────────────────────────────────────────────────────────
  const zoneStats = useMemo(() => {
    const stats = {}
    Object.keys(ZONES).forEach(z => {
      const trains = trainPositions.filter(t => t.zone === z)
      stats[z] = {
        count: trains.length,
        critical: trains.filter(t => t.severity === 'CRITICAL').length,
        high: trains.filter(t => t.severity === 'HIGH').length,
        avgSpeed: trains.length ? (trains.reduce((s, t) => s + (t.speed || 0), 0) / trains.length) : 0,
        avgDelay: trains.length ? (trains.reduce((s, t) => s + (t.delay || 0), 0) / trains.length) : 0,
      }
    })
    return stats
  }, [tick])

  const criticalCount = trainPositions.filter(t => t.severity === 'CRITICAL').length
  const filteredTrains = selectedZone ? trainPositions.filter(t => t.zone === selectedZone) : trainPositions

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#02040f', fontFamily: 'Inter,sans-serif' }}>

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 18px', background: 'rgba(4,7,26,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: wsStatus === 'live' ? '#10b981' : wsStatus === 'reconnecting' ? '#f59e0b' : '#ef4444',
              boxShadow: wsStatus === 'live' ? '0 0 8px #10b981' : 'none',
              animation: wsStatus === 'live' ? 'pulse-dot 1.5s infinite' : 'none',
            }} />
            <h2 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: '#e2e8f0' }}>
              Howrah Zone — Live Command Centre
            </h2>
            <span style={{
              fontSize: '0.55rem', fontWeight: 700, padding: '2px 7px', borderRadius: 10,
              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
              color: '#3b82f6', letterSpacing: 1,
            }}>
              PILOT
            </span>
          </div>
          <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: 2 }}>
            {filteredTrains.length} trains tracked · 5 zones · ER · SER · ECR · ECoR · NFR
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* WS status */}
          <div style={{
            padding: '3px 9px', borderRadius: 5, fontSize: '0.6rem', fontWeight: 700,
            background: wsStatus === 'live' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
            color: wsStatus === 'live' ? '#10b981' : '#f59e0b',
            border: `1px solid ${wsStatus === 'live' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
          }}>
            {wsStatus === 'live' ? '⚡ WS LIVE' : wsStatus === 'reconnecting' ? '↻ RECONNECTING' : '○ LOCAL SIM'}
          </div>

          {/* Zone filter buttons */}
          <button onClick={() => setSelectedZone(null)} style={{
            padding: '3px 7px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, cursor: 'pointer',
            background: !selectedZone ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
            color: !selectedZone ? '#e2e8f0' : '#64748b',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>ALL ZONES</button>
          {Object.entries(ZONES).map(([zid, z]) => (
            <button key={zid} onClick={() => setSelectedZone(zid === selectedZone ? null : zid)} style={{
              padding: '3px 7px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, cursor: 'pointer',
              background: selectedZone === zid ? `${z.color}22` : 'rgba(255,255,255,0.04)',
              color: selectedZone === zid ? z.color : '#64748b',
              border: `1px solid ${selectedZone === zid ? z.color + '55' : 'rgba(255,255,255,0.08)'}`,
            }}>{zid}</button>
          ))}
        </div>
      </div>

      {/* ── Zone pressure strip ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 6, padding: '6px 18px',
        background: 'rgba(4,7,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)',
        overflowX: 'auto',
      }}>
        {Object.entries(ZONES).map(([zid, z]) => {
          const s = zoneStats[zid] || {}
          const col = s.critical > 0 ? '#ef4444' : s.high > 0 ? '#f97316' : z.color
          const pressure = Math.min(100, ((s.critical * 4 + (s.high || 0) * 2 + s.count) / (HOWRAH_TRAINS.length * 0.4)) * 100)
          return (
            <div key={zid} onClick={() => setSelectedZone(zid === selectedZone ? null : zid)} style={{
              flex: '1 1 0', minWidth: 130, cursor: 'pointer',
              background: selectedZone === zid ? `${col}11` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${selectedZone === zid ? col + '44' : 'rgba(255,255,255,0.06)'}`,
              borderRadius: 7, padding: '7px 10px', transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, color: col }}>{zid}</div>
                  <div style={{ fontSize: '0.5rem', color: '#475569' }}>{z.name.split(' ')[0]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 900, color: col, fontFamily: 'monospace' }}>{s.count || 0}</div>
                  <div style={{ fontSize: '0.47rem', color: '#475569' }}>trains</div>
                </div>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 2, height: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${pressure}%`, borderRadius: 2,
                  background: col, transition: 'width 1s ease',
                  boxShadow: s.critical > 0 ? `0 0 5px ${col}` : 'none',
                }} />
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 3, fontSize: '0.5rem' }}>
                {s.critical > 0 && <span style={{ color: '#ef4444' }}>⚑{s.critical}</span>}
                {s.high > 0 && <span style={{ color: '#f97316' }}>▲{s.high}</span>}
                <span style={{ color: '#475569', marginLeft: 'auto' }}>{(s.avgSpeed || 0).toFixed(0)} km/h avg</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Map + sidebar ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', overflow: 'hidden' }}>

        {/* Leaflet map */}
        <div style={{ flex: 1 }}>
          <MapContainer
            center={[23.5, 87.5]} zoom={6} minZoom={5} maxZoom={13}
            style={{ height: '100%', width: '100%', background: '#02040f' }}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="DRISHTI Pilot · © CARTO" />
            <TileLayer url="https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png" opacity={0.22} />

            {/* ── Rail corridors ─────────────────────────────────── */}
            {Object.entries(CORRIDORS).map(([key, waypoints]) => (
              <Polyline
                key={key}
                positions={waypoints.map(w => [w.lat, w.lng])}
                pathOptions={{ color: '#60a5fa', weight: 1.5, opacity: 0.35, dashArray: '6 8' }}
              />
            ))}

            {/* ── Station nodes ──────────────────────────────────── */}
            {Object.entries(STATIONS).filter(([, s]) => ['ER', 'SER', 'ECR', 'ECoR', 'NFR'].includes(s.zone)).map(([code, s]) => {
              const zColor = ZONES[s.zone]?.color || '#3b82f6'
              return (
                <CircleMarker key={code} center={[s.lat, s.lng]} radius={5}
                  pathOptions={{ color: zColor, fillColor: zColor, fillOpacity: 0.7, weight: 1.5 }}>
                  <Tooltip permanent={['HWH', 'KGP', 'GHY', 'PNBE', 'BBS', 'NJP'].includes(code)}
                    direction="top" offset={[0, -8]}
                    className="drishti-tooltip">
                    <span style={{ fontSize: '0.6rem', fontWeight: 700, color: zColor }}>{code}</span>
                  </Tooltip>
                  <Popup className="drishti-popup" maxWidth={200}>
                    <div style={{ padding: 8, fontFamily: 'Inter,sans-serif', color: '#f1f5f9', fontSize: '0.75rem' }}>
                      <div style={{ fontWeight: 800, color: zColor, marginBottom: 3 }}>{s.name}</div>
                      <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{s.zone} · {code}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })}

            {/* ── Live train markers ─────────────────────────────── */}
            {filteredTrains.filter(t => t.lat && t.lng).map(t => {
              const col = getSeverityColor(t.severity)
              const isCrit = t.severity === 'CRITICAL'
              const isHigh = t.severity === 'HIGH'

              return [
                // Pulse ring for critical/high
                (isCrit || isHigh) && (
                  <CircleMarker
                    key={`pulse-${t.id}`}
                    center={[t.lat, t.lng]}
                    radius={isCrit ? 14 : 11}
                    pathOptions={{ color: col, fillColor: col, fillOpacity: 0.07, weight: 1, opacity: 0.3 }}
                    interactive={false}
                  />
                ),
                // Train dot
                <CircleMarker
                  key={t.id}
                  center={[t.lat, t.lng]}
                  radius={isCrit ? 8 : isHigh ? 7 : 6}
                  pathOptions={{
                    color: '#fff', weight: 1.2,
                    fillColor: col, fillOpacity: isCrit ? 0.95 : 0.82,
                  }}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                    <span style={{
                      fontFamily: 'IBM Plex Mono,monospace', fontSize: '0.6rem',
                      color: col, fontWeight: 700,
                    }}>
                      {t.id} · {Math.round(t.speed)} km/h
                    </span>
                  </Tooltip>
                  <Popup className="drishti-popup" maxWidth={250}>
                    <TrainCard train={t} />
                  </Popup>
                </CircleMarker>,
              ].filter(Boolean)
            })}
          </MapContainer>
        </div>

        {/* ── Train list sidebar ─────────────────────────────────────────────── */}
        <div style={{
          width: 260, background: 'rgba(4,7,26,0.98)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#64748b', letterSpacing: 1 }}>
              ACTIVE TRAINS {selectedZone ? `· ${selectedZone}` : ''}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filteredTrains
              .sort((a, b) => {
                const sOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
                return (sOrder[a.severity] || 3) - (sOrder[b.severity] || 3)
              })
              .map(t => {
                const col = getSeverityColor(t.severity)
                return (
                  <div key={t.id} style={{
                    padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    borderLeft: `3px solid ${t.severity === 'CRITICAL' ? col : 'transparent'}`,
                    background: t.severity === 'CRITICAL' ? 'rgba(239,68,68,0.04)' : 'transparent',
                    transition: 'all 0.3s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </div>
                        <div style={{ fontSize: '0.54rem', color: '#475569', marginTop: 1 }}>
                          #{t.id} · {ZONES[t.zone]?.name?.split(' ')[0] || t.zone}
                        </div>
                      </div>
                      <div style={{
                        padding: '1px 5px', borderRadius: 3, fontSize: '0.5rem', fontWeight: 700, flexShrink: 0, marginLeft: 6,
                        background: `${col}22`, color: col, border: `1px solid ${col}44`,
                      }}>
                        {t.severity}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 5, fontSize: '0.58rem' }}>
                      <span style={{ color: '#10b981', fontFamily: 'monospace' }}>
                        {Math.round(t.speed || 0)} km/h
                      </span>
                      {(t.delay || 0) > 0 && (
                        <span style={{ color: '#f97316', fontFamily: 'monospace' }}>
                          +{Math.round(t.delay)}m delay
                        </span>
                      )}
                      <span style={{ color: '#334155', marginLeft: 'auto', fontFamily: 'monospace', fontSize: '0.52rem' }}>
                        {(t.ratio * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Critical alert footer */}
          {criticalCount > 0 && (
            <div style={{
              padding: '8px 12px', background: 'rgba(239,68,68,0.1)',
              borderTop: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                animation: 'pulse-dot 1s infinite', flexShrink: 0,
              }} />
              <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#ef4444' }}>
                {criticalCount} CRITICAL TRAIN{criticalCount > 1 ? 'S' : ''} — IMMEDIATE ATTENTION
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.3); }
        }
        .drishti-popup .leaflet-popup-content-wrapper {
          background: rgba(4,7,26,0.97) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 8px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          color: #f1f5f9 !important;
        }
        .drishti-popup .leaflet-popup-tip { background: rgba(4,7,26,0.97) !important; }
        .drishti-popup .leaflet-popup-close-button { color: #64748b !important; }
        .drishti-tooltip .leaflet-tooltip {
          background: rgba(4,7,26,0.92) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #e2e8f0 !important;
          font-size: 0.6rem !important;
          border-radius: 4px !important;
        }
      `}</style>
    </div>
  )
}
