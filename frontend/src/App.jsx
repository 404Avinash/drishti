import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import {
  Activity, ShieldAlert, Bell, ChevronRight,
  Terminal, Globe, AlertTriangle, X, Cpu, Home
} from 'lucide-react'
import HomePage from './pages/Home'
import NetworkPulse from './pages/Network'
import NetworkMap from './pages/Map'
import Models from './pages/Models'
import TrainDetail from './pages/TrainDetail'
import Alerts from './pages/Alerts'
import System from './pages/System'

/* ── helper: map severity → badge class ─────────────────────── */
const SEV_CLASS = { CRITICAL: 'badge-red', HIGH: 'badge-orange', MEDIUM: 'badge-yellow', LOW: 'badge-green' }

/* ── Toast notification queue ───────────────────────────────── */
function Toasts({ toasts, dismiss }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end'
    }}>
      {toasts.map(t => (
        <div key={t.id} className="anim-slide" style={{
          background: t.sev === 'CRITICAL' ? 'rgba(239,68,68,0.15)' : 'var(--bg3)',
          border: `1px solid ${t.sev === 'CRITICAL' ? 'var(--red-b)' : t.sev === 'HIGH' ? 'var(--orange-b)' : 'var(--border-b)'}`,
          borderRadius: 10, padding: '10px 14px', maxWidth: 320,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          animation: t.sev === 'CRITICAL' ? 'pulseGlow 1.5s infinite' : undefined,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
        }}>
          <AlertTriangle size={14} color={t.sev === 'CRITICAL' ? 'var(--red)' : t.sev === 'HIGH' ? 'var(--orange)' : 'var(--yellow)'} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>
              🚄 {t.train_id} · {t.station_name}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {t.explanation}
            </div>
          </div>
          <button onClick={() => dismiss(t.id)} style={{ background: 'none', color: 'var(--t3)', flexShrink: 0 }}>
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ── Sidebar nav item ────────────────────────────────────────── */
function NavItem({ to, icon, label, exact, badge }) {
  const loc = useLocation()
  const active = exact ? loc.pathname === to : loc.pathname.startsWith(to)
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
      borderRadius: 8, color: active ? 'var(--t1)' : 'var(--t3)',
      background: active ? 'var(--blue-gg)' : 'transparent',
      border: `1px solid ${active ? 'var(--blue-b)' : 'transparent'}`,
      fontWeight: active ? 600 : 500, fontSize: '0.82rem',
      transition: 'all 0.17s', position: 'relative'
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--t2)' }}}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t3)' }}}
    >
      <span style={{ color: active ? 'var(--blue)' : 'var(--t3)', transition: '0.17s' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{ background: 'var(--red)', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '1px 5px', borderRadius: 10, minWidth: 16, textAlign: 'center' }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

/* ── Main App ────────────────────────────────────────────────── */
export default function App() {
  const [stats, setStats] = useState({ total: 0, critical: 0, high: 0, medium: 0, low: 0, trains_monitored: 0 })
  const [toasts, setToasts] = useState([])
  const [wsStatus, setWsStatus] = useState('connecting') // connecting | live | offline
  const [unread, setUnread] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifHistory, setNotifHistory] = useState([])
  const navigate = useNavigate()
  const loc = useLocation()

  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), [])

  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live`
    let ws, retryTimer

    function connect() {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => setWsStatus('live')
      ws.onclose = () => {
        setWsStatus('offline')
        retryTimer = setTimeout(connect, 5000)
      }
      ws.onerror = () => setWsStatus('offline')
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        if (msg.stats) setStats(msg.stats)
        if (msg.type === 'alert' && msg.data) {
          const alert = { ...msg.data, id: msg.data.id || Date.now() }
          // Show toast for critical/high
          if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
            const toast = { ...alert, id: Date.now() + Math.random(), sev: alert.severity }
            setToasts(prev => [toast, ...prev].slice(0, 5))
            setTimeout(() => dismiss(toast.id), 7000)
          }
          setNotifHistory(prev => [alert, ...prev].slice(0, 50))
          setUnread(n => n + 1)
        }
      }
    }
    connect()
    return () => { ws?.close(); clearTimeout(retryTimer) }
  }, [dismiss])

  const clearUnread = () => setUnread(0)

  const navs = [
    { to: '/home', icon: <Home size={15} />, label: 'Overview', exact: true, badge: 0 },
    { to: '/network', icon: <Activity size={15} />, label: 'Network Pulse', exact: true, badge: stats.critical },
    { to: '/map', icon: <Globe size={15} />, label: 'Network Map', badge: 0 },
    { to: '/alerts', icon: <Bell size={15} />, label: 'Alerts', badge: unread },
    { to: '/models', icon: <Cpu size={15} />, label: 'AI Models', badge: 0 },
    { to: '/system', icon: <Terminal size={15} />, label: 'System', badge: 0 },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      
      {/* ── Sidebar ── */}
      <div style={{
        width: 'var(--sidebar-w)', flexShrink: 0,
        background: 'linear-gradient(180deg, #060b1f 0%, #04071a 100%)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        padding: '16px 12px'
      }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '4px 4px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: 32, height: 32, flexShrink: 0,
            background: 'var(--blue)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ShieldAlert color="white" size={16} />
          </div>
          <div>
            <div style={{
              fontSize: '1rem', fontWeight: 800, letterSpacing: 1.5,
              color: 'var(--t1)'
            }}>DRISHTI</div>
            <div style={{ fontSize: '0.62rem', color: 'var(--t3)', letterSpacing: 0.5 }}>NATIONAL RAILWAY GRID</div>
          </div>
        </div>

        {/* Nav group */}
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--t4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Overview</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 20 }}>
          {navs.slice(0,1).map(n => <NavItem key={n.to} {...n} />)}
        </nav>
        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--t4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Monitor</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 20 }}>
          {navs.slice(1,4).map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--t4)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 4 }}>Intelligence</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {navs.slice(4).map(n => <NavItem key={n.to} {...n} />)}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Stats summary */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Live Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
            {[
              { label: 'Critical', val: stats.critical, color: 'var(--red)' },
              { label: 'High',     val: stats.high,     color: 'var(--orange)' },
              { label: 'Trains',   val: stats.trains_monitored, color: 'var(--blue)' },
              { label: 'Total',    val: stats.total,    color: 'var(--t2)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '0.58rem', color: 'var(--t3)' }}>{s.label}</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* WS status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <span className={wsStatus === 'live' ? 'dot dot-green' : wsStatus === 'offline' ? 'dot dot-red' : 'dot dot-yellow'} />
          <span style={{ fontSize: '0.7rem', color: wsStatus === 'live' ? 'var(--green)' : wsStatus === 'offline' ? 'var(--red)' : 'var(--yellow)', fontWeight: 600 }}>
            {wsStatus === 'live' ? 'LIVE' : wsStatus === 'offline' ? 'OFFLINE' : 'CONNECTING…'}
          </span>
          {wsStatus === 'live' && (
            <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: 'var(--t3)', fontFamily: 'JetBrains Mono, monospace' }}>
              WS
            </span>
          )}
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* Top bar */}
        <div style={{
          height: 44, flexShrink: 0,
          background: 'rgba(4,7,26,0.92)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
          backdropFilter: 'blur(12px)'
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, fontSize: '0.8rem', color: 'var(--t2)' }}>
            <span style={{ color: 'var(--t3)' }}>DRISHTI</span>
            <ChevronRight size={12} color="var(--t4)" />
            <span style={{ color: 'var(--t1)', fontWeight: 600 }}>
              {loc.pathname === '/home' || loc.pathname === '/' ? 'Overview — Why DRISHTI' :
               loc.pathname.startsWith('/network') ? 'Network Intelligence Pulse' :
               loc.pathname.startsWith('/map') ? 'Network Map — 51 Junction Overlay' :
               loc.pathname.startsWith('/alerts') ? 'Live Alert Feed' :
               loc.pathname.startsWith('/models') ? 'AI Models & Explainability' :
               loc.pathname.startsWith('/system') ? 'System Status' :
               loc.pathname.startsWith('/train') ? `Train: ${loc.pathname.split('/')[2]}` : '—'}
            </span>
          </div>

          {/* Quick stats bar */}
          <div style={{ display: 'flex', gap: 16, fontSize: '0.72rem' }}>
            {[
              { label: '⚡', val: stats.total, col: 'var(--blue)' },
              { label: '🔴', val: stats.critical, col: 'var(--red)' },
              { label: '🚄', val: stats.trains_monitored, col: 'var(--cyan)' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{s.label}</span>
                <span style={{ color: s.col, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{s.val}</span>
              </div>
            ))}
          </div>

          {/* Notifications */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setNotifOpen(o => !o); clearUnread() }}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--t2)',
                borderRadius: 7, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: '0.75rem', transition: 'all 0.17s', cursor: 'pointer'
              }}
            >
              <Bell size={13} />
              {unread > 0 && (
                <span style={{ background: 'var(--red)', color: 'white', fontSize: '0.6rem', fontWeight: 800, padding: '0 4px', borderRadius: 8 }}>
                  {unread}
                </span>
              )}
            </button>

            {/* Notif dropdown */}
            {notifOpen && (
              <div className="anim-fade" style={{
                position: 'absolute', right: 0, top: 38, width: 320, zIndex: 1000,
                background: 'var(--bg2)', border: '1px solid var(--border-b)',
                borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                maxHeight: 400, overflow: 'hidden', display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Recent Alerts</span>
                  <button onClick={() => setNotifOpen(false)} style={{ background: 'none', color: 'var(--t3)', cursor: 'pointer' }}><X size={12} /></button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {notifHistory.length === 0
                    ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: '0.8rem' }}>No alerts yet</div>
                    : notifHistory.map((a, i) => (
                        <div key={i}
                          onClick={() => { navigate(`/train/${a.train_id}`); setNotifOpen(false) }}
                          style={{
                            padding: '10px 14px', borderBottom: '1px solid var(--border)',
                            cursor: 'pointer', transition: 'background 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--card-h)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: 600 }}>🚄 {a.train_id}</span>
                            <span className={`badge ${SEV_CLASS[a.severity]}`}>{a.severity}</span>
                          </div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--t2)' }}>📍 {a.station_name}</div>
                        </div>
                      ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Routes>
            <Route path="/"           element={<HomePage />} />
            <Route path="/home"       element={<HomePage />} />
            <Route path="/network"    element={<NetworkPulse />} />
            <Route path="/map"        element={<NetworkMap />} />
            <Route path="/alerts"     element={<Alerts />} />
            <Route path="/models"     element={<Models />} />
            <Route path="/system"     element={<System wsStatus={wsStatus} stats={stats} />} />
            <Route path="/train/:id"  element={<TrainDetail />} />
          </Routes>
        </div>
      </div>

      {/* Toast notifications */}
      <Toasts toasts={toasts} dismiss={dismiss} />
    </div>
  )
}
