import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* ── Particle system ─────────────────────────────────────────── */
function useParticles(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    /* Stars */
    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random(),
      dAlpha: (Math.random() * 0.008 + 0.003) * (Math.random() > 0.5 ? 1 : -1),
    }))

    /* Floating nodes */
    const nodes = Array.from({ length: 28 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2.5 + 1,
      alpha: Math.random() * 0.5 + 0.2,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      /* Stars */
      stars.forEach(s => {
        s.alpha += s.dAlpha
        if (s.alpha <= 0 || s.alpha >= 1) s.dAlpha *= -1
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(200,220,255,${Math.max(0, Math.min(1, s.alpha))})`
        ctx.fill()
      })

      /* Node connections */
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 160) {
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(0,212,255,${(1 - dist / 160) * 0.12})`
            ctx.lineWidth = 0.8
            ctx.stroke()
          }
        }
      }

      /* Nodes */
      nodes.forEach(n => {
        n.x += n.vx; n.y += n.vy
        if (n.x < 0 || n.x > canvas.width)  n.vx *= -1
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0,212,255,${n.alpha * 0.6})`
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])
}

/* ── Typewriter hook ─────────────────────────────────────────── */
function useTypewriter(text, speed = 40) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    setDisplayed('')
    let i = 0
    const timer = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(timer)
    }, speed)
    return () => clearInterval(timer)
  }, [text, speed])
  return displayed
}

/* ── Live ticker ─────────────────────────────────────────────── */
function Ticker({ items }) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!items.length) return
    const t = setInterval(() => setIdx(i => (i + 1) % items.length), 3200)
    return () => clearInterval(t)
  }, [items.length])
  if (!items.length) return null
  return (
    <div style={TS.wrap}>
      <span style={TS.tag}>LIVE FEED</span>
      <span style={TS.text} key={idx}>{items[idx]}</span>
    </div>
  )
}
const TS = {
  wrap: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '8px 20px',
    background: 'rgba(0,212,255,.04)',
    border: '1px solid var(--b1)',
    borderRadius: 40, fontSize: 12, color: 'var(--t2)',
    maxWidth: 560,
  },
  tag: {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
    color: 'var(--cyan)', fontFamily: 'JetBrains Mono, monospace',
    background: 'var(--cyan-10)', padding: '2px 8px',
    borderRadius: 20, whiteSpace: 'nowrap',
  },
  text: {
    animation: 'fade-in 400ms ease',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
}

/* ── Feature card ────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, color, to, badge }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={() => navigate(to)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...FC.card,
        borderColor: hovered ? `${color}44` : 'var(--b1)',
        background: hovered ? `rgba(0,0,0,.3)` : 'rgba(0,0,0,.2)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? `0 20px 40px ${color}22` : 'none',
      }}
    >
      <div style={{ ...FC.iconWrap, background: `${color}15`, border: `1px solid ${color}30` }}>
        <span style={{ fontSize: 22, color }}>{icon}</span>
      </div>
      <div style={FC.title}>{title}</div>
      <div style={FC.desc}>{desc}</div>
      {badge && (
        <div style={{ ...FC.badge, color, borderColor: `${color}40`, background: `${color}10` }}>
          {badge}
        </div>
      )}
      <div style={{ ...FC.arrow, color }}>→</div>
    </button>
  )
}
const FC = {
  card: {
    flex: '1 1 200px', minWidth: 200, maxWidth: 300,
    padding: '28px 24px 22px',
    background: 'rgba(0,0,0,.2)',
    border: '1px solid var(--b1)',
    borderRadius: 'var(--r-lg)',
    cursor: 'pointer',
    textAlign: 'left',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    transition: 'all 280ms cubic-bezier(.25,.8,.25,1)',
    display: 'flex', flexDirection: 'column', gap: 10,
    position: 'relative',
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontSize: 16, fontWeight: 700, color: 'var(--t1)', letterSpacing: '0.02em',
  },
  desc: {
    fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.6, flex: 1,
  },
  badge: {
    display: 'inline-block', fontSize: 9.5, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    padding: '3px 10px', borderRadius: 20, border: '1px solid',
    fontFamily: 'JetBrains Mono, monospace',
    width: 'fit-content',
  },
  arrow: {
    position: 'absolute', bottom: 22, right: 24,
    fontSize: 16, fontWeight: 700,
  },
}

/* ── Metric pill ─────────────────────────────────────────────── */
function MetricPill({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      padding: '14px 28px',
      background: `${color}08`,
      border: `1px solid ${color}25`,
      borderRadius: 'var(--r-md)',
    }}>
      <span style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  )
}

/* ── Main Home ───────────────────────────────────────────────── */
export default function Home() {
  const navigate  = useNavigate()
  const canvasRef = useRef(null)
  const [stats, setStats]     = useState({ trains: 0, nodes: 51, critical: 0, alerts: 0 })
  const [tickItems, setTickItems] = useState(['Initializing DRISHTI intelligence grid...'])
  const headline = useTypewriter('India\'s Railway Safety Intelligence Platform', 28)

  useParticles(canvasRef)

  useEffect(() => {
    const load = async () => {
      try {
        const [trainsRes, alertsRes] = await Promise.allSettled([
          fetch('/api/trains/current'),
          fetch('/api/alerts/history?limit=20'),
        ])
        let trains = [], alerts = []
        if (trainsRes.status === 'fulfilled' && trainsRes.value.ok) {
          trains = await trainsRes.value.json()
        }
        if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
          alerts = await alertsRes.value.json()
        }
        const critical = Array.isArray(trains) ? trains.filter(t => t.stress_level === 'CRITICAL').length : 0
        setStats({
          trains:   Array.isArray(trains) ? trains.length : 0,
          nodes:    51,
          critical,
          alerts:   Array.isArray(alerts) ? alerts.length : 0,
        })
        const items = [
          `Monitoring ${Array.isArray(trains) ? trains.length : 0} active trains across 9,000+ routes`,
          `51 high-centrality junctions under continuous AI surveillance`,
          `Bayesian Network inference latency: < 100ms`,
          `CRS accident signature matching active`,
          `Zone controllers: NR · SR · ER · WR · CR · SER · NFR · NWR · SCR`,
          ...(Array.isArray(alerts) && alerts.length
            ? [`${alerts.length} safety events recorded in last 24 hours`]
            : ['Network stable — no critical events detected']),
        ]
        setTickItems(items)
      } catch { /* silent */ }
    }
    load()
    const iv = setInterval(load, 30000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={S.root}>
      {/* Particle canvas */}
      <canvas ref={canvasRef} style={S.canvas} />

      {/* Radial glow */}
      <div style={S.glow1} />
      <div style={S.glow2} />

      {/* Scan line */}
      <div style={S.scanLine} />

      {/* Content */}
      <div style={S.content}>

        {/* Badge */}
        <div style={{ animation: 'slide-up 600ms ease 100ms both' }}>
          <div style={S.badge}>
            <span style={S.badgeDot} />
            OPERATIONAL · PHASE II PRODUCTION
          </div>
        </div>

        {/* Logo */}
        <div style={{ animation: 'slide-up 700ms ease 200ms both' }}>
          <div style={S.logo}>DRISHTI</div>
          <div style={S.logoSub}>NATIONAL RAILWAY GRID</div>
        </div>

        {/* Headline */}
        <div style={{ animation: 'slide-up 700ms ease 300ms both' }}>
          <p style={S.headline}>{headline}<span style={S.cursor}>│</span></p>
        </div>

        {/* Metrics */}
        <div style={{ ...S.metrics, animation: 'slide-up 700ms ease 450ms both' }}>
          <MetricPill label="Trains Monitored" value={stats.trains} color="var(--cyan)" />
          <MetricPill label="Junction Nodes"   value={stats.nodes}  color="var(--purple)" />
          <MetricPill label="Critical Alerts"  value={stats.critical} color="var(--red)" />
          <MetricPill label="Zone Coverage"    value="9 / 9"         color="var(--green)" />
        </div>

        {/* Ticker */}
        <div style={{ animation: 'slide-up 700ms ease 550ms both' }}>
          <Ticker items={tickItems} />
        </div>

        {/* CTA buttons */}
        <div style={{ ...S.ctaRow, animation: 'slide-up 700ms ease 650ms both' }}>
          <button style={S.ctaPrimary} onClick={() => navigate('/dashboard')}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 40px rgba(0,212,255,.5)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 20px rgba(0,212,255,.25)'}>
            ENTER COMMAND CENTER →
          </button>
        </div>

        {/* Feature cards */}
        <div style={{ ...S.cards, animation: 'slide-up 700ms ease 750ms both' }}>
          <FeatureCard
            icon="◎"
            title="Network Intelligence"
            desc="Real-time graph of India's 51 most critical railway junctions with live stress overlays and cascade risk visualization."
            color="var(--cyan)"
            to="/network"
            badge="51 NODES LIVE"
          />
          <FeatureCard
            icon="⚠"
            title="Alert Command"
            desc="Live safety alerts, CRS historical signature matching, and AI-generated incident explanations across all zones."
            color="var(--orange)"
            to="/alerts"
            badge="REAL-TIME"
          />
          <FeatureCard
            icon="⬙"
            title="AI Bayesian Brain"
            desc="Probabilistic graphical model for exact inference on operational risks. SHAP-powered explainability for every prediction."
            color="var(--purple)"
            to="/ai"
            badge="PGMPY ENGINE"
          />
        </div>

        {/* Footer */}
        <div style={{ animation: 'fade-in 1s ease 1s both' }}>
          <p style={S.footer}>
            DRISHTI v2.0 · Deployed on AWS · us-east-1 · Protected by Bayesian Safety Net
          </p>
        </div>
      </div>
    </div>
  )
}

const S = {
  root: {
    position: 'relative', minHeight: '100vh',
    background: 'var(--void)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: '60px 24px',
  },
  canvas: {
    position: 'absolute', inset: 0,
    pointerEvents: 'none', zIndex: 0,
  },
  glow1: {
    position: 'absolute', top: '-15%', left: '50%',
    transform: 'translateX(-50%)',
    width: 800, height: 800,
    background: 'radial-gradient(circle, rgba(0,212,255,.08) 0%, transparent 65%)',
    pointerEvents: 'none', zIndex: 1,
  },
  glow2: {
    position: 'absolute', bottom: '0%', right: '-10%',
    width: 500, height: 500,
    background: 'radial-gradient(circle, rgba(123,147,255,.06) 0%, transparent 65%)',
    pointerEvents: 'none', zIndex: 1,
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(0,212,255,.15), transparent)',
    animation: 'scan-line 6s linear infinite',
    pointerEvents: 'none', zIndex: 2,
  },
  content: {
    position: 'relative', zIndex: 10,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 32,
    maxWidth: 1100, width: '100%',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '5px 16px', borderRadius: 40,
    background: 'var(--cyan-10)', border: '1px solid var(--cyan-30)',
    color: 'var(--cyan)', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.16em', fontFamily: 'JetBrains Mono, monospace',
  },
  badgeDot: {
    width: 6, height: 6, borderRadius: '50%',
    background: 'var(--cyan)',
    boxShadow: '0 0 8px var(--cyan)',
    animation: 'pulse-dot 1.5s ease-in-out infinite',
  },
  logo: {
    fontSize: 'clamp(56px, 10vw, 96px)',
    fontWeight: 900, letterSpacing: '0.18em',
    color: 'var(--cyan)',
    textShadow: '0 0 40px rgba(0,212,255,.6), 0 0 80px rgba(0,212,255,.2)',
    fontFamily: 'Inter, sans-serif',
    lineHeight: 1,
    animation: 'glow-pulse 3s ease-in-out infinite',
  },
  logoSub: {
    fontSize: 12, letterSpacing: '0.38em', color: 'var(--t3)',
    fontWeight: 600, textTransform: 'uppercase', marginTop: 4,
  },
  headline: {
    fontSize: 'clamp(14px, 2.2vw, 20px)',
    color: 'var(--t2)', fontWeight: 400, lineHeight: 1.5,
    maxWidth: 600,
  },
  cursor: {
    color: 'var(--cyan)', animation: 'glow-pulse 1s ease-in-out infinite',
  },
  metrics: {
    display: 'flex', gap: 12, flexWrap: 'wrap',
    justifyContent: 'center',
  },
  ctaRow: { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: {
    padding: '14px 36px',
    background: 'linear-gradient(135deg, var(--cyan), #0099cc)',
    color: '#000', fontWeight: 800, fontSize: 13,
    letterSpacing: '0.12em', borderRadius: 'var(--r-md)',
    cursor: 'pointer', border: 'none',
    boxShadow: '0 0 20px rgba(0,212,255,.25)',
    transition: 'all 200ms ease',
  },
  cards: {
    display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
    width: '100%',
  },
  footer: {
    fontSize: 11, color: 'var(--t3)', letterSpacing: '0.08em',
  },
}
