import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D from 'react-force-graph-2d'
import AlertBadge from '../components/AlertBadge'
import LiveIndicator from '../components/LiveIndicator'

const STRESS_COLORS = {
  CRITICAL: '#ff4d6d',
  HIGH:     '#ff6b35',
  MEDIUM:   '#ffd60a',
  LOW:      '#00e676',
  STABLE:   '#00d4ff',
}

export default function Network() {
  const navigate = useNavigate()
  const fgRef    = useRef()
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [selected,  setSelected]  = useState(null)
  const [trains,    setTrains]    = useState([])
  const [live,      setLive]      = useState(false)
  const [viewMode,  setViewMode]  = useState('DARK')
  const [loading,   setLoading]   = useState(true)

  const load = async () => {
    try {
      // Try to load graph JSON
      const [netRes, trainRes] = await Promise.allSettled([
        fetch('/network_graph.json'),
        fetch('/api/trains/current'),
      ])

      let nodes = [], links = []
      if (netRes.status === 'fulfilled' && netRes.value.ok) {
        const raw = await netRes.value.json()
        nodes = (raw.nodes || []).map(n => ({
          ...n,
          id:         n.id || n.node_id,
          color:      STRESS_COLORS[n.stress_level] || STRESS_COLORS.STABLE,
          val:        (n.betweenness_centrality || 0.1) * 20 + 2,
        }))
        links = (raw.links || raw.edges || []).map(l => ({ ...l, color: 'rgba(0,212,255,.15)' }))
      }

      if (trainRes.status === 'fulfilled' && trainRes.value.ok) {
        const tData = await trainRes.value.json()
        setTrains(Array.isArray(tData) ? tData : [])
        setLive(true)

        // Update node colors from live train data
        const stressMap = {}
        if (Array.isArray(tData)) {
          tData.forEach(t => { if (t.current_station) stressMap[t.current_station] = t.stress_level })
        }
        nodes = nodes.map(n => ({
          ...n,
          stress_level: stressMap[n.id] || n.stress_level || 'STABLE',
          color: STRESS_COLORS[stressMap[n.id] || n.stress_level] || STRESS_COLORS.STABLE,
        }))
      }

      if (nodes.length > 0) setGraphData({ nodes, links })
    } catch { setLive(false) }
    setLoading(false)
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 15000)
    return () => clearInterval(iv)
  }, [])

  const handleNodeClick = useCallback(node => {
    setSelected(node)
    if (fgRef.current) fgRef.current.centerAt(node.x, node.y, 600)
  }, [])

  const critCount   = graphData.nodes.filter(n => n.stress_level === 'CRITICAL').length
  const highCount   = graphData.nodes.filter(n => n.stress_level === 'HIGH').length
  const stableCount = graphData.nodes.filter(n => n.stress_level === 'STABLE').length

  return (
    <div style={{ position: 'relative', height: 'calc(100vh - var(--nav-h))', background: 'var(--void)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, display: 'flex', alignItems: 'flex-start', gap: 12, pointerEvents: 'none' }}>
        {/* Title card */}
        <div style={{ ...GLASS_CARD, pointerEvents: 'auto', maxWidth: 380 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <h1 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.04em' }}>
              Network Intelligence Map
            </h1>
            <LiveIndicator label={live ? 'LIVE' : 'STATIC'} offline={!live} />
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.6 }}>
            {graphData.nodes.length} junction nodes · Node size = betweenness centrality · Color = live stress
          </p>
          {/* Counts */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
            {[
              { label: 'CRITICAL', count: critCount,   color: STRESS_COLORS.CRITICAL },
              { label: 'HIGH',     count: highCount,   color: STRESS_COLORS.HIGH },
              { label: 'STABLE',   count: stableCount, color: STRESS_COLORS.STABLE },
              { label: 'TOTAL',    count: graphData.nodes.length, color: 'var(--t2)' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                <span className="mono" style={{ color, fontWeight: 700 }}>{count}</span>
                <span style={{ color: 'var(--t3)', fontSize: 9.5, letterSpacing: '0.08em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* View mode toggle */}
        <div style={{ ...GLASS_CARD, pointerEvents: 'auto', display: 'flex', gap: 6, padding: '8px 10px' }}>
          {['DARK', 'TERRAIN', 'NODE'].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
              background: viewMode === m ? 'var(--cyan-10)' : 'transparent',
              border: `1px solid ${viewMode === m ? 'var(--cyan-30)' : 'transparent'}`,
              color: viewMode === m ? 'var(--cyan)' : 'var(--t3)',
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              fontFamily: 'JetBrains Mono, monospace',
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 10, ...GLASS_CARD }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--t3)', marginBottom: 10, textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
          Stress Legend
        </div>
        {Object.entries(STRESS_COLORS).map(([level, color]) => (
          <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}`, flexShrink: 0 }} />
            <span style={{ color: 'var(--t2)', fontWeight: 600 }}>{level.charAt(0) + level.slice(1).toLowerCase()}</span>
          </div>
        ))}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--b1)', fontSize: 10, color: 'var(--t3)', lineHeight: 1.5 }}>
          Node size = centrality<br />
          Glow ring = cascade risk
        </div>
      </div>

      {/* Selected node panel */}
      {selected && (
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, ...GLASS_CARD, width: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{selected.id || selected.label}</span>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          <AlertBadge severity={selected.stress_level || 'STABLE'} size="lg" />
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selected.zone && (
              <div style={ROW}>
                <span style={ROW_LABEL}>Zone</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--t1)' }}>{selected.zone}</span>
              </div>
            )}
            {selected.betweenness_centrality != null && (
              <div style={ROW}>
                <span style={ROW_LABEL}>Centrality</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--cyan)' }}>{selected.betweenness_centrality.toFixed(4)}</span>
              </div>
            )}
            {selected.degree != null && (
              <div style={ROW}>
                <span style={ROW_LABEL}>Degree</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--purple)' }}>{selected.degree}</span>
              </div>
            )}
            {selected.risk_score != null && (
              <div style={ROW}>
                <span style={ROW_LABEL}>Risk Score</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--orange)' }}>{(selected.risk_score * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
          {trains.filter(t => t.current_station === (selected.id || selected.label)).length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--b1)' }}>
              <div style={{ fontSize: 9.5, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Trains at Station</div>
              {trains.filter(t => t.current_station === (selected.id || selected.label)).slice(0, 4).map((t, i) => (
                <div key={i} onClick={() => navigate(`/train/${t.train_id}`)} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', cursor: 'pointer', borderBottom: '1px solid var(--b1)' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--cyan)' }}>{t.train_id}</span>
                  <AlertBadge severity={t.stress_level} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Graph */}
      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40, animation: 'spin-slow 3s linear infinite' }}>◎</div>
          <div style={{ color: 'var(--t2)', fontSize: 14 }}>Loading network graph...</div>
        </div>
      ) : graphData.nodes.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 40, color: 'var(--t3)' }}>◎</div>
          <div style={{ color: 'var(--t2)', fontSize: 14, fontWeight: 600 }}>Network graph not available</div>
          <div style={{ color: 'var(--t3)', fontSize: 12, textAlign: 'center', maxWidth: 300 }}>
            network_graph.json may not be deployed. Check backend or commit the file.
          </div>
        </div>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="#010409"
          nodeColor={n => n.color || STRESS_COLORS.STABLE}
          nodeVal={n => n.val || 3}
          nodeLabel={n => `${n.id} · ${n.stress_level || 'STABLE'}`}
          linkColor={l => l.color || 'rgba(0,212,255,.12)'}
          linkWidth={0.8}
          onNodeClick={handleNodeClick}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const r   = Math.sqrt(node.val) * 2.5
            const col = node.color || STRESS_COLORS.STABLE

            // Glow
            const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.5)
            gradient.addColorStop(0, col + '60')
            gradient.addColorStop(1, 'transparent')
            ctx.beginPath()
            ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2)
            ctx.fillStyle = gradient
            ctx.fill()

            // Node circle
            ctx.beginPath()
            ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
            ctx.fillStyle = col
            ctx.shadowColor = col
            ctx.shadowBlur  = (node.stress_level === 'CRITICAL' || node.stress_level === 'HIGH') ? 15 : 6
            ctx.fill()
            ctx.shadowBlur = 0

            // Critical ring
            if (node.stress_level === 'CRITICAL') {
              ctx.beginPath()
              ctx.arc(node.x, node.y, r + 3, 0, Math.PI * 2)
              ctx.strokeStyle = col + '88'
              ctx.lineWidth   = 1.5
              ctx.stroke()
            }

            // Label at zoom > 1.5
            if (globalScale > 1.5) {
              const label = node.id || node.label || '?'
              ctx.font = `${Math.min(12, 5 / globalScale * 8)}px Inter, sans-serif`
              ctx.fillStyle   = '#e2eaf2'
              ctx.textAlign   = 'center'
              ctx.textBaseline = 'middle'
              ctx.fillText(label, node.x, node.y + r + 7)
            }
          }}
          nodeCanvasObjectMode={() => 'replace'}
          cooldownTicks={120}
          onEngineStop={() => fgRef.current?.zoomToFit(800, 60)}
        />
      )}
    </div>
  )
}

const GLASS_CARD = {
  background: 'rgba(7,13,26,.85)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(0,212,255,.14)',
  borderRadius: 14,
  padding: '16px 18px',
}

const ROW = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }
const ROW_LABEL = { color: 'var(--t3)', fontSize: 10.5, letterSpacing: '0.06em' }
