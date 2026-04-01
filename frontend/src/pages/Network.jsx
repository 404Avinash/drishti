import { useState, useEffect, useRef, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import {
  Activity, ShieldAlert, Route, AlertTriangle, BarChart3,
  Radio, ChevronRight, TrendingUp, Zap, Clock, Target
} from 'lucide-react'

// ── Colour helpers ────────────────────────────────────────────────────────────
const stressColor = s => ({ LOW: '#3b82f6', MEDIUM: '#eab308', HIGH: '#f97316', CRITICAL: '#ef4444' }[s] || '#3b82f6')
const stressBg    = s => ({ LOW: 'rgba(59,130,246,0.08)', MEDIUM: 'rgba(234,179,8,0.08)', HIGH: 'rgba(249,115,22,0.08)', CRITICAL: 'rgba(239,68,68,0.08)' }[s] || '')
const stressBdr   = s => ({ LOW: 'rgba(59,130,246,0.3)',  MEDIUM: 'rgba(234,179,8,0.3)',  HIGH: 'rgba(249,115,22,0.3)',  CRITICAL: 'rgba(239,68,68,0.35)' }[s] || '')

// ── View 3: Zone Health Board ─────────────────────────────────────────────────
function ZoneHealthBoard({ health }) {
  if (!health || Object.keys(health).length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--t3)', gap: 8 }}>
        <Radio size={20} color="var(--t4)" />
        <span style={{ fontSize: '0.78rem' }}>Awaiting first telemetry cycle…</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 8 }}>
      {Object.entries(health).map(([zone, data]) => {
        const status = data.status || 'HEALTHY'
        const score  = data.score ?? 100
        const col    = status === 'CRITICAL' || status === 'EMERGENCY' ? 'var(--red)'
                     : status === 'STRESSED' ? 'var(--orange)'
                     : 'var(--green)'
        const bg     = status === 'CRITICAL' || status === 'EMERGENCY' ? 'rgba(239,68,68,0.06)'
                     : status === 'STRESSED' ? 'rgba(249,115,22,0.06)'
                     : 'rgba(34,197,94,0.04)'

        return (
          <div key={zone} style={{
            background: bg, border: `1px solid ${col}40`,
            borderRadius: 8, padding: '10px 12px',
            transition: 'border-color 0.3s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: '0.88rem', color: col }}>{zone}</span>
              <span style={{ fontSize: '0.58rem', fontWeight: 700, background: `${col}22`, color: col, padding: '2px 5px', borderRadius: 3 }}>
                {status}
              </span>
            </div>
            {/* Score bar */}
            <div style={{ background: 'var(--bg3)', borderRadius: 4, height: 4, marginBottom: 6, overflow: 'hidden' }}>
              <div style={{ width: `${score}%`, height: '100%', background: col, borderRadius: 4, transition: 'width 1s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--mono)' }}>{score}</span>
              <span style={{ fontSize: '0.6rem', color: 'var(--t3)', alignSelf: 'flex-end' }}>
                {data.delayed_hubs ?? 0} hubs affected
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── View 4: Pre-Accident Signature Match ─────────────────────────────────────
function SignatureMatch({ nodes, onSelectNode }) {
  const signatureNodes = nodes
    .filter(n => n.signature_accident_name && (n.stress_level === 'CRITICAL' || n.stress_level === 'HIGH' || n.signature_match_pct > 30))
    .sort((a, b) => b.signature_match_pct - a.signature_match_pct)
    .slice(0, 5)

  if (signatureNodes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 100, color: 'var(--t3)', gap: 8 }}>
        <ShieldAlert size={18} color="var(--t4)" />
        <span style={{ fontSize: '0.78rem' }}>No signature matches — network stable</span>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {signatureNodes.map(node => {
        const pct = node.signature_match_pct || 0
        const col = pct > 75 ? 'var(--red)' : pct > 50 ? 'var(--orange)' : 'var(--yellow)'
        return (
          <div
            key={node.id}
            onClick={() => onSelectNode(node)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', background: 'var(--bg2)',
              borderRadius: 8, border: `1px solid ${col}40`,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
          >
            {/* Match % ring */}
            <div style={{
              width: 42, height: 42, borderRadius: '50%',
              border: `2.5px solid ${col}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: col, fontWeight: 800, fontSize: '0.78rem', flexShrink: 0,
              boxShadow: pct > 75 ? `0 0 10px ${col}40` : 'none',
            }}>
              {pct}%
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: '0.79rem', color: 'var(--t1)' }}>
                  {node.name} ({node.id})
                </span>
                <span style={{ fontSize: '0.62rem', color: col, fontWeight: 700 }}>
                  {node.stress_level}
                </span>
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--red)', fontWeight: 600, marginBottom: 2 }}>
                ⚠ Matches: {node.signature_accident_name} · {node.signature_date}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--t3)' }}>
                {node.signature_deaths ? `${node.signature_deaths} deaths on record` : ''} · Delay: {node.delay_minutes}min · Centrality: {(node.centrality * 100).toFixed(0)}
              </div>
            </div>
            <ChevronRight size={12} color="var(--t4)" />
          </div>
        )
      })}
    </div>
  )
}

// ── View 2: Cascade Propagator ────────────────────────────────────────────────
function CascadePropagator({ nodes, selectedNode, onSelectNode }) {
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchForecast = useCallback(async (nodeId) => {
    if (!nodeId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/network/cascade/${nodeId}`)
      if (res.ok) {
        const data = await res.json()
        setForecast(data)
      }
    } catch (e) {
      console.warn('Cascade forecast unavailable:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedNode) fetchForecast(selectedNode.id)
  }, [selectedNode, fetchForecast])

  const stressed = nodes.filter(n => n.delay_minutes > 30).sort((a, b) => b.delay_minutes - a.delay_minutes)

  if (!selectedNode) {
    return (
      <div>
        <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: 10 }}>
          Click a node on the graph or select from delayed junctions below:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {stressed.length === 0
            ? <div style={{ color: 'var(--green)', fontSize: '0.78rem', padding: 8 }}>✓ Network flows optimal. No delays &gt;30min.</div>
            : stressed.slice(0, 6).map(n => (
              <div
                key={n.id}
                onClick={() => onSelectNode(n)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'var(--bg2)', borderRadius: 6,
                  border: `1px solid ${stressBdr(n.stress_level)}`,
                  cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--card)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: stressColor(n.stress_level) }}>
                    {n.name}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--t3)', marginLeft: 8 }}>{n.zone}</span>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '0.78rem', color: stressColor(n.stress_level) }}>
                    +{n.delay_minutes}min
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--t3)' }}>
                    {(n.cascade_risk * 100).toFixed(0)}% cascade
                  </span>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => { setForecast(null); onSelectNode(null) }}
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--t3)', borderRadius: 5, padding: '3px 10px', fontSize: '0.7rem', cursor: 'pointer' }}
        >
          ← Back
        </button>
        <span style={{ fontWeight: 700, color: 'var(--t1)', fontSize: '0.85rem' }}>
          {selectedNode.name} ({selectedNode.id})
        </span>
        <span className={`badge badge-${selectedNode.stress_level === 'CRITICAL' ? 'red' : selectedNode.stress_level === 'HIGH' ? 'orange' : 'yellow'}`}>
          {selectedNode.stress_level}
        </span>
      </div>

      {loading && <div style={{ color: 'var(--t3)', fontSize: '0.78rem', padding: 10 }}>Computing cascade forecast…</div>}

      {forecast && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Current Delay', val: `+${forecast.current_delay}min`, col: stressColor(selectedNode.stress_level) },
              { label: 'Cascade Risk',  val: `${(forecast.cascade_risk * 100).toFixed(0)}%`, col: 'var(--orange)' },
              { label: 'Trains Exposed', val: forecast.trains_exposed || '—', col: 'var(--blue)' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg2)', borderRadius: 6, padding: '8px 10px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.58rem', color: 'var(--t3)', marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: m.col, fontFamily: 'var(--mono)' }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* Intervention */}
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 6, padding: '8px 12px', fontSize: '0.72rem', color: 'var(--t2)' }}>
            <strong style={{ color: 'var(--blue)' }}>🔧 Recommended:</strong> {forecast.intervention}
          </div>

          {/* Timeline table */}
          {forecast.t15min?.length > 0 && (
            <div className="table-wrapper" style={{ maxHeight: 200, overflowY: 'auto' }}>
              <table style={{ minWidth: 380 }}>
                <thead>
                  <tr>
                    <th>Downstream Junction</th>
                    <th align="right">T+15min</th>
                    <th align="right">T+30min</th>
                    <th align="right">T+2hr</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.t15min.slice(0, 6).map(n => (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 600, color: 'var(--t1)' }}>{n.name} <span style={{ color: 'var(--t4)', fontSize: '0.65rem' }}>({n.id})</span></td>
                      <td align="right" style={{ color: n.t15 > 30 ? 'var(--orange)' : 'var(--t2)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>+{n.t15}min</td>
                      <td align="right" style={{ color: n.t30 > 45 ? 'var(--red)' : 'var(--t2)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>+{n.t30}min</td>
                      <td align="right" style={{ color: n.t2hr > 60 ? 'var(--red)' : 'var(--t2)', fontFamily: 'var(--mono)', fontSize: '0.75rem' }}>+{n.t2hr}min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!forecast && !loading && (
        <div style={{ color: 'var(--t3)', fontSize: '0.78rem', padding: 10 }}>
          Cascade forecast unavailable for this node.
        </div>
      )}
    </div>
  )
}

// ── Main: Network Pulse Page ──────────────────────────────────────────────────
export default function NetworkPulse() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [pulseData, setPulseData] = useState({ nodes: [], zone_health: {} })
  const [selectedNode, setSelectedNode] = useState(null)
  const [graphLoaded, setGraphLoaded] = useState(false)
  const fgRef = useRef()

  // Load static Layer 1 graph (topology)
  useEffect(() => {
    fetch('/network_graph.json')
      .then(r => r.json())
      .then(d => {
        setGraphData(d.graph)
        setGraphLoaded(true)
      })
      .catch(e => {
        console.warn('network_graph.json missing — run: python scripts/generate_graph.py', e)
        setGraphLoaded(false)
      })
  }, [])

  // Subscribe to live pulse (Layer 2 + 3 intelligence overlay)
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${proto}//${window.location.host}/ws/live`
    const ws = new WebSocket(wsUrl)

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)

      if (msg.type === 'network_pulse' && msg.data) {
        setPulseData(msg.data)
        // Merge live stress → graph nodes
        setGraphData(prev => ({
          ...prev,
          nodes: prev.nodes.map(n => {
            const live = msg.data.nodes.find(pn => pn.id === n.id)
            return live ? { ...n, ...live } : n
          }),
        }))
      }

      if (msg.type === 'init' && msg.network_pulse) {
        setPulseData(msg.network_pulse)
      }
    }

    return () => ws.close()
  }, [])

  const getNodeColor = node => {
    if (node.stress_level === 'CRITICAL') return '#ef4444'
    if (node.stress_level === 'HIGH')     return '#f97316'
    if (node.stress_level === 'MEDIUM')   return '#eab308'
    return '#3b82f6'
  }

  const getNodeVal = node => {
    const base = Math.max(1.5, (node.centrality || 0) * 50)
    return node.stress_level === 'CRITICAL' ? base * 1.6 : base
  }

  const handleNodeClick = useCallback(node => {
    setSelectedNode(node)
  }, [])

  // Stats summary
  const critCount  = pulseData.nodes.filter(n => n.stress_level === 'CRITICAL').length
  const highCount  = pulseData.nodes.filter(n => n.stress_level === 'HIGH').length
  const sigMatches = pulseData.nodes.filter(n => n.signature_match_pct > 50).length

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={20} color="var(--blue)" />
          DRISHTI: Network Intelligence Operations
        </h2>
        <p style={{ color: 'var(--t3)', fontSize: '0.82rem', maxWidth: 820 }}>
          India's NERC-equivalent cascade intelligence. Watching {pulseData.nodes.length || 51} high-centrality junctions 
          so zone controllers don't have to watch 9,000 trains.
        </p>
      </div>

      {/* ── Quick stat strip ────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Nodes Monitored', val: pulseData.nodes.length || 51, col: 'var(--blue)', icon: <Target size={14}/> },
          { label: 'Critical Junctions', val: critCount, col: 'var(--red)', icon: <AlertTriangle size={14}/> },
          { label: 'High Stress', val: highCount, col: 'var(--orange)', icon: <TrendingUp size={14}/> },
          { label: 'CRS Matches', val: sigMatches, col: 'var(--purple)', icon: <Zap size={14}/> },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: s.col, fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
              {s.icon} {s.label}
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: s.col, fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* ── Main split: Force Graph + CRS Signatures ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, minHeight: 440 }}>

        {/* VIEW 1: D3 Force Graph */}
        <div className="glass-panel">
          <div className="glass-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Route size={13}/> View 1: Live Network Pulse Graph
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.62rem', color: 'var(--t3)' }}>
              <span>Node size = Betweenness Centrality</span>
              <span className="dot dot-green" />
              <span>NTES STREAMING</span>
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', background: '#02040f', overflow: 'hidden', borderRadius: '0 0 8px 8px' }}>
            {!graphLoaded && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--t3)' }}>
                <div style={{ width: 28, height: 28, border: '2px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: '0.75rem' }}>Loading network topology…</span>
              </div>
            )}
            {graphLoaded && graphData.nodes.length > 0 && (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                width={undefined}
                height={undefined}
                nodeAutoColorBy={undefined}
                nodeColor={getNodeColor}
                nodeVal={getNodeVal}
                nodeLabel={n => `${n.name} (${n.id})\nZone: ${n.zone}\nStress: ${n.stress_level || 'LOW'}\nDelay: ${n.delay_minutes || 0}min\nCentrality: ${((n.centrality || 0) * 100).toFixed(0)}\nCRS Match: ${n.signature_match_pct || 0}%`}
                linkColor={l => `rgba(255,255,255,${0.03 + (l.weight || 0.3) * 0.06})`}
                linkWidth={l => 1 + (l.weight || 0.3) * 1.5}
                onEngineStop={() => fgRef.current?.zoomToFit(300, 50)}
                onNodeClick={handleNodeClick}
                enableNodeDrag={true}
                backgroundColor="#02040f"
                nodeCanvasObjectMode={() => 'after'}
                nodeCanvasObject={(node, ctx, scale) => {
                  if (node.stress_level === 'CRITICAL' && scale > 1.5) {
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, 8 / scale, 0, 2 * Math.PI)
                    ctx.strokeStyle = 'rgba(239,68,68,0.5)'
                    ctx.lineWidth = 2 / scale
                    ctx.stroke()
                  }
                }}
              />
            )}

            {/* Legend */}
            <div style={{
              position: 'absolute', bottom: 10, left: 10,
              background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
              padding: '6px 12px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.62rem', display: 'flex', gap: 14,
            }}>
              {[['#3b82f6','STABLE'],['#eab308','MEDIUM'],['#f97316','HIGH'],['#ef4444','CRITICAL']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, background: c, borderRadius: '50%' }}/>
                  <span style={{ color: 'var(--t3)' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* VIEW 4: CRS Signature Match */}
        <div className="glass-panel">
          <div className="glass-header">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <ShieldAlert size={13} color="var(--red)"/> View 4: CRS Historical Signature Match
            </div>
          </div>
          <div className="glass-content">
            <SignatureMatch nodes={pulseData.nodes} onSelectNode={setSelectedNode} />
          </div>
        </div>
      </div>

      {/* ── Bottom row: Zone Health + Cascade Propagator ────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, minHeight: 260 }}>

        {/* VIEW 3: Zone Health */}
        <div className="glass-panel">
          <div className="glass-header">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <BarChart3 size={13}/> View 3: Zone Health Score (All 12 IR Zones)
            </div>
          </div>
          <div className="glass-content">
            <ZoneHealthBoard health={pulseData.zone_health} />
          </div>
        </div>

        {/* VIEW 2: Cascade Propagator */}
        <div className="glass-panel">
          <div className="glass-header">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Radio size={13}/> View 2: Cascade Propagator
            </div>
            {selectedNode && (
              <span style={{ fontSize: '0.6rem', color: 'var(--blue)' }}>
                <Clock size={10}/> Forecasting from {selectedNode.id}
              </span>
            )}
          </div>
          <div className="glass-content">
            <CascadePropagator
              nodes={pulseData.nodes}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
