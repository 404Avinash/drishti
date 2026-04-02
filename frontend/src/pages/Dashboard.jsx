import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../components/StatCard'
import AlertBadge from '../components/AlertBadge'
import LiveIndicator from '../components/LiveIndicator'

const ZONES = ['NR','CR','WR','ER','SR','SER','NFR','NWR','SCR']

function PageHeader({ title, sub, live }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em' }}>{title}</h1>
        <LiveIndicator label={live ? 'LIVE' : 'OFFLINE'} offline={!live} />
      </div>
      <p style={{ color: 'var(--t2)', fontSize: 13 }}>{sub}</p>
    </div>
  )
}

function AlertRow({ alert, onClick }) {
  const time = alert.timestamp
    ? new Date(alert.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '--:--'
  return (
    <div onClick={onClick} style={AR.row}>
      <div style={AR.timeCol}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--t3)' }}>{time}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {alert.alert_type || alert.type || 'System Alert'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {alert.node_id || alert.train_id || alert.station || '—'} · {alert.zone || 'ALL'}
        </div>
      </div>
      <AlertBadge severity={alert.severity || 'LOW'} />
    </div>
  )
}
const AR = {
  row: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid var(--b1)',
    cursor: 'pointer',
    transition: 'background 150ms ease',
  },
  timeCol: { width: 42, flexShrink: 0 },
}

function ZoneBar({ zone, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span className="mono" style={{ width: 36, color: 'var(--t2)', fontSize: 11, fontWeight: 600 }}>{zone}</span>
      <div style={{ flex: 1, height: 6, background: 'var(--raised)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`,
          background: 'linear-gradient(90deg, var(--cyan), var(--purple))',
          transition: 'width 600ms ease',
        }} />
      </div>
      <span className="mono" style={{ width: 24, textAlign: 'right', color: 'var(--t3)', fontSize: 11 }}>{count}</span>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [trains,  setTrains]    = useState([])
  const [alerts,  setAlerts]    = useState([])
  const [ingestion, setIngestion] = useState(null)
  const [live,    setLive]      = useState(false)
  const [sparkData, setSparkData] = useState([])

  const load = async () => {
    try {
      const [tRes, aRes, iRes, hRes] = await Promise.allSettled([
        fetch('/api/trains/current'),
        fetch('/api/alerts/history?limit=30'),
        fetch('/api/trains/ingestion/summary'),
        fetch('/api/health'),
      ])
      if (tRes.status === 'fulfilled' && tRes.value.ok) {
        const data = await tRes.value.json()
        setTrains(Array.isArray(data) ? data : [])
      }
      if (aRes.status === 'fulfilled' && aRes.value.ok) {
        const data = await aRes.value.json()
        setAlerts(Array.isArray(data) ? data.slice(0, 20) : [])
      }
      if (iRes.status === 'fulfilled' && iRes.value.ok) {
        const data = await iRes.value.json()
        setIngestion(data)
        // Build sparkline from ingestion
        setSparkData(prev => {
          const next = [...prev, { time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }), value: data.persisted || 0 }]
          return next.slice(-20)
        })
      }
      if (hRes.status === 'fulfilled' && hRes.value.ok) {
        const data = await hRes.value.json()
        setLive(data.status === 'ok' || data.status === 'healthy')
      }
    } catch { /* silent */ }
  }

  useEffect(() => { load(); const iv = setInterval(load, 8000); return () => clearInterval(iv) }, [])

  const critical = trains.filter(t => t.stress_level === 'CRITICAL').length
  const high     = trains.filter(t => t.stress_level === 'HIGH').length
  const critAlerts = alerts.filter(a => a.severity === 'CRITICAL').length

  // Zone distribution
  const zoneCounts = {}
  trains.forEach(t => { const z = t.zone || 'UNK'; zoneCounts[z] = (zoneCounts[z] || 0) + 1 })
  const maxZone = Math.max(1, ...Object.values(zoneCounts))

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1440, margin: '0 auto' }}>
      <PageHeader
        title="Operations Command Center"
        sub="India's railway safety intelligence — live telemetry across all zones"
        live={live}
      />

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 24, flexWrap: 'wrap' }}>
        <StatCard label="Active Trains"    value={trains.length}  color="var(--cyan)"   icon="⟁" sub="Across all IR zones" />
        <StatCard label="Critical Stress"  value={critical}       color="var(--red)"    icon="⊗" sub="Immediate attention required" />
        <StatCard label="High Stress"      value={high}           color="var(--orange)" icon="⚠" sub="Elevated risk zones" />
        <StatCard label="Alerts (24h)"     value={critAlerts}     color="var(--purple)" icon="◉" sub="Critical severity events" />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Zone coverage */}
          <div style={CARD}>
            <div style={CARD_HEAD}>
              <span style={CARD_TITLE}>Zone Coverage</span>
              <span style={LABEL}>9 IR ZONES</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
              {ZONES.map(z => (
                <ZoneBar key={z} zone={z} count={zoneCounts[z] || 0} max={maxZone} />
              ))}
              {Object.keys(zoneCounts).filter(z => !ZONES.includes(z)).map(z => (
                <ZoneBar key={z} zone={z} count={zoneCounts[z] || 0} max={maxZone} />
              ))}
              {trains.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t3)', fontSize: 12 }}>
                  No train data — telemetry producer may be starting up
                </div>
              )}
            </div>
          </div>

          {/* Ingestion sparkline */}
          <div style={CARD}>
            <div style={CARD_HEAD}>
              <span style={CARD_TITLE}>Pipeline Throughput</span>
              <span style={LABEL}>LAST 20 POLLS</span>
            </div>
            <div style={{ height: 120, marginTop: 8 }}>
              {sparkData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData}>
                    <defs>
                      <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="var(--cyan)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--cyan)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fill: 'var(--t3)', fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: 'var(--t2)' }}
                      itemStyle={{ color: 'var(--cyan)' }}
                    />
                    <Area type="monotone" dataKey="value" name="Records" stroke="var(--cyan)" strokeWidth={2} fill="url(#sparkGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  Collecting pipeline data...
                </div>
              )}
            </div>
            {ingestion && (
              <div style={{ display: 'flex', gap: 20, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--b1)' }}>
                {[
                  { label: 'Received', value: ingestion.received || 0, color: 'var(--t2)' },
                  { label: 'Valid',    value: ingestion.valid    || 0, color: 'var(--cyan)' },
                  { label: 'Persisted',value: ingestion.persisted|| 0, color: 'var(--green)' },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: m.color }}>{m.value}</span>
                    <span style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{m.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'View All Trains → ', to: '/trains',  color: 'var(--cyan)' },
              { label: 'Network Map →',      to: '/network', color: 'var(--purple)' },
              { label: 'AI Models →',        to: '/ai',      color: 'var(--orange)' },
            ].map(({ label, to, color }) => (
              <button key={to} onClick={() => navigate(to)} style={{
                flex: 1, padding: '10px 16px', borderRadius: 'var(--r-sm)',
                background: `${color}10`, border: `1px solid ${color}25`,
                color, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '0.06em', transition: 'all 180ms ease',
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Right — alert feed */}
        <div style={CARD}>
          <div style={CARD_HEAD}>
            <span style={CARD_TITLE}>Live Alert Feed</span>
            <button onClick={() => navigate('/alerts')} style={{ background: 'none', border: 'none', color: 'var(--cyan)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              ALL →
            </button>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 480 }}>
            {alerts.length > 0 ? alerts.map((a, i) => (
              <AlertRow key={i} alert={a} onClick={() => navigate('/alerts')} />
            )) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--t3)', fontSize: 12 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                Network stable — no alerts
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const CARD = {
  background: 'var(--glass)',
  backdropFilter: 'var(--blur)',
  WebkitBackdropFilter: 'var(--blur)',
  border: '1px solid var(--b1)',
  borderRadius: 'var(--r-md)',
  padding: '20px 20px 16px',
}
const CARD_HEAD = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--b1)',
}
const CARD_TITLE = { fontSize: 13, fontWeight: 700, color: 'var(--t1)', letterSpacing: '0.04em' }
const LABEL = { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }
