import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AlertBadge from '../components/AlertBadge'
import LiveIndicator from '../components/LiveIndicator'

const SEVERITIES = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const ZONES     = ['ALL', 'NR', 'CR', 'WR', 'ER', 'SR', 'SER', 'NFR', 'NWR', 'SCR']

function TimelineCard({ alert, expanded, onClick }) {
  const ts = alert.timestamp ? new Date(alert.timestamp) : null
  const timeStr = ts ? ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
  const dateStr = ts ? ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''

  const severityColors = {
    CRITICAL: 'var(--red)', HIGH: 'var(--orange)',
    MEDIUM: 'var(--yellow)', LOW: 'var(--green)',
  }
  const lineColor = severityColors[alert.severity] || 'var(--t3)'

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Timeline line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: lineColor, boxShadow: `0 0 8px ${lineColor}`, flexShrink: 0, marginTop: 14 }} />
        <div style={{ width: 1, flex: 1, background: 'var(--b1)', minHeight: 20 }} />
      </div>

      {/* Card */}
      <div onClick={onClick} style={{
        flex: 1, padding: '14px 18px', marginBottom: 10,
        background: 'var(--glass)', backdropFilter: 'var(--blur-sm)', WebkitBackdropFilter: 'var(--blur-sm)',
        border: `1px solid ${expanded ? lineColor + '40' : 'var(--b1)'}`,
        borderRadius: 'var(--r-md)', cursor: 'pointer',
        transition: 'all 200ms ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <AlertBadge severity={alert.severity} size="sm" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
                {alert.alert_type || alert.type || 'System Alert'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {alert.node_id   && <span>📍 {alert.node_id}</span>}
              {alert.train_id  && <span>⟁ {alert.train_id}</span>}
              {alert.zone      && <span>◉ {alert.zone}</span>}
              {alert.station   && <span>🏛 {alert.station}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600 }}>{timeStr}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)' }}>{dateStr}</div>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--b1)' }}>
            {alert.description && (
              <p style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7, marginBottom: 10 }}>
                {alert.description}
              </p>
            )}
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {alert.stress_score != null && (
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Stress Score</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--orange)' }}>
                    {(alert.stress_score * 100).toFixed(0)}%
                  </div>
                </div>
              )}
              {alert.crs_match_score != null && (
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CRS Match</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--red)' }}>
                    {(alert.crs_match_score * 100).toFixed(0)}%
                  </div>
                </div>
              )}
              {alert.speed != null && (
                <div>
                  <div style={{ fontSize: 9.5, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Speed</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--cyan)' }}>
                    {Math.round(alert.speed)} km/h
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Alerts() {
  const [alerts,   setAlerts]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [severity, setSeverity] = useState('ALL')
  const [zone,     setZone]     = useState('ALL')
  const [expanded, setExpanded] = useState(null)
  const [live,     setLive]     = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/alerts/history?limit=200')
      if (res.ok) { setAlerts(await res.json()); setLive(true) }
    } catch { setLive(false) }
    setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 15000); return () => clearInterval(iv) }, [])

  const filtered = alerts
    .filter(a => severity === 'ALL' || a.severity === severity)
    .filter(a => zone     === 'ALL' || a.zone     === zone)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))

  const counts = SEVERITIES.reduce((acc, s) => {
    acc[s] = s === 'ALL' ? alerts.length : alerts.filter(a => a.severity === s).length
    return acc
  }, {})

  const recentCrit = alerts.filter(a => a.severity === 'CRITICAL').slice(0, 3)
  const crsMatches = alerts.filter(a => a.crs_match_score > 0.5).slice(0, 5)

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Alert Command Center</h1>
          <LiveIndicator label={live ? 'MONITORING' : 'OFFLINE'} offline={!live} color="var(--orange)" />
        </div>
        <p style={{ color: 'var(--t2)', fontSize: 13 }}>
          Real-time safety alerts and CRS historical signature analysis
        </p>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total',    value: counts.ALL,      color: 'var(--t2)' },
          { label: 'Critical', value: counts.CRITICAL, color: 'var(--red)' },
          { label: 'High',     value: counts.HIGH,     color: 'var(--orange)' },
          { label: 'Medium',   value: counts.MEDIUM,   color: 'var(--yellow)' },
          { label: 'Low',      value: counts.LOW,      color: 'var(--green)' },
          { label: 'CRS Matches', value: crsMatches.length, color: 'var(--purple)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            padding: '8px 18px', borderRadius: 'var(--r-sm)',
            background: `${color}08`, border: `1px solid ${color}20`,
            display: 'flex', flexDirection: 'column', gap: 2, flex: '1 0 auto',
          }}>
            <span className="mono" style={{ fontSize: 20, fontWeight: 800, color }}>{value}</span>
            <span style={{ fontSize: 9.5, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
        {/* Timeline */}
        <div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SEVERITIES.map(s => {
                const colors = { CRITICAL: 'var(--red)', HIGH: 'var(--orange)', MEDIUM: 'var(--yellow)', LOW: 'var(--green)', ALL: 'var(--cyan)' }
                const c = colors[s]
                return (
                  <button key={s} onClick={() => setSeverity(s)} style={{
                    padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                    border: `1px solid ${severity === s ? c : 'var(--b1)'}`,
                    background: severity === s ? `${c}15` : 'transparent',
                    color: severity === s ? c : 'var(--t2)',
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>{s} {counts[s] > 0 ? `(${counts[s]})` : ''}</button>
                )
              })}
            </div>
            <select value={zone} onChange={e => setZone(e.target.value)} style={{
              padding: '4px 10px', borderRadius: 20,
              background: 'var(--surface)', border: '1px solid var(--b1)',
              color: 'var(--t1)', fontSize: 11, cursor: 'pointer',
            }}>
              {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>

          {/* Timeline */}
          <div style={{ paddingLeft: 4 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)' }}>Loading alerts...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>Network Stable</div>
                <div style={{ fontSize: 13 }}>No alerts match the current filters</div>
              </div>
            ) : filtered.map((a, i) => (
              <TimelineCard
                key={i} alert={a}
                expanded={expanded === i}
                onClick={() => setExpanded(expanded === i ? null : i)}
              />
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* CRS matches */}
          <div style={{ background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--b1)', borderRadius: 'var(--r-md)', padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--purple)', marginBottom: 12, textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
              CRS Signature Matches
            </div>
            {crsMatches.length > 0 ? crsMatches.map((a, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{a.node_id || a.train_id || '—'}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>{a.alert_type || '—'}</div>
                </div>
                <span className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>
                  {(a.crs_match_score * 100).toFixed(0)}%
                </span>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: 12 }}>
                No signature matches — network stable
              </div>
            )}
          </div>

          {/* Critical recents */}
          <div style={{ background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--red-30)', borderRadius: 'var(--r-md)', padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--red)', marginBottom: 12, textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
              Recent Critical
            </div>
            {recentCrit.length > 0 ? recentCrit.map((a, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--b1)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{a.alert_type || '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                  {a.node_id || a.train_id || '—'} · {a.zone || 'ALL'}
                </div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: 12 }}>
                ✓ No critical alerts
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
