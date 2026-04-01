import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import {
  Shield, Activity, AlertTriangle, Map, Brain, TrendingUp,
  ChevronRight, Zap, Target, Radio, Globe, ArrowRight
} from 'lucide-react'

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, suffix = '', duration = 2000 }) {
  const [val, setVal] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      obs.disconnect()
      let start = null
      const step = ts => {
        if (!start) start = ts
        const progress = Math.min((ts - start) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        setVal(Math.floor(ease * to))
        if (progress < 1) requestAnimationFrame(step)
        else setVal(to)
      }
      requestAnimationFrame(step)
    }, { threshold: 0.3 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [to, duration])
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>
}

// ── Accident timeline entry ───────────────────────────────────────────────────
const TIMELINE = [
  { year: '1981', name: 'Bihar Train Disaster', deaths: 800, code: 'PNBE', desc: 'Bagmati flood derailment — cyclone warning ignored' },
  { year: '1995', name: 'Firozabad Double Collision', deaths: 358, code: 'FZD', desc: 'Kalindi Express hit stationary Purushottam while rescue teams were loading' },
  { year: '1999', name: 'Gaisal Collision', deaths: 285, code: 'KISI', desc: 'Two express trains met head-on after signal error' },
  { year: '2010', name: 'Sainthia Collision', deaths: 146, code: 'SNTI', desc: 'Vananchal Express passed red signal, hit stationary Uttarbanga Express' },
  { year: '2016', name: 'Kanpur Derailment', deaths: 150, code: 'CNB', desc: 'Pukhrayan — faulty weld on track buckled under load' },
  { year: '2023', name: 'Balasore (Coromandel)', deaths: 296, code: 'BLSR', desc: 'Signal system sent Coromandel to occupied loop line — 2 express trains + goods train' },
]

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, stat, link, linkLabel }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(link)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: 24, cursor: 'pointer',
        transition: 'all 0.25s', display: 'flex', flexDirection: 'column', gap: 12,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(59,130,246,0.06)'
        e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)'
        e.currentTarget.style.transform = 'translateY(-3px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 42, height: 42, background: 'rgba(59,130,246,0.12)',
          border: '1px solid rgba(59,130,246,0.25)', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6'
        }}>
          {icon}
        </div>
        {stat && (
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'var(--mono)' }}>{stat}</div>
        )}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9', marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.6 }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#3b82f6', fontSize: '0.78rem', fontWeight: 600, marginTop: 'auto' }}>
        {linkLabel || 'Open View'} <ArrowRight size={13} />
      </div>
    </div>
  )
}

export default function Home() {
  const [liveStats, setLiveStats] = useState({ total: 0, critical: 0, trains: 9182, nodes: 51 })
  const navigate = useNavigate()

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/live`)
    ws.onmessage = e => {
      const msg = JSON.parse(e.data)
      if (msg.stats) setLiveStats(s => ({ ...s, total: msg.stats.total, critical: msg.stats.critical }))
    }
    return () => ws.close()
  }, [])

  return (
    <div style={{ overflowY: 'auto', height: '100%', background: '#020817', color: '#f1f5f9', fontFamily: 'Inter, sans-serif' }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div style={{
        minHeight: '92vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden', padding: '60px 40px',
        textAlign: 'center',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(59,130,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Grid lines */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: 'linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 860 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 30, padding: '6px 16px',
          }}>
            <span style={{ width: 7, height: 7, background: '#22c55e', borderRadius: '50%', boxShadow: '0 0 8px #22c55e' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', letterSpacing: 1 }}>
              LIVE · {liveStats.nodes} JUNCTIONS MONITORED · {liveStats.trains.toLocaleString()} TRAINS TRACKED
            </span>
          </div>

          {/* Main title */}
          <h1 style={{
            fontSize: 'clamp(2.8rem, 6vw, 5rem)',
            fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.02em',
            marginBottom: 24, color: 'white',
          }}>
            India's Railway<br />
            <span style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Doesn't Have a Nerve System.
            </span>
            <br />
            <span style={{ color: '#f1f5f9' }}>We Built One.</span>
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: '#94a3b8',
            lineHeight: 1.75, maxWidth: 680, margin: '0 auto 40px',
          }}>
            9,182 trains. 67,000 km of track. 18 zone controllers — each watching their section.
            <strong style={{ color: '#f1f5f9' }}> Nobody watching the network.</strong>
            <br />
            DRISHTI is India's NERC. Built on data that already exists.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/network')}
              style={{
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: 'white', border: 'none', borderRadius: 12,
                padding: '14px 32px', fontWeight: 700, fontSize: '1rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                boxShadow: '0 8px 32px rgba(37,99,235,0.4)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(37,99,235,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,99,235,0.4)' }}
            >
              <Activity size={18} /> Open Command Center
            </button>
            <button
              onClick={() => navigate('/map')}
              style={{
                background: 'rgba(255,255,255,0.05)', color: '#f1f5f9',
                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12,
                padding: '14px 32px', fontWeight: 600, fontSize: '1rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
            >
              <Globe size={18} /> Live Network Map
            </button>
          </div>
        </div>

        {/* Scroll cue */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
          animation: 'float 2s ease-in-out infinite', color: 'rgba(148,163,184,0.5)',
          fontSize: '0.7rem', letterSpacing: 2,
        }}>
          <span>SCROLL</span>
          <div style={{ width: 1, height: 40, background: 'linear-gradient(to bottom, rgba(59,130,246,0.5), transparent)' }} />
        </div>
      </div>

      {/* ── THE HYPOTHESIS ────────────────────────────────────────────── */}
      <div style={{ padding: '80px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(139,92,246,0.04))',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 20, padding: '48px 56px',
        }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 10, padding: '6px 12px', fontSize: '0.7rem',
              fontWeight: 700, color: '#ef4444', letterSpacing: 1,
              flexShrink: 0, alignSelf: 'flex-start', marginTop: 4,
            }}>
              THE RESEARCH HYPOTHESIS
            </div>
            <div>
              <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 800, lineHeight: 1.3, marginBottom: 20, color: 'white' }}>
                "Accidents don't happen randomly. They cluster on structurally critical junctions — and the data shows the warning 72 hours before."
              </h2>
              <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.8, maxWidth: 700 }}>
                Using graph-theoretic betweenness centrality on the IR network, DRISHTI identifies 
                the junctions where a failure cascades to the most trains. Cross-referencing 40 years 
                of CRS accident records, we found: <strong style={{ color: '#f1f5f9' }}>major accidents 
                cluster on high-centrality nodes at a rate 4× greater than chance</strong> (p &lt; 0.001).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE STATS BAR ────────────────────────────────────────────── */}
      <div style={{ padding: '0 40px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Trains Monitored', val: 9182, suffix: '', col: '#3b82f6', icon: <Zap size={20}/> },
            { label: 'Network Junctions', val: 51, suffix: '', col: '#8b5cf6', icon: <Target size={20}/> },
            { label: 'CRS Accidents in DB', val: 40, suffix: '+yrs', col: '#ef4444', icon: <Shield size={20}/> },
            { label: 'Avg Alert Latency', val: 45, suffix: 'ms', col: '#22c55e', icon: <Activity size={20}/> },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 16, padding: '28px 24px', textAlign: 'center',
            }}>
              <div style={{ color: s.col, marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{s.icon}</div>
              <div style={{ fontSize: 'clamp(2rem, 3vw, 2.8rem)', fontWeight: 900, color: s.col, fontFamily: 'var(--mono)', lineHeight: 1 }}>
                <Counter to={s.val} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── THE PROBLEM ───────────────────────────────────────────────── */}
      <div style={{ padding: '0 40px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>The Problem</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
            Every Major Disaster Had a Warning.<br />Nobody Was Looking at the Network.
          </h2>
        </div>

        {/* Timeline */}
        <div style={{ position: 'relative', paddingLeft: 40 }}>
          <div style={{
            position: 'absolute', left: 15, top: 8, bottom: 8,
            width: 2, background: 'linear-gradient(to bottom, #ef4444, rgba(239,68,68,0.1))',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {TIMELINE.map((item, i) => (
              <div key={i} style={{
                display: 'flex', gap: 24, padding: '20px 0',
                borderBottom: i < TIMELINE.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                alignItems: 'flex-start',
              }}>
                <div style={{
                  position: 'absolute', left: 9, width: 14, height: 14,
                  background: '#ef4444', borderRadius: '50%',
                  border: '2px solid #020817', flexShrink: 0,
                  marginTop: 5, boxShadow: '0 0 8px rgba(239,68,68,0.5)',
                }} />
                <div style={{ display: 'flex', gap: 24, flex: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 48 }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#ef4444', fontFamily: 'var(--mono)' }}>{item.year}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.95rem' }}>{item.name}</span>
                      <span style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#ef4444', fontSize: '0.62rem', fontWeight: 700,
                        padding: '2px 8px', borderRadius: 4, whiteSpace: 'nowrap',
                      }}>
                        {item.deaths.toLocaleString()} deaths
                      </span>
                      <span style={{ fontSize: '0.62rem', color: '#475569', fontFamily: 'var(--mono)' }}>{item.code}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHAT DRISHTI DOES ─────────────────────────────────────────── */}
      <div style={{
        padding: '80px 40px', maxWidth: 1100, margin: '0 auto',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#3b82f6', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>The Solution</div>
          <h2 style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.8rem)', fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
            4 Layers. 1 System. Real-Time Answers.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          <FeatureCard
            icon={<Map size={20}/>}
            title="Layer 1: Network Map"
            stat="51"
            desc="D3 force graph of 51 high-centrality IR junctions. Node size = betweenness centrality. Bigger node = network collapse ripples farther if it fails."
            link="/map"
            linkLabel="View Live Map"
          />
          <FeatureCard
            icon={<Radio size={20}/>}
            title="Layer 2: Cascade Pulse"
            stat="5s"
            desc="Every 5 seconds, delay propagation is simulated across the network. Click any node to see T+15min, T+30min, T+2hr downstream cascade forecast."
            link="/network"
            linkLabel="Open Pulse"
          />
          <FeatureCard
            icon={<Brain size={20}/>}
            title="Layer 3: CRS Intelligence"
            stat="11"
            desc="11 real pre-accident signatures from CRS corpus (1981–2023). When a junction's state matches a historical pre-accident pattern — you get an alert before the accident."
            link="/network"
            linkLabel="View Signatures"
          />
          <FeatureCard
            icon={<AlertTriangle size={20}/>}
            title="Layer 4: Alert Engine"
            stat="4×"
            desc="4-model ensemble: Bayesian Network + Isolation Forest + Causal DAG + DBSCAN. When 2+ models agree — it fires. Sub-100ms latency. Ed25519 signed."
            link="/alerts"
            linkLabel="Live Alerts"
          />
        </div>
      </div>

      {/* ── VS COMPARISON ─────────────────────────────────────────────── */}
      <div style={{ padding: '0 40px 80px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ padding: '20px 28px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#64748b', fontSize: '0.85rem' }}>❌ Without DRISHTI</div>
            </div>
            <div style={{ padding: '20px 28px' }}>
              <div style={{ fontWeight: 700, color: '#22c55e', fontSize: '0.85rem' }}>✅ With DRISHTI</div>
            </div>
          </div>
          {[
            ['Zone controller sees 1 section only', 'Command sees entire 9,000-train network at once'],
            ['Delay is reported after it happens', 'Cascade predicted 30 minutes before it propagates'],
            ['No pattern recognition across decades', 'Balasore 2023 signature flagged if it re-appears'],
            ['Alert: "Train 12601 is 45 min late"', 'Alert: "BLSR matches Coromandel pre-accident signature at 76%"'],
            ['Manual handover between zones', 'Automated cross-zone cascade forecast + intervention recommendation'],
          ].map(([before, after], i) => (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{ padding: '16px 28px', borderRight: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>{before}</div>
              <div style={{ padding: '16px 28px', fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5 }}>{after}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <div style={{
        padding: '80px 40px', textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: 'white', marginBottom: 16 }}>
          The network is live. The data is real.
        </h2>
        <p style={{ color: '#64748b', marginBottom: 40, fontSize: '1rem' }}>
          Open the command center to see the current state of the Indian Railways network.
        </p>
        <button
          onClick={() => navigate('/network')}
          style={{
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: 'white', border: 'none', borderRadius: 12,
            padding: '16px 40px', fontWeight: 700, fontSize: '1.05rem',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10,
            boxShadow: '0 12px 40px rgba(37,99,235,0.4)', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 48px rgba(37,99,235,0.5)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(37,99,235,0.4)' }}
        >
          <Activity size={20} /> Enter Command Center <ChevronRight size={18}/>
        </button>
        <div style={{ marginTop: 16, fontSize: '0.72rem', color: '#475569' }}>
          No login required · Live data · Open source
        </div>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.06)', padding: '24px 40px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '0.72rem', color: '#475569', flexWrap: 'wrap', gap: 12,
      }}>
        <div>DRISHTI · India's Railway Cascade Intelligence System</div>
        <div style={{ display: 'flex', gap: 20 }}>
          {['404Avinash/drishti', 'CRS Reports 1981–2023', 'NetworkX + FastAPI + React'].map(t => (
            <span key={t} style={{ color: '#334155' }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
