import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AlertBadge from '../components/AlertBadge'
import LiveIndicator from '../components/LiveIndicator'

const STRESS_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, STABLE: 4 }

function StressBar({ level }) {
  const colors = {
    CRITICAL: 'var(--red)', HIGH: 'var(--orange)',
    MEDIUM: 'var(--yellow)', LOW: 'var(--green)',
    STABLE: 'var(--cyan)',
  }
  const widths = { CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, STABLE: 10 }
  const c = colors[level] || 'var(--t3)'
  const w = widths[level] || 5
  return (
    <div style={{ width: 60, height: 4, background: 'var(--raised)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: c, borderRadius: 4, boxShadow: `0 0 6px ${c}` }} />
    </div>
  )
}

export default function Trains() {
  const navigate = useNavigate()
  const [trains,  setTrains]   = useState([])
  const [loading, setLoading]  = useState(true)
  const [filter,  setFilter]   = useState('ALL')
  const [search,  setSearch]   = useState('')
  const [sortKey, setSortKey]  = useState('stress')
  const [live,    setLive]     = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/trains/current')
      if (res.ok) {
        const data = await res.json()
        setTrains(Array.isArray(data) ? data : [])
        setLive(true)
      }
    } catch { setLive(false) }
    setLoading(false)
  }
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv) }, [])

  const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'STABLE']

  const filtered = trains
    .filter(t => filter === 'ALL' || t.stress_level === filter)
    .filter(t => {
      if (!search) return true
      const q = search.toLowerCase()
      return (t.train_id||'').toLowerCase().includes(q)
          || (t.current_station||'').toLowerCase().includes(q)
          || (t.zone||'').toLowerCase().includes(q)
    })
    .sort((a, b) => {
      if (sortKey === 'stress') return (STRESS_ORDER[a.stress_level] ?? 5) - (STRESS_ORDER[b.stress_level] ?? 5)
      if (sortKey === 'speed')  return (b.speed || 0) - (a.speed || 0)
      if (sortKey === 'delay')  return (b.delay_minutes || 0) - (a.delay_minutes || 0)
      return 0
    })

  const counts = FILTERS.reduce((acc, f) => {
    acc[f] = f === 'ALL' ? trains.length : trains.filter(t => t.stress_level === f).length
    return acc
  }, {})

  const COLS = [
    { key: 'train_id',        label: 'Train ID',    sortable: false, width: 120 },
    { key: 'stress',          label: 'Stress',      sortable: true,  width: 100 },
    { key: 'stress_bar',      label: '',            sortable: false, width: 80 },
    { key: 'current_station', label: 'Station',     sortable: false, width: 140 },
    { key: 'zone',            label: 'Zone',        sortable: false, width: 70 },
    { key: 'speed',           label: 'Speed',       sortable: true,  width: 90 },
    { key: 'delay_minutes',   label: 'Delay',       sortable: true,   width: 80 },
    { key: 'action',          label: '',            sortable: false, width: 80 },
  ]

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em' }}>Live Train Tracker</h1>
          <LiveIndicator label={live ? 'LIVE' : 'OFFLINE'} offline={!live} />
        </div>
        <p style={{ color: 'var(--t2)', fontSize: 13 }}>All active trains across Indian Railway zones — real-time stress monitoring</p>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            const colors = { CRITICAL: 'var(--red)', HIGH: 'var(--orange)', MEDIUM: 'var(--yellow)', LOW: 'var(--green)', STABLE: 'var(--cyan)', ALL: 'var(--purple)' }
            const c = colors[f]
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '5px 14px', borderRadius: 20, border: `1px solid ${active ? c : 'var(--b1)'}`,
                background: active ? `${c}15` : 'transparent',
                color: active ? c : 'var(--t2)', fontSize: 11.5, fontWeight: 700,
                letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 180ms ease',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                {f} {counts[f] > 0 && <span style={{ opacity: .7 }}>({counts[f]})</span>}
              </button>
            )
          })}
        </div>

        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search trains, stations, zones..."
          style={{
            flex: 1, minWidth: 200, padding: '7px 16px',
            background: 'var(--surface)', border: '1px solid var(--b1)',
            borderRadius: 'var(--r-sm)', color: 'var(--t1)', fontSize: 13,
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 6 }}>
          {[{ k: 'stress', l: 'STRESS' }, { k: 'speed', l: 'SPEED' }, { k: 'delay', l: 'DELAY' }].map(({ k, l }) => (
            <button key={k} onClick={() => setSortKey(k)} style={{
              padding: '5px 12px', borderRadius: 8,
              background: sortKey === k ? 'var(--cyan-10)' : 'transparent',
              border: `1px solid ${sortKey === k ? 'var(--cyan-30)' : 'var(--b1)'}`,
              color: sortKey === k ? 'var(--cyan)' : 'var(--t3)',
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.10em', fontFamily: 'JetBrains Mono, monospace',
            }}>{l} ↓</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--b1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '120px 100px 80px 1fr 70px 90px 80px 80px', padding: '10px 20px', borderBottom: '1px solid var(--b1)', background: 'var(--surface)' }}>
          {COLS.map(c => (
            <span key={c.key} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--t3)', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
              {c.label}
            </span>
          ))}
        </div>

        {/* Table rows */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--t3)', fontSize: 13 }}>
            Loading trains...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--t3)' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⟁</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No trains found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Telemetry producer may still be warming up</div>
          </div>
        ) : filtered.map((t, i) => (
          <div key={t.train_id || i}
            onClick={() => navigate(`/train/${t.train_id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 100px 80px 1fr 70px 90px 80px 80px',
              padding: '12px 20px',
              borderBottom: '1px solid var(--b1)',
              cursor: 'pointer',
              transition: 'background 150ms ease',
              alignItems: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>
              {t.train_id || '—'}
            </span>
            <span><AlertBadge severity={t.stress_level || 'STABLE'} /></span>
            <span><StressBar level={t.stress_level} /></span>
            <span style={{ fontSize: 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
              {t.current_station || '—'}
            </span>
            <span className="mono" style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 600 }}>{t.zone || '—'}</span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--cyan)' }}>
              {t.speed != null ? `${Math.round(t.speed)} km/h` : '—'}
            </span>
            <span className="mono" style={{ fontSize: 13, color: t.delay_minutes > 0 ? 'var(--orange)' : 'var(--green)' }}>
              {t.delay_minutes != null ? `${t.delay_minutes > 0 ? '+' : ''}${t.delay_minutes}m` : '—'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 600 }}>VIEW →</span>
          </div>
        ))}

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{ padding: '10px 20px', borderTop: '1px solid var(--b1)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>
              Showing {filtered.length} of {trains.length} trains
            </span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.1em' }}>
              AUTO-REFRESH 10s
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
