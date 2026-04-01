import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, RefreshCw, ExternalLink, Train } from 'lucide-react'

const SEV = {
  CRITICAL: { cls: 'badge-red',    col: 'var(--red)',    bg: 'var(--red-g)',    border: 'var(--red-b)' },
  HIGH:     { cls: 'badge-orange', col: 'var(--orange)', bg: 'var(--orange-g)', border: 'var(--orange-b)' },
  MEDIUM:   { cls: 'badge-yellow', col: 'var(--yellow)', bg: 'var(--yellow-g)', border: 'var(--yellow-b)' },
  LOW:      { cls: 'badge-green',  col: 'var(--green)',  bg: 'var(--green-g)',  border: 'var(--green-b)' },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sevFilter, setSevFilter] = useState('ALL')
  const [sort, setSort] = useState('newest')
  const [selected, setSelected] = useState(null)

  const load = () => {
    setLoading(true)
    const host = ''
    fetch(`${host}/api/alerts/history?limit=200`)
      .then(r => r.json())
      .then(d => { setAlerts(d.alerts || []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Also subscribe to live stream
  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:8000/ws/live`
    const ws = new WebSocket(wsUrl)
    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'alert' && msg.data)
        setAlerts(prev => [msg.data, ...prev].slice(0, 200))
    }
    return () => ws.close()
  }, [])

  const filtered = alerts
    .filter(a => sevFilter === 'ALL' || a.severity === sevFilter)
    .filter(a => {
      const q = search.toLowerCase()
      return !q || a.train_id?.toLowerCase().includes(q) || a.station_name?.toLowerCase().includes(q) || a.zone?.toLowerCase().includes(q)
    })
    .sort((a, b) => sort === 'newest'
      ? new Date(b.timestamp) - new Date(a.timestamp)
      : sort === 'oldest'
        ? new Date(a.timestamp) - new Date(b.timestamp)
        : (b.risk_score || 0) - (a.risk_score || 0)
    )

  const sel = selected !== null ? alerts.find(a => a.id === selected) : null

  return (
    <div style={{ height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* Left: list */}
      <div style={{ flex: sel ? '0 0 420px' : 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: sel ? '1px solid var(--border)' : 'none' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, background: 'rgba(4,7,26,0.6)' }}>
          {/* Search */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
            <input
              className="input"
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search train, station, zone…"
              style={{ width: '100%', paddingLeft: 30, fontSize: '0.78rem' }}
            />
          </div>

          {/* Severity filter */}
          <select className="input" value={sevFilter} onChange={e => setSevFilter(e.target.value)} style={{ fontSize: '0.78rem' }}>
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Sort */}
          <select className="input" value={sort} onChange={e => setSort(e.target.value)} style={{ fontSize: '0.78rem' }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="risk">Risk Score</option>
          </select>

          <button className="btn btn-ghost" onClick={load} title="Refresh">
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Count bar */}
        <div style={{ padding: '6px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, fontSize: '0.7rem', color: 'var(--t3)', background: 'rgba(0,0,0,0.15)', flexShrink: 0 }}>
          <span>Showing <strong style={{ color: 'var(--t1)' }}>{filtered.length}</strong> of {alerts.length}</span>
          {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => (
            <span key={s} style={{ color: SEV[s].col }}>
              {s[0]}: {alerts.filter(a => a.severity === s).length}
            </span>
          ))}
        </div>

        {/* Alert rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && alerts.length === 0
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)' }}>
                <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: 12 }}>⚙️</div>
                <br/>Loading alerts…
              </div>
            : filtered.length === 0
              ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: '0.85rem' }}>
                  No alerts match filters
                </div>
              : filtered.map((a, i) => {
                  const s = SEV[a.severity] || SEV.LOW
                  const isActive = selected === a.id
                  return (
                    <div
                      key={a.id || i}
                      onClick={() => setSelected(isActive ? null : a.id)}
                      className="anim-fade"
                      style={{
                        padding: '11px 16px', borderBottom: '1px solid var(--border)',
                        cursor: 'pointer', transition: 'background 0.15s',
                        background: isActive ? 'var(--blue-gg)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--blue)' : `3px solid ${s.col}`,
                        animationDelay: `${Math.min(i * 20, 400)}ms`
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--card)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>🚄 {a.train_id}</span>
                          <span className={`badge ${s.cls}`}>{a.severity}</span>
                        </div>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', color: s.col, fontWeight: 700 }}>
                          {a.risk_score}%
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--t2)', marginBottom: 3 }}>
                        📍 {a.station_name} {a.zone && <span style={{ color: 'var(--t3)' }}>· {a.zone}</span>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.67rem', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                          {a.explanation}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--t4)' }}>
                          {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ''}
                        </div>
                      </div>
                    </div>
                  )
                })
          }
        </div>
      </div>

      {/* Right: detail panel */}
      {sel && (
        <div className="anim-slide" style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: 4 }}>
                🚆 {sel.train_id}
                {sel.train_name && <span style={{ fontSize: '1rem', color: 'var(--t2)', marginLeft: 8, fontWeight: 400 }}>{sel.train_name}</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>
                📍 {sel.station_name} {sel.station_code && `(${sel.station_code})`}
                {sel.zone && <span style={{ color: 'var(--t3)', marginLeft: 8 }}>Zone: {sel.zone}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link to={`/train/${sel.train_id}`} className="btn btn-primary">
                <ExternalLink size={13} /> Full Analysis
              </Link>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>✕</button>
            </div>
          </div>

          {/* Score + severity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Risk Score', val: `${sel.risk_score}%`, color: (SEV[sel.severity]||SEV.LOW).col },
              { label: 'Severity', val: sel.severity, color: (SEV[sel.severity]||SEV.LOW).col },
              { label: 'Timestamp', val: sel.timestamp ? new Date(sel.timestamp).toLocaleString() : 'N/A', color: 'var(--t1)' },
            ].map(c => (
              <div key={c.label} className="glass-panel">
                <div className="glass-header">{c.label}</div>
                <div className="glass-content" style={{ fontWeight: 800, fontSize: '1rem', color: c.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {c.val}
                </div>
              </div>
            ))}
          </div>

          {/* Explanation */}
          <div className="glass-panel" style={{ marginBottom: 12 }}>
            <div className="glass-header">AI Explanation</div>
            <div className="glass-content" style={{ fontSize: '0.85rem', lineHeight: 1.7, color: 'var(--t2)' }}>
              {sel.explanation || 'No explanation available.'}
            </div>
          </div>

          {/* Actions */}
          {sel.actions && sel.actions.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: 12 }}>
              <div className="glass-header">Recommended Actions</div>
              <div className="glass-content" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sel.actions.map((act, i) => (
                  <span key={i} style={{
                    background: 'var(--bg3)', border: '1px solid var(--border-b)',
                    padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', color: 'var(--t1)'
                  }}>{act}</span>
                ))}
              </div>
            </div>
          )}

          {/* Coords */}
          {(sel.lat && sel.lng) && (
            <div className="glass-panel">
              <div className="glass-header">Location</div>
              <div className="glass-content" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', color: 'var(--cyan)' }}>
                {sel.lat.toFixed(4)}°N, {sel.lng.toFixed(4)}°E
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
