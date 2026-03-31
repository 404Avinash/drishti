import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'

const COLORS = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' }

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0, trains_monitored: 0 })
  const [feed, setFeed] = useState([])
  const [zones, setZones] = useState({})
  
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // During dev on Vite, proxy via localhost:8000, in prod via host
    const wsUrl = import.meta.env.DEV ? `ws://localhost:8000/ws/live` : `${proto}//${window.location.host}/ws/live`
    const ws = new WebSocket(wsUrl)
    
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'init' || msg.type === 'alert') {
        if (msg.stats) setStats(msg.stats)
        if (msg.zones) setZones(msg.zones)
        if (msg.recent_alerts) {
          setFeed(prev => [...msg.recent_alerts, ...prev].slice(0, 50))
        } else if (msg.data) {
          setFeed(prev => [msg.data, ...prev].slice(0, 50))
        }
      }
    }
    return () => ws.close()
  }, [])

  const donutData = [
    { name: 'Critical', value: stats.critical },
    { name: 'High', value: stats.high },
    { name: 'Medium', value: stats.medium },
    { name: 'Low', value: stats.low },
  ]

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
      
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', flexShrink: 0 }}>
        <MetricCard title="🔴 Critical Alerts" value={stats.critical} color="var(--red)" />
        <MetricCard title="🟠 High Risk" value={stats.high} color="var(--orange)" />
        <MetricCard title="⚡ Total Incidents" value={stats.total} color="var(--blue)" />
        <MetricCard title="🚄 Monitored Trains" value={stats.trains_monitored} color="var(--purple)" />
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1, minHeight: '400px' }}>
        
        {/* Live Feed */}
        <div className="glass-panel" style={{ flex: '0 0 350px' }}>
          <div className="glass-header">⚡ Live Alert Feed</div>
          <div className="glass-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {feed.length === 0 ? <p style={{color:'var(--t3)', textAlign:'center', marginTop:'50px'}}>Connecting to DRISHTI Engine...</p> : 
             feed.map(a => (
              <div key={a.id} style={{
                background: `var(--${a.severity.toLowerCase()}-g)`, 
                borderLeft: `3px solid var(--${a.severity.toLowerCase()})`,
                padding: '12px', borderRadius: '8px', animation: 'slideIn 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <Link to={`/train/${a.train_id}`} style={{ fontWeight: 600, fontSize: '0.85rem' }}>🚄 {a.train_id} {a.train_name}</Link>
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', border: `1px solid var(--${a.severity.toLowerCase()}-b)`, borderRadius: '4px', color: `var(--${a.severity.toLowerCase()})`, fontWeight: 700 }}>{a.severity}</span>
                </div>
                <div style={{ color: 'var(--t2)', fontSize: '0.75rem', marginBottom: '6px' }}>📍 {a.station_name}</div>
                <div style={{ color: 'var(--t3)', fontSize: '0.7rem' }}>{a.explanation.substring(0, 90)}...</div>
              </div>
            ))}
          </div>
        </div>

        {/* Charts & Map Teaser */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', gap: '16px', height: '240px' }}>
            {/* Donut */}
            <div className="glass-panel" style={{ flex: 1 }}>
              <div className="glass-header">Severity Ratio</div>
              <div className="glass-content" style={{ padding: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value" stroke="none">
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[entry.name.toUpperCase()]} />
                      ))}
                    </Pie>
                    <Tooltip cursor={{fill: 'var(--card-h)'}} contentStyle={{background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Zones */}
            <div className="glass-panel" style={{ flex: 1 }}>
              <div className="glass-header">Zone Alerts</div>
              <div className="glass-content" style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.entries(zones).sort((a,b)=>b[1].total-a[1].total).slice(0,5).map(([z, v]) => (
                  <div key={z} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--t2)', width: '40px' }}>{z}</span>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', margin: '0 12px', display: 'flex', overflow: 'hidden' }}>
                      <div style={{ width: `${(v.critical/v.total)*100}%`, background: 'var(--red)' }} />
                      <div style={{ width: `${(v.high/v.total)*100}%`, background: 'var(--orange)' }} />
                      <div style={{ width: `${(v.medium/v.total)*100}%`, background: 'var(--yellow)' }} />
                    </div>
                    <span style={{ color: 'var(--t1)' }}>{v.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-panel" style={{ flex: 1 }}>
            <div className="glass-header">Recent Incidents Timeline (Rolling)</div>
            <div style={{ padding: '16px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)' }}>
              <i>(Chart automatically populated by inference engine batches)</i>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({ title, value, color }) {
  return (
    <div className="glass-panel" style={{ borderTop: `2px solid ${color}` }}>
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', marginBottom: '8px' }}>{title}</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color, lineHeight: 1 }}>{Number(value).toLocaleString()}</div>
      </div>
    </div>
  )
}
