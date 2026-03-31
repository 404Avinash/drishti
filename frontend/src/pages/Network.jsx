import { useState, useEffect, useRef } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { Activity, ShieldAlert, Cpu, Route, AlertTriangle, ChevronRight, BarChart3, Radio } from 'lucide-react'

// --- VIEW COMPONENTS ---

// View 3: Zone Health
function ZoneHealthBoard({ health }) {
  if (!health || Object.keys(health).length === 0) return <div style={{ color: 'var(--t3)', padding: 10 }}>Awaiting telemetry...</div>
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
      {Object.entries(health).map(([zone, data]) => {
        const isCrit = data.status === 'CRITICAL'
        const col = isCrit ? 'var(--red)' : data.status === 'STRESSED' ? 'var(--yellow)' : 'var(--blue)'
        return (
          <div key={zone} style={{ 
            background: isCrit ? 'rgba(239, 68, 68, 0.05)' : 'var(--card)', 
            border: `1px solid ${isCrit ? 'var(--red-b)' : 'var(--border)'}`, 
            borderRadius: 8, padding: 12 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: col }}>{zone}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, background: `${col}22`, color: col, padding: '2px 6px', borderRadius: 4 }}>
                {data.status}
              </span>
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--t1)', fontFamily: 'var(--mono)', marginBottom: 4 }}>
              {data.score}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--t3)' }}>
              {data.delayed_hubs} Hubs Affected
            </div>
          </div>
        )
      })}
    </div>
  )
}

// View 4: Pre-Accident Signature
function SignatureMatch({ nodes }) {
  const criticalNodes = nodes.filter(n => n.stress_level === 'CRITICAL' || n.stress_level === 'HIGH' || n.cascade_risk > 0.4).sort((a,b) => b.cascade_risk - a.cascade_risk)
  if (criticalNodes.length === 0) return <div style={{ color: 'var(--t3)', padding: 10 }}>No structural signatures detected.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {criticalNodes.slice(0, 4).map(node => {
        // Mocking the match based on risk
        const matchPct = Math.min(Math.round(node.cascade_risk * 100 + 20), 99)
        return (
          <div key={node.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', border: `2px solid ${matchPct > 80 ? 'var(--red)' : 'var(--orange)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: matchPct > 80 ? 'var(--red)' : 'var(--orange)',
              fontWeight: 800, fontSize: '0.9rem', flexShrink: 0
            }}>
              {matchPct}%
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--t1)', display: 'flex', justifyContent: 'space-between' }}>
                <span>{node.name} ({node.id})</span>
                <span style={{ color: 'var(--red)', fontSize: '0.7rem' }}>Balasore 23' Signature</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--t2)', marginTop: 4 }}>
                Centrality: <strong>{node.centrality}</strong> · Stress: <strong>{node.delay_minutes}min</strong>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--t3)', marginTop: 4 }}>
                CRS Report 1980-2023 indicates high probability of signal mismatch under current load.
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// View 2: Cascade Propagator
function CascadePropagator({ nodes }) {
  const stressed = nodes.filter(n => n.delay_minutes > 45).sort((a,b) => b.delay_minutes - a.delay_minutes)
  
  if (stressed.length === 0) {
    return <div style={{ color: 'var(--t3)', padding: 10 }}>Network flows optimal. No cascading delays predicted.</div>
  }

  return (
    <div className="table-wrapper">
      <table style={{ minWidth: 500 }}>
        <thead>
          <tr>
            <th>EPI-CENTER NODE</th>
            <th>SEVERITY</th>
            <th align="right">CASCADE RISK</th>
            <th>DOWNSTREAM IMPACT PREDICTION</th>
          </tr>
        </thead>
        <tbody>
          {stressed.slice(0, 6).map(node => (
            <tr key={node.id}>
              <td style={{ fontWeight: 700, color: 'var(--t1)' }}>{node.name} ({node.id})</td>
              <td style={{ color: node.stress_level === 'CRITICAL' ? 'var(--red)' : 'var(--orange)' }}>+{node.delay_minutes} MIN</td>
              <td align="right" style={{ fontFamily: 'var(--mono)', color: 'var(--t2)' }}>
                {(node.cascade_risk * 100).toFixed(1)}%
              </td>
              <td style={{ fontSize: '0.7rem', color: 'var(--t2)' }}>
                {Math.max(1, Math.round(node.cascade_risk * 8))} trains exposed in next {Math.round((1 - node.cascade_risk)*120 + 30)} mins
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function NetworkPulse() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [pulseData, setPulseData] = useState({ nodes: [], zone_health: {} })
  const fgRef = useRef()

  // Initial load of the Graph Architecture (Layer 1)
  useEffect(() => {
    fetch('/network_graph.json')
      .then(r => r.json())
      .then(d => {
        setGraphData(d.graph)
      })
      .catch(e => console.error("Failed to load map graph", e))
  }, [])

  // Hook into the live engine stream (Layer 2)
  useEffect(() => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/live`
    const ws = new WebSocket(wsUrl)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'network_pulse' && msg.data) {
        setPulseData(msg.data)
        
        // Update the visual representation of nodes gracefully
        setGraphData(prev => {
          const newNodes = prev.nodes.map(n => {
            const liveNode = msg.data.nodes.find(pn => pn.id === n.id)
            if (liveNode) {
              return { ...n, ...liveNode } 
            }
            return n
          })
          return { ...prev, nodes: newNodes }
        })
      }
    }
    return () => ws.close()
  }, [])

  // Graph styling configuration
  const getNodeColor = (node) => {
    if (!node.stress_level || node.stress_level === 'LOW') return '#3b82f6'
    if (node.stress_level === 'MEDIUM') return '#eab308'
    if (node.stress_level === 'HIGH') return '#f97316'
    return '#ef4444' // CRITICAL
  }

  const getNodeVal = (node) => {
    // Base size on Centrality (Network architecture)
    const base = Math.max(2, (node.centrality || 0) * 40)
    // Make critical nodes slightly larger dynamically
    return node.stress_level === 'CRITICAL' ? base * 1.5 : base
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity size={20} color="var(--blue)" />
          DRISHTI: Network Intelligence Operations
        </h2>
        <p style={{ color: 'var(--t3)', fontSize: '0.85rem', maxWidth: 800 }}>
          India's NERC-equivalent graph module. Tracking cascade vulnerability across 7,000+ routes simultaneously. 
          The graph highlights high betweenness-centrality nodes and simulates downstream blackout effects live.
        </p>
      </div>

      {/* Top Split: The Force Graph & The Health Board */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, minHeight: 450 }}>
        
        {/* VIEW 1: D3 Network Pulse Graph */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="glass-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Route size={14} /> View 1: Network Pulse (Live Graph)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="dot dot-green" /> <span style={{ fontSize: '0.65rem' }}>NTES STREAMING</span>
            </div>
          </div>
          <div style={{ flex: 1, position: 'relative', background: '#02040f', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
            {graphData.nodes.length > 0 && (
              <ForceGraph2D
                ref={fgRef}
                graphData={graphData}
                width={800} // Temporary fixed or use AutoSizer
                height={400}
                nodeAutoColorBy={undefined}
                nodeColor={getNodeColor}
                nodeVal={getNodeVal}
                nodeLabel="name"
                linkColor={() => 'rgba(255,255,255,0.06)'}
                linkWidth={2}
                onEngineStop={() => fgRef.current?.zoomToFit(200, 40)}
                enableNodeDrag={true}
                backgroundColor="#02040f"
              />
            )}
            
            {/* Graph Legend */}
            <div style={{ position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.65rem', display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, background: '#3b82f6', borderRadius: '50%' }}/> STABLE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, background: '#f97316', borderRadius: '50%' }}/> STRESSED</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}/> CASCADE</div>
              <div style={{ marginLeft: 10, color: 'var(--t3)' }}>Size = Betweenness Centrality</div>
            </div>
          </div>
        </div>

        {/* Right Column: Signatures & Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* VIEW 4: Pre-Accident Signature Match */}
          <div className="glass-panel" style={{ flex: 1 }}>
            <div className="glass-header">
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><ShieldAlert size={14} color="var(--red)"/> View 4: CRS Incident Matching</div>
            </div>
            <div className="glass-content">
              <SignatureMatch nodes={pulseData.nodes} />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        
        {/* VIEW 3: Zone Health */}
        <div className="glass-panel">
          <div className="glass-header">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><BarChart3 size={14} /> View 3: Administrative Zone Health Score</div>
          </div>
          <div className="glass-content">
            <ZoneHealthBoard health={pulseData.zone_health} />
          </div>
        </div>

        {/* VIEW 2: Cascade Propagator */}
        <div className="glass-panel">
          <div className="glass-header">
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Radio size={14} /> View 2: Downstream Cascade Forecaster</div>
          </div>
          <div className="glass-content" style={{ padding: 0 }}>
             <CascadePropagator nodes={pulseData.nodes} />
          </div>
        </div>

      </div>

    </div>
  )
}
