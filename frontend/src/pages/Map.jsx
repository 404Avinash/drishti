import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Link } from 'react-router-dom'

const RISKS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }

export default function NetworkMap() {
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    // Initial fetch of recent locations
    const host = import.meta.env.DEV ? 'http://localhost:8000' : ''
    fetch(`${host}/api/alerts/history?limit=100`)
      .then(r => r.json())
      .then(d => {
        // Keep exactly one latest coordinate per train
        const activeTrains = new Map()
        d.alerts.forEach(a => {
          if (!activeTrains.has(a.train_id)) activeTrains.set(a.train_id, a)
        })
        setAlerts(Array.from(activeTrains.values()))
      })
      
    // Subscribe to live stream for real-time map plots
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = import.meta.env.DEV ? `ws://localhost:8000/ws/live` : `${proto}//${window.location.host}/ws/live`
    const ws = new WebSocket(wsUrl)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'alert' && msg.data) {
        setAlerts(prev => {
          const map = new Map(prev.map(p => [p.train_id, p]))
          map.set(msg.data.train_id, msg.data)
          return Array.from(map.values())
        })
      }
    }
    return () => ws.close()
  }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', background: 'rgba(5,9,26,0.9)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Live Network View</h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--t3)' }}>Geospatial tracking of active alert anomalies across Indian Railways</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--t2)' }}><span style={{ color: 'var(--red)' }}>●</span> Critical</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--orange)' }}><span style={{ color: 'var(--orange)' }}>●</span> High</span>
        </div>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer center={[22.5, 79.0]} zoom={5} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />
          {alerts.map(a => (
            <CircleMarker 
              key={a.id}
              center={[a.lat, a.lng]} 
              radius={a.severity === 'CRITICAL' ? 10 : a.severity === 'HIGH' ? 8 : 6}
              pathOptions={{
                color: RISKS[a.severity],
                fillColor: RISKS[a.severity],
                fillOpacity: a.severity === 'CRITICAL' ? 0.8 : 0.5,
              }}
            >
              <Popup className="drishti-popup">
                <div style={{ background: '#080e20', color: '#fff', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700 }}>🚆 {a.train_id} {a.train_name}</div>
                  <div style={{ color: RISKS[a.severity], fontSize: '0.8rem', fontWeight: 600, margin: '4px 0' }}>{a.severity} RISK ({a.risk_score}%)</div>
                  <div style={{ fontSize: '0.8rem', color: '#8b9fc0', marginBottom: '8px' }}>📍 {a.station_name}</div>
                  <Link to={`/train/${a.train_id}`} style={{ color: '#3b82f6', fontSize: '0.85rem', textDecoration: 'underline' }}>View Deep Analysis</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        
        {/* Style override for Leaflet popup specifically */}
        <style dangerouslySetInnerHTML={{__html:`
          .leaflet-popup-content-wrapper { background: #080e20 !important; border: 1px solid rgba(255,255,255,0.1); padding: 0 !important; }
          .leaflet-popup-tip { background: #080e20 !important; }
          .leaflet-popup-content { margin: 0 !important; }
        `}} />
      </div>
    </div>
  )
}
