import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid
} from 'recharts'
import { ExternalLink, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

const SEV = {
  CRITICAL: { cls: 'badge-red',    col: 'var(--red)',    bg: 'var(--red-g)',    border: 'var(--red-b)' },
  HIGH:     { cls: 'badge-orange', col: 'var(--orange)', bg: 'var(--orange-g)', border: 'var(--orange-b)' },
  MEDIUM:   { cls: 'badge-yellow', col: 'var(--yellow)', bg: 'var(--yellow-g)', border: 'var(--yellow-b)' },
  LOW:      { cls: 'badge-green',  col: 'var(--green)',  bg: 'var(--green-g)',  border: 'var(--green-b)' },
}

const DONUT_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e']

function MetricCard({ title, value, sub, color, Icon, delay = 0 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    let start = 0
    const end = parseInt(value) || 0
    if (end === 0) { setDisplay(0); return }
    const step = Math.ceil(end / 30)
    const timer = setInterval(() => {
      start = Math.min(start + step, end)
      setDisplay(start)
      if (start >= end) clearInterval(timer)
    }, 30)
    return () => clearInterval(timer)
  }, [value])

  return (
    <div className="glass-panel anim-up" style={{ animationDelay: `${delay}ms`, borderTop: `2px solid ${color}` }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</div>
          <div style={{ color, opacity: 0.7 }}><Icon size={14} /></div>
        </div>
        <div style={{ fontSize: '2.2rem', fontWeight: 900, color, lineHeight: 1, letterSpacing: -1, fontFamily: 'JetBrains Mono, monospace' }}>
          {display.toLocaleString()}
        </div>
        {sub && <div style={{ fontSize: '0.65rem', color: 'var(--t3)', marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-b)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem' }}>
      <div style={{ color: 'var(--t2)', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</div>
      ))}
    </div>
  )
}

export default function Dashboard({ stats }) {
  const [feed, setFeed] = useState([])
  const [zones, setZones] = useState({})
  const [timeline, setTimeline] = useState([])
  const [activeTab, setActiveTab] = useState('feed')
  const feedRef = useRef(null)

  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.stats) { /* handled by App.jsx */ }
      if (msg.zones) setZones(msg.zones)
      if (msg.recent_alerts) setFeed(msg.recent_alerts.slice(0, 60))
      if (msg.type === 'alert' && msg.data) {
        setFeed(prev => [msg.data, ...prev].slice(0, 60))
        // Build rolling timeline
        const now = new Date()
        const label = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`
        setTimeline(prev => {
          const last = prev[prev.length - 1]
          if (last?.time === label) {
            return [...prev.slice(0,-1), {
              ...last,
              [msg.data.severity]: (last[msg.data.severity] || 0) + 1,
              total: (last.total || 0) + 1
            }]
          }
          return [...prev, { time: label, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, total: 1, [msg.data.severity]: 1 }].slice(-20)
        })
      }
    }
    return () => ws.close()
  }, [])

  const donutData = [
    { name: 'Critical', value: stats.critical },
    { name: 'High',     value: stats.high },
    { name: 'Medium',   value: stats.medium },
    { name: 'Low',      value: stats.low },
  ]

  const zoneData = Object.entries(zones)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([zone, v]) => ({ zone, ...v }))

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* ── Metric Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, flexShrink: 0 }}>
        <MetricCard title="Critical Alerts" value={stats.critical} color="var(--red)"    Icon={AlertTriangle} sub="Immediate action required" delay={0} />
        <MetricCard title="High Risk"       value={stats.high}     color="var(--orange)" Icon={Zap}           sub="Elevated risk events"      delay={60} />
        <MetricCard title="Total Incidents" value={stats.total}    color="var(--blue)"   Icon={CheckCircle}   sub="All processed alerts"      delay={120} />
        <MetricCard title="Trains Tracked"  value={stats.trains_monitored} color="var(--cyan)" Icon={Clock} sub="Active in network" delay={180} />
      </div>

      {/* ── Middle Row ── */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>

        {/* Live Feed / Map Teaser panel */}
        <div className="glass-panel" style={{ width: 340, flexShrink: 0 }}>
          <div className="glass-header">
            <div className="flex items-center gap-2">
              <span className="dot dot-green" />
              <span>Live Alert Stream</span>
            </div>
            <div className="tabs">
              {['feed', 'zones'].map(t => (
                <button key={t} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-content" ref={feedRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activeTab === 'feed' ? (
              feed.length === 0
                ? <div style={{ textAlign: 'center', color: 'var(--t3)', marginTop: 60, fontSize: '0.82rem' }}>
                    <div style={{ marginBottom: 8, fontSize: '1.5rem' }}>📡</div>
                    Connecting to inference engine…
                  </div>
                : feed.map((a, i) => {
                    const s = SEV[a.severity] || SEV.LOW
                    return (
                      <Link to={`/train/${a.train_id}`} key={a.id || i} className="anim-slide" style={{
                        background: s.bg, borderLeft: `3px solid ${s.col}`,
                        padding: '10px 12px', borderRadius: 8,
                        display: 'block', animationDelay: `${Math.min(i * 30, 300)}ms`,
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = s.border.replace('0.38','0.25').replace('0.35','0.22').replace('0.28','0.18')}
                      onMouseLeave={e => e.currentTarget.style.background = s.bg}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>🚄 {a.train_id}</span>
                          <span className={`badge ${s.cls}`}>{a.severity}</span>
                        </div>
                        <div style={{ color: 'var(--t2)', fontSize: '0.71rem', marginBottom: 3 }}>📍 {a.station_name}</div>
                        <div style={{ color: 'var(--t3)', fontSize: '0.68rem', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {a.explanation}
                        </div>
                      </Link>
                    )
                  })
            ) : (
              zoneData.length === 0
                ? <div style={{ textAlign: 'center', color: 'var(--t3)', marginTop: 60, fontSize: '0.82rem' }}>No zone data yet</div>
                : zoneData.map(z => {
                    const pct = z.total > 0 ? (z.critical / z.total) * 100 : 0
                    return (
                      <div key={z.zone} style={{ background: 'var(--card)', borderRadius: 8, padding: '10px 12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{z.zone}</span>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--orange)' }}>{z.total}</span>
                        </div>
                        <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${(z.critical/z.total)*100}%`, background: 'var(--red)', transition: 'width 0.5s' }} />
                          <div style={{ width: `${(z.high/z.total)*100}%`, background: 'var(--orange)', transition: 'width 0.5s' }} />
                          <div style={{ width: `${(z.medium/z.total)*100}%`, background: 'var(--yellow)', transition: 'width 0.5s' }} />
                          <div style={{ width: `${(z.low/z.total)*100}%`, background: 'var(--green)', transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    )
                  })
            )}
          </div>
        </div>

        {/* Right columns */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          
          {/* Charts row */}
          <div style={{ display: 'flex', gap: 12, height: 220, flexShrink: 0 }}>
            
            {/* Donut */}
            <div className="glass-panel" style={{ flex: '0 0 220px' }}>
              <div className="glass-header">Severity Ratio</div>
              <div style={{ flex: 1, position: 'relative', padding: 8 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} innerRadius={52} outerRadius={74} paddingAngle={2} dataKey="value" stroke="none">
                      {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace' }}>{stats.total}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1 }}>Total</div>
                </div>
              </div>
            </div>

            {/* Area chart - rolling timeline */}
            <div className="glass-panel" style={{ flex: 1 }}>
              <div className="glass-header">
                <span>Incident Timeline</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--t3)' }}>Rolling 20 windows</span>
              </div>
              <div style={{ flex: 1, padding: 8 }}>
                {timeline.length === 0
                  ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: '0.78rem' }}>
                      Awaiting live data…
                    </div>
                  : <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gRed" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" stroke="var(--border)" tick={{ fill: 'var(--t3)', fontSize: 9 }} />
                        <YAxis stroke="var(--border)" tick={{ fill: 'var(--t3)', fontSize: 9 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="CRITICAL" stroke="#ef4444" fill="url(#gRed)" strokeWidth={1.5} />
                        <Area type="monotone" dataKey="HIGH"     stroke="#f97316" fill="url(#gOrange)" strokeWidth={1.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                }
              </div>
            </div>
          </div>

          {/* Zone bar chart */}
          <div className="glass-panel" style={{ flex: 1 }}>
            <div className="glass-header">
              <span>Zone Alert Distribution</span>
              <Link to="/map" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--blue)' }}>
                View Map <ExternalLink size={10} />
              </Link>
            </div>
            <div style={{ flex: 1, padding: '8px 4px 12px' }}>
              {zoneData.length === 0
                ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: '0.78rem' }}>
                    No zone data yet
                  </div>
                : <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={zoneData} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 0" />
                      <XAxis dataKey="zone" stroke="var(--border)" tick={{ fill: 'var(--t3)', fontSize: 10 }} />
                      <YAxis stroke="var(--border)" tick={{ fill: 'var(--t3)', fontSize: 10 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="critical" name="Critical" stackId="a" fill="#ef4444" radius={[0,0,0,0]} />
                      <Bar dataKey="high"     name="High"     stackId="a" fill="#f97316" />
                      <Bar dataKey="medium"   name="Medium"   stackId="a" fill="#eab308" />
                      <Bar dataKey="low"      name="Low"      stackId="a" fill="#22c55e" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
