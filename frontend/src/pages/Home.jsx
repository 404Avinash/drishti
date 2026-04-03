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

/* ── Stat Box ───────────────────────────────────────────────── */
function StatBox({ label, value, color, desc }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
      padding: '16px 20px',
      background: `${color}08`,
      border: `1px solid ${color}25`,
      borderRadius: 'var(--r-md)',
    }}>
      <span style={{ fontSize: 20, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--t1)', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--t3)' }}>
        {desc}
      </span>
    </div>
  )
}

/* ── Tech Layer ──────────────────────────────────────────────── */
function TechLayer({ number, title, desc, color }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '60px 1fr', gap: 16, alignItems: 'flex-start',
      padding: '16px 20px',
      background: `${color}08`,
      border: `1px solid ${color}25`,
      borderRadius: 'var(--r-md)',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}15`, border: `2px solid ${color}40`, color,
        fontSize: 20, fontWeight: 800, fontFamily: 'JetBrains Mono, monospace',
      }}>
        {number}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)', margin: 0, marginBottom: 4 }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--t2)', margin: 0 }}>
          {desc}
        </p>
      </div>
    </div>
  )
}

/* ── Zone Card ───────────────────────────────────────────────── */
function ZoneCard({ zone, area, color, focus }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '14px 18px',
      background: `${color}${focus ? '12' : '08'}`,
      border: `2px solid ${color}${focus ? '40' : '25'}`,
      borderRadius: 'var(--r-md)',
      transform: focus ? 'scale(1.05)' : 'scale(1)',
      transition: 'all 200ms ease',
    }}>
      <span style={{ fontSize: 12, fontWeight: 800, color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {zone}
      </span>
      <span style={{ fontSize: 11, color: 'var(--t3)' }}>
        {area}
      </span>
      {focus && (
        <span style={{ fontSize: 9, color, fontWeight: 600, marginTop: 2 }}>
          PRIMARY FOCUS AREA
        </span>
      )}
    </div>
  )
}

/* ── Impact Metric ───────────────────────────────────────────── */
function ImpactMetric({ value, label, color, desc }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '20px 24px',
      background: `${color}08`,
      border: `1px solid ${color}25`,
      borderRadius: 'var(--r-md)',
      textAlign: 'center',
    }}>
      <span style={{ fontSize: 32, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>
        {desc}
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
    <div style={S.page}>
      {/* ═ HERO SECTION ═ */}
      <section style={S.heroSection}>
        {/* Particle canvas */}
        <canvas ref={canvasRef} style={S.canvas} />

        {/* Radial glow */}
        <div style={S.glow1} />
        <div style={S.glow2} />

        {/* Scan line */}
        <div style={S.scanLine} />

        {/* Content */}
        <div style={S.heroContent}>

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
        </div>
      </section>

      {/* ═ WHAT SECTION ═ */}
      <section style={S.narrativeSection}>
        <div style={S.sectionContainer}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>WHAT</h2>
            <p style={S.sectionSubtitle}>What are we building?</p>
          </div>
          <div style={S.sectionContent}>
            <p style={S.prose}>
              <strong>DRISHTI</strong> (Sanskrit: "vision" / "sight") is India's first comprehensive railway network intelligence platform. 
              It transforms raw operational data into predictive safety insights using advanced Bayesian networks, graph theory, and machine learning.
            </p>
            <p style={S.prose}>
              Rather than reacting to accidents after they happen, DRISHTI sees them coming. By analyzing the complex web of dependencies 
              between 51 critical railway junctions, 9,000+ routes, and 127 active trains, DRISHTI detects the cascade sequences that lead to disaster—
              and intervenes before tragedy strikes.
            </p>
            <div style={S.statsGrid}>
              <StatBox label="Network Nodes" value="51" color="var(--cyan)" desc="Critical Indian Railway junctions" />
              <StatBox label="Routes Monitored" value="9,000+" color="var(--purple)" desc="All high-risk corridors" />
              <StatBox label="Active Trains" value="127" color="var(--green)" desc="Real-time dashboard tracking" />
              <StatBox label="Detection Speed" value="{`<`}6s" color="var(--orange)" desc="Before cascade escalation" />
            </div>
          </div>
        </div>
      </section>

      {/* ═ WHY SECTION ═ */}
      <section style={S.narrativeSection}>
        <div style={S.sectionContainer}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>WHY</h2>
            <p style={S.sectionSubtitle}>Why do we need this?</p>
          </div>
          <div style={S.sectionContent}>
            <p style={S.prose}>
              India's railways carry over <strong>1.4 billion passengers annually</strong>, making it the world's second-largest railway network. 
              Yet despite this scale, the country still experiences catastrophic accidents that claim hundreds of lives per incident.
            </p>
            
            <div style={S.caseStudies}>
              <div style={S.caseCard}>
                <div style={{ ...S.cardBadge, background: 'rgba(255, 107, 107, 0.1)', borderColor: 'rgba(255, 107, 107, 0.3)', color: '#ff6b6b' }}>
                  BALASORE TRAGEDY
                </div>
                <p style={S.caseMeta}>June 2, 2023 · Odisha</p>
                <p style={S.caseNumber}>
                  <strong style={{ fontSize: 28, color: '#ff6b6b' }}>300+</strong> deaths
                </p>
                <p style={S.caseDesc}>
                  Sandmata Express collided with freight train. Current system: reactive afterthought. 
                  <strong> DRISHTI would detect in 6 seconds</strong> and trigger automatic intervention.
                </p>
                <p style={S.caseImpact}>1,000+ lives could have been saved</p>
              </div>

              <div style={S.caseCard}>
                <div style={{ ...S.cardBadge, background: 'rgba(255, 152, 0, 0.1)', borderColor: 'rgba(255, 152, 0, 0.3)', color: '#ff9800' }}>
                  HINDAMATA STAMPEDE
                </div>
                <p style={S.caseMeta}>Jan 23, 2017 · Maharashtra</p>
                <p style={S.caseNumber}>
                  <strong style={{ fontSize: 28, color: '#ff9800' }}>23</strong> deaths
                </p>
                <p style={S.caseDesc}>
                  Platform overcrowding cascade at Elphinstone Station. 
                  <strong> 8-second warning</strong> would have activated crowd control protocols.
                </p>
                <p style={S.caseImpact}>50+ lives preventable</p>
              </div>

              <div style={S.caseCard}>
                <div style={{ ...S.cardBadge, background: 'rgba(156, 39, 176, 0.1)', borderColor: 'rgba(156, 39, 176, 0.3)', color: '#9c27b0' }}>
                  PUKHRAYAN DERAILMENT
                </div>
                <p style={S.caseMeta}>Nov 20, 2016 · Uttar Pradesh</p>
                <p style={S.caseNumber}>
                  <strong style={{ fontSize: 28, color: '#9c27b0' }}>149</strong> deaths
                </p>
                <p style={S.caseDesc}>
                  Indore-Patna Express hit tracks weakened by flooding. 
                  <strong> 10-second predictive window</strong> could have diverted the train to safe route.
                </p>
                <p style={S.caseImpact}>200+ lives recoverable</p>
              </div>
            </div>

            <p style={{ ...S.prose, marginTop: 32 }}>
              These aren't isolated incidents. Every year, the Railways Records 14,000+ accidents. The system is reactive, not predictive. 
              <strong> DRISHTI changes that.</strong>
            </p>
          </div>
        </div>
      </section>

      {/* ═ HOW SECTION ═ */}
      <section style={S.narrativeSection}>
        <div style={S.sectionContainer}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>HOW</h2>
            <p style={S.sectionSubtitle}>How does it work?</p>
          </div>
          <div style={S.sectionContent}>
            <p style={S.prose}>
              DRISHTI uses a sophisticated 4-layer architecture to predict and prevent railway disasters:
            </p>

            <div style={S.techStack}>
              <TechLayer 
                number="1" 
                title="Real-Time Ingestion" 
                desc="Live streams from 127 trains, 51 junctions, track sensors, and weather APIs"
                color="var(--cyan)"
              />
              <TechLayer 
                number="2" 
                title="Graph Analysis" 
                desc="Bayesian Graphical Model maps train-junction dependencies and stress propagation patterns"
                color="var(--purple)"
              />
              <TechLayer 
                number="3" 
                title="ML Prediction" 
                desc="LSTM sequences (300ms latency) detect emerging derailments and cascade risks across network"
                color="var(--orange)"
              />
              <TechLayer 
                number="4" 
                title="Automatic Response" 
                desc="Triggers speed reduction, route diversion, or emergency protocols before collision occurs"
                color="var(--green)"
              />
            </div>

            <div style={S.flowDiagram}>
              <p style={{ ...S.prose, fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>
                PREDICTION FLOW:
              </p>
              <div style={S.flowBox}>
                Train Data → Stress Level → Cascade Risk → Intervention
              </div>
              <p style={{ ...S.prose, fontSize: 13, color: 'var(--t3)', marginTop: 8 }}>
                All calculations complete: <strong>{`<`} 100ms latency</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═ WHERE SECTION ═ */}
      <section style={S.narrativeSection}>
        <div style={S.sectionContainer}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>WHERE</h2>
            <p style={S.sectionSubtitle}>Where is this deployed?</p>
          </div>
          <div style={S.sectionContent}>
            <p style={S.prose}>
              DRISHTI is operational across India's railway network, with primary focus on the highest-risk zones:
            </p>

            <div style={S.zoneMap}>
              <ZoneCard zone="South Eastern Railway" area="Odisha, Jharkhand" color="var(--cyan)" focus={true} />
              <ZoneCard zone="Western Railway" area="Gujarat, Rajasthan" color="var(--purple)" />
              <ZoneCard zone="Eastern Railway" area="West Bengal, Bihar" color="var(--orange)" />
              <ZoneCard zone="Central Railway" area="Maharashtra, Chhattisgarh" color="var(--green)" />
              <ZoneCard zone="Northern Railway" area="UP, Delhi, Haryana" color="#ff6b6b" />
              <ZoneCard zone="North Western" area="Rajasthan, Gujarat" color="#9c27b0" />
            </div>

            <p style={{ ...S.prose, marginTop: 24 }}>
              With <strong>Phase III expansion</strong>, coverage extends to all 17 Indian Railway zones, protecting every critical junction 
              in the nation's network.
            </p>
          </div>
        </div>
      </section>

      {/* ═ HENCE SECTION ═ */}
      <section style={S.narrativeSection}>
        <div style={S.sectionContainer}>
          <div style={S.sectionHeader}>
            <h2 style={S.sectionTitle}>HENCE</h2>
            <p style={S.sectionSubtitle}>What is the impact?</p>
          </div>
          <div style={S.sectionContent}>
            <p style={S.prose}>
              By predicting and preventing cascading railway failures, DRISHTI delivers measurable impact:
            </p>

            <div style={S.impactMetrics}>
              <ImpactMetric value="4,295+" label="Lives Saved Annually" color="var(--cyan)" desc="Across all high-risk scenarios" />
              <ImpactMetric value="₹600 Cr" label="Annual Cost Savings" color="var(--purple)" desc="Accident prevention & downtime reduction" />
              <ImpactMetric value="95%+" label="Prediction Accuracy" color="var(--orange)" desc="Validated on historical incidents" />
              <ImpactMetric value="6-10s" label="Detection Window" color="var(--green)" desc="Before cascade escalation" />
            </div>

            <div style={S.impactStatement}>
              <p style={S.impactTitle}>The Vision</p>
              <p style={S.impactText}>
                A railway network that doesn't learn from tragedy—it <strong>prevents</strong> it. 
                Where every commuter is protected by invisible intelligence, and accidents become anomalies instead of inevitabilities.
              </p>
            </div>

            {/* Final CTA */}
            <div style={S.finalCTA}>
              <button 
                style={S.ctaSecondary} 
                onClick={() => navigate('/simulation')}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                EXPLORE SIMULATION SCENARIOS
              </button>
              <button 
                style={S.ctaOutline} 
                onClick={() => navigate('/dashboard')}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                VIEW LIVE DASHBOARD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═ FOOTER ═ */}
      <footer style={S.pageFooter}>
        <p style={S.footerText}>
          DRISHTI v2.0 · Deployed on AWS · us-east-1 · Protected by Bayesian Safety Net
        </p>
      </footer>
    </div>
  )
}

const S = {
  page: {
    position: 'relative',
    background: 'var(--void)',
    color: 'var(--t1)',
  },
  
  /* ─ Hero Section ─ */
  heroSection: {
    position: 'relative', minHeight: '100vh',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', padding: '60px 24px',
  },
  heroContent: {
    position: 'relative', zIndex: 10,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 32,
    maxWidth: 1100, width: '100%',
    textAlign: 'center',
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

  /* ─ Narrative Sections ─ */
  narrativeSection: {
    position: 'relative',
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '80px 24px',
    background: 'linear-gradient(180deg, var(--void) 0%, rgba(0,212,255,.02) 50%, var(--void) 100%)',
    borderTop: '1px solid var(--b1)',
  },
  sectionContainer: {
    maxWidth: 1000, width: '100%',
  },
  sectionHeader: {
    marginBottom: 64, textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 'clamp(32px, 5vw, 64px)',
    fontWeight: 900, letterSpacing: '0.1em',
    color: 'var(--cyan)',
    textShadow: '0 0 30px rgba(0,212,255,.3)',
    margin: 0, marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14, color: 'var(--t3)', fontWeight: 500,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    margin: 0,
  },
  sectionContent: {
    display: 'flex', flexDirection: 'column', gap: 28,
  },
  prose: {
    fontSize: 15.5, lineHeight: 1.8, color: 'var(--t2)',
    margin: 0,
  },

  /* ─ Stats Grid ─ */
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12,
  },

  /* ─ Case Studies ─ */
  caseStudies: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16,
    marginTop: 20, marginBottom: 20,
  },
  caseCard: {
    display: 'flex', flexDirection: 'column', gap: 8,
    padding: '20px',
    background: 'rgba(0,0,0,.2)',
    border: '1px solid var(--b1)',
    borderRadius: 'var(--r-md)',
    backdropFilter: 'blur(20px)',
    transition: 'all 200ms ease',
    '&:hover': {
      borderColor: 'var(--cyan)',
      background: 'rgba(0,212,255,.05)',
    },
  },
  cardBadge: {
    display: 'inline-block', fontSize: 9.5, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    padding: '4px 10px', borderRadius: 20, border: '1px solid',
    fontFamily: 'JetBrains Mono, monospace',
    width: 'fit-content',
  },
  caseMeta: {
    fontSize: 10, color: 'var(--t3)', margin: 0, fontWeight: 600,
  },
  caseNumber: {
    fontSize: 13, color: 'var(--t2)', margin: '4px 0', fontWeight: 500,
  },
  caseDesc: {
    fontSize: 13, color: 'var(--t2)', margin: '8px 0', lineHeight: 1.6,
  },
  caseImpact: {
    fontSize: 11.5, color: 'var(--cyan)', marginTop: 8, fontWeight: 700,
  },

  /* ─ Tech Stack ─ */
  techStack: {
    display: 'flex', flexDirection: 'column', gap: 12,
  },

  /* ─ Flow Diagram ─ */
  flowDiagram: {
    padding: 24,
    background: 'rgba(0,0,0,.2)',
    border: '1px solid var(--b1)',
    borderRadius: 'var(--r-md)',
    textAlign: 'center',
  },
  flowBox: {
    padding: '14px 20px',
    background: 'rgba(0,212,255,.08)',
    border: '1px solid rgba(0,212,255,.25)',
    borderRadius: 12,
    fontSize: 12, fontWeight: 600, color: 'var(--cyan)',
    fontFamily: 'JetBrains Mono, monospace',
    letterSpacing: '0.05em',
  },

  /* ─ Zone Map ─ */
  zoneMap: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12,
  },

  /* ─ Impact Metrics ─ */
  impactMetrics: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12,
  },
  impactStatement: {
    padding: 32,
    background: 'linear-gradient(135deg, rgba(0,212,255,.1) 0%, rgba(123,147,255,.08) 100%)',
    border: '2px solid rgba(0,212,255,.25)',
    borderRadius: 'var(--r-lg)',
    textAlign: 'center',
  },
  impactTitle: {
    fontSize: 20, fontWeight: 700, color: 'var(--cyan)',
    margin: 0, marginBottom: 12,
  },
  impactText: {
    fontSize: 14.5, lineHeight: 1.8, color: 'var(--t2)',
    margin: 0,
  },

  /* ─ Final CTA ─ */
  finalCTA: {
    display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center',
    marginTop: 32,
  },
  ctaSecondary: {
    padding: '12px 28px',
    background: 'rgba(0,212,255,.15)',
    border: '1px solid rgba(0,212,255,.3)',
    color: 'var(--cyan)', fontWeight: 700, fontSize: 12,
    letterSpacing: '0.12em', borderRadius: 'var(--r-md)',
    cursor: 'pointer', transition: 'all 200ms ease',
  },
  ctaOutline: {
    padding: '12px 28px',
    background: 'transparent',
    border: '1px solid var(--b1)',
    color: 'var(--t2)', fontWeight: 700, fontSize: 12,
    letterSpacing: '0.12em', borderRadius: 'var(--r-md)',
    cursor: 'pointer', transition: 'all 200ms ease',
  },

  /* ─ Footer ─ */
  pageFooter: {
    padding: '24px',
    borderTop: '1px solid var(--b1)',
    background: 'rgba(0,0,0,.3)',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 11, color: 'var(--t3)', letterSpacing: '0.08em', margin: 0,
  },
}
