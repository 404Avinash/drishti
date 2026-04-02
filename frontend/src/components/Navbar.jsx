import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { getAlerts } from '../api'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard',  icon: '⬡' },
  { to: '/network',   label: 'Network',    icon: '◎' },
  { to: '/trains',    label: 'Trains',     icon: '⟁' },
  { to: '/alerts',    label: 'Alerts',     icon: '⚠' },
  { to: '/ai',        label: 'AI Brain',   icon: '⬙' },
  { to: '/system',    label: 'System',     icon: '⊞' },
]

export default function Navbar() {
  const [critCount, setCritCount]   = useState(0)
  const [connected, setConnected]   = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch('/api/health')
        setConnected(res.ok)
        const data = await res.json()
        setConnected(data.status === 'ok' || data.status === 'healthy')
      } catch { setConnected(false) }
    }
    check()
    const healthIv = setInterval(check, 20000)

    const loadAlerts = async () => {
      try {
        const res  = await fetch('/api/alerts/history?limit=50')
        if (res.ok) {
          const data = await res.json()
          setCritCount(Array.isArray(data) ? data.filter(a => a.severity === 'CRITICAL').length : 0)
        }
      } catch { /* silent */ }
    }
    loadAlerts()
    const alertIv = setInterval(loadAlerts, 15000)

    return () => { clearInterval(healthIv); clearInterval(alertIv) }
  }, [])

  return (
    <nav style={S.nav} className="glass">
      {/* Logo */}
      <button style={S.logo} onClick={() => navigate('/')}>
        <span style={S.logoIcon}>◈</span>
        <div>
          <div style={S.logoName}>DRISHTI</div>
          <div style={S.logoSub}>NATIONAL RAILWAY GRID</div>
        </div>
      </button>

      {/* Links */}
      <div style={S.links}>
        {NAV_LINKS.map(({ to, label, icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            ...S.link, ...(isActive ? S.linkActive : {})
          })}>
            <span style={{ fontSize: 11 }}>{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Status pills */}
      <div style={S.right}>
        {critCount > 0 && (
          <button style={S.alertPill} onClick={() => navigate('/alerts')}>
            <span style={{ ...S.dot, background: 'var(--red)', animation: 'pulse-dot 1s ease-in-out infinite' }} />
            {critCount} CRITICAL
          </button>
        )}
        <div style={{ ...S.connPill, ...(connected ? S.connOn : S.connOff) }}>
          <span style={{
            ...S.dot,
            background: connected ? 'var(--green)' : 'var(--red)',
            animation: connected ? 'pulse-dot 2s ease-in-out infinite' : 'none',
          }} />
          {connected ? 'LIVE' : 'OFFLINE'}
        </div>
      </div>
    </nav>
  )
}

const S = {
  nav: {
    position: 'fixed', top: 0, left: 0, right: 0,
    height: 'var(--nav-h)', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 24px',
    zIndex: 1000, borderBottom: '1px solid var(--b1)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: 10,
    cursor: 'pointer', border: 'none', background: 'none',
  },
  logoIcon: {
    fontSize: 22, color: 'var(--cyan)',
    textShadow: '0 0 20px rgba(0,212,255,.7)',
    lineHeight: 1,
  },
  logoName: {
    fontWeight: 800, fontSize: 14, letterSpacing: '0.14em',
    color: 'var(--t1)', lineHeight: 1.2,
  },
  logoSub: {
    fontSize: 7.5, letterSpacing: '0.16em',
    color: 'var(--t3)', fontWeight: 600, lineHeight: 1,
    textTransform: 'uppercase',
  },
  links: { display: 'flex', gap: 2 },
  link: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 13px', borderRadius: 8,
    color: 'var(--t2)', fontSize: 12.5, fontWeight: 500,
    transition: 'all 180ms ease', textDecoration: 'none',
    letterSpacing: '0.02em',
  },
  linkActive: {
    background: 'var(--cyan-10)',
    color: 'var(--cyan)',
    boxShadow: 'inset 0 -2px 0 var(--cyan-30)',
  },
  right: { display: 'flex', alignItems: 'center', gap: 8 },
  alertPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 20,
    background: 'var(--red-10)', border: '1px solid var(--red-30)',
    color: 'var(--red)', fontSize: 10.5, fontWeight: 700,
    letterSpacing: '0.10em', cursor: 'pointer',
  },
  connPill: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '4px 12px', borderRadius: 20,
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.10em',
  },
  connOn: {
    background: 'var(--green-10)', border: '1px solid var(--green-30)',
    color: 'var(--green)',
  },
  connOff: {
    background: 'var(--red-10)', border: '1px solid var(--red-30)',
    color: 'var(--red)',
  },
  dot: {
    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
  },
}
