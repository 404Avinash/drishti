import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { Activity, Map, Cpu, Train, ShieldAlert } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import NetworkMap from './pages/Map'
import Models from './pages/Models'
import TrainDetail from './pages/TrainDetail'

function App() {
  const location = useLocation()

  const navs = [
    { name: 'Live Dashboard', path: '/', icon: <Activity size={18} /> },
    { name: 'Network Map', path: '/map', icon: <Map size={18} /> },
    { name: 'AI Models', path: '/models', icon: <Cpu size={18} /> },
  ]

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      
      {/* Sidebar */}
      <div style={{ width: '250px', background: 'rgba(5,9,26,0.96)', borderRight: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div style={{ width: '38px', height: '38px', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(59,130,246,0.45)' }}>
            <ShieldAlert color="white" size={20} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, background: 'linear-gradient(135deg, #60a5fa, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '2px' }}>
              DRISHTI
            </h1>
            <p style={{ fontSize: '0.6rem', color: 'var(--t3)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Intelligence
            </p>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navs.map((n) => {
            const active = location.pathname === n.path || (n.path !== '/' && location.pathname.startsWith(n.path))
            return (
              <Link 
                key={n.name}
                to={n.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '8px',
                  background: active ? 'var(--blue-g)' : 'transparent',
                  color: active ? 'var(--t1)' : 'var(--t2)',
                  fontWeight: active ? 600 : 500,
                  transition: '0.2s',
                  border: `1px solid ${active ? 'var(--blue)' : 'transparent'}`
                }}
              >
                {n.icon}
                <span style={{ fontSize: '0.85rem' }}>{n.name}</span>
              </Link>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: '16px', background: 'var(--card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--t2)', marginBottom: '8px' }}>System Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--green)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 10px var(--green)' }} />
            ONLINE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<NetworkMap />} />
          <Route path="/models" element={<Models />} />
          <Route path="/train/:id" element={<TrainDetail />} />
        </Routes>
      </div>
      
    </div>
  )
}

export default App
