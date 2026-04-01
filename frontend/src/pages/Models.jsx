import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, Cell
} from 'recharts'
import { Network, Database, AlertOctagon, Cpu, ChevronDown, ChevronUp, Info, RefreshCw, Zap, Brain, Activity } from 'lucide-react'

// ── Colour helpers ─────────────────────────────────────────────────────────────
const riskColor = r => ({ LOW: 'var(--green)', MEDIUM: 'var(--yellow)', HIGH: 'var(--orange)', CRITICAL: 'var(--red)' }[r] || 'var(--t3)')
const riskBg    = r => ({ LOW: 'rgba(34,197,94,0.08)', MEDIUM: 'rgba(234,179,8,0.08)', HIGH: 'rgba(249,115,22,0.08)', CRITICAL: 'rgba(239,68,68,0.10)' }[r] || 'var(--card)')
const riskBdr   = r => ({ LOW: 'rgba(34,197,94,0.3)', MEDIUM: 'rgba(234,179,8,0.3)', HIGH: 'rgba(249,115,22,0.3)', CRITICAL: 'rgba(239,68,68,0.4)' }[r] || 'var(--border)')

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border-b)', borderRadius: 8, padding: '8px 12px', fontSize: '0.75rem' }}>
      {payload.map((p, i) => <div key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</div>)}
    </div>
  )
}

function ExpandableCard({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="glass-panel">
      <button
        onClick={() => setOpen(o => !o)}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', width: '100%', borderBottom: open ? '1px solid var(--border)' : 'none' }}
      >
        <span style={{ color: 'var(--blue)' }}>{icon}</span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: '0.82rem' }}>{title}</span>
        {open ? <ChevronUp size={14} color="var(--t3)" /> : <ChevronDown size={14} color="var(--t3)" />}
      </button>
      {open && <div className="glass-content">{children}</div>}
    </div>
  )
}

// ── Bayesian Scenario Card ─────────────────────────────────────────────────────
function ScenarioCard({ scenario, index }) {
  if (!scenario) return null
  const pct = Math.round((scenario.p_accident || 0) * 100)
  const col = riskColor(scenario.risk_level)
  const bg  = riskBg(scenario.risk_level)
  const bdr = riskBdr(scenario.risk_level)

  const ICONS = ['🟢', '🟡', '🟠', '🔴']
  const SCENARIO_SUBTITLES = [
    'Baseline: all nominal',
    'Delays building, high-centrality node',
    'Night ops under load',
    'All Balasore pre-accident factors active',
  ]

  return (
    <div style={{
      background: bg, border: `1px solid ${bdr}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'all 0.3s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--t3)', marginBottom: 2 }}>
            {ICONS[index]} Scenario {index + 1}
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--t1)', marginBottom: 2 }}>
            {scenario.scenario}
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--t3)' }}>
            {SCENARIO_SUBTITLES[index]}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: '2rem', fontWeight: 900, color: col,
            fontFamily: 'JetBrains Mono, monospace', lineHeight: 1
          }}>
            {pct}%
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--t3)', marginTop: 2 }}>P(accident)</div>
        </div>
      </div>

      {/* Risk bar */}
      <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: col, borderRadius: 3,
          transition: 'width 1s ease',
          boxShadow: pct > 50 ? `0 0 8px ${col}` : 'none',
        }} />
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.65rem', background: `${col}22`, color: col, padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>
          {scenario.risk_level}
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--t3)' }}>
          Conf: {Math.round((scenario.confidence || 0) * 100)}%
        </span>
        <span style={{ fontSize: '0.65rem', color: 'var(--cyan)', fontFamily: 'var(--mono)' }}>
          <Zap size={9} style={{ marginRight: 2 }} />
          {scenario.latency_ms ?? '—'}ms
        </span>
        {scenario.time_to_accident_minutes > 0 && (
          <span style={{ fontSize: '0.65rem', color: scenario.risk_level === 'CRITICAL' ? 'var(--red)' : 'var(--yellow)' }}>
            T– {scenario.time_to_accident_minutes}min
          </span>
        )}
      </div>

      {/* Active + hidden factors */}
      {(scenario.active_factors?.length > 0 || scenario.inferred_hidden_dangers?.length > 0) && (
        <div style={{ fontSize: '0.65rem', color: 'var(--t3)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {scenario.active_factors?.length > 0 && (
            <div>
              <span style={{ color: 'var(--blue)', fontWeight: 700 }}>Observed: </span>
              {scenario.active_factors.join(' · ')}
            </div>
          )}
          {scenario.inferred_hidden_dangers?.length > 0 && (
            <div>
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>Inferred: </span>
              {scenario.inferred_hidden_dangers.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Models() {
  const [explainData, setExplainData] = useState(null)
  const [bayesianScenarios, setBayesianScenarios] = useState(null)
  const [scenariosLoading, setScenariosLoading] = useState(true)
  const [activeModel, setActiveModel] = useState('bayesian')

  // Fetch explainability data (static endpoint)
  useEffect(() => {
    fetch('/api/models/explainability')
      .then(r => r.json())
      .then(d => setExplainData(d))
      .catch(() => setExplainData(null))
  }, [])

  // Fetch live Bayesian scenarios from real pgmpy inference
  const fetchScenarios = useCallback(async () => {
    setScenariosLoading(true)
    try {
      const r = await fetch('/api/bayesian/scenarios')
      if (r.ok) {
        const d = await r.json()
        setBayesianScenarios(d)
      }
    } catch (e) {
      console.warn('Bayesian scenarios unavailable:', e)
    } finally {
      setScenariosLoading(false)
    }
  }, [])

  useEffect(() => { fetchScenarios() }, [fetchScenarios])

  const isoData = Array.from({ length: 24 }).map((_, i) => ({
    x: i * 4,
    normal: Math.exp(-Math.pow(i - 10, 2) / 12) * 100,
    anomaly: i > 17 ? Math.exp(-Math.pow(i - 20, 2) / 3) * 50 : 0
  }))

  const models = [
    { key: 'bayesian', icon: <Network size={16} />, label: 'Bayesian Network', desc: 'Exact probabilistic inference via Variable Elimination (pgmpy). Queries P(accident | observed state) over a 8-node causal DAG built from 40yr CRS accident records.', stats: [['Inference', 'Exact (VE)'], ['DAG Nodes', '8'], ['Root Causes', '3']], color: 'var(--blue)' },
    { key: 'isolation', icon: <Database size={16} />, label: 'Isolation Forest', desc: 'Unsupervised anomaly detection that isolates outlier train states using randomized decision trees. Trained on normal NTES delay patterns.', stats: [['Contamination', '5%'], ['Estimators', '200'], ['Threshold', '0.5']], color: 'var(--purple)' },
    { key: 'dbscan', icon: <Cpu size={16} />, label: 'DBSCAN Clustering', desc: 'Density-based spatial clustering to detect ghost trains, loop-line anomalies, and abnormal trajectory patterns in GPS space.', stats: [['Epsilon', '0.5'], ['Min Samples', '3'], ['Metric', 'Euclidean']], color: 'var(--cyan)' },
    { key: 'causal', icon: <AlertOctagon size={16} />, label: 'Causal DAG', desc: 'Directed acyclic graph that discovers causal intervention pathways: maintenance_skip → signal_failure → track_mismatch → accident chain.', stats: [['DAG Nodes', '8'], ['Edges', '10'], ['Root Node', 'maintenance_skip']], color: 'var(--orange)' },
  ]

  const baysScenes = bayesianScenarios?.scenarios || []
  const bayesOnline = bayesianScenarios?.bayesian_network_active ?? false

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={18} color="var(--blue)" />
            AI Ensemble Explainability
          </h2>
          <p style={{ color: 'var(--t3)', fontSize: '0.8rem' }}>
            Live pgmpy Bayesian inference + transparent ML ensemble breakdown. Every prediction, explainable.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            background: bayesOnline ? 'rgba(34,197,94,0.1)' : 'var(--card)',
            border: `1px solid ${bayesOnline ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
            borderRadius: 8, fontSize: '0.7rem',
            color: bayesOnline ? 'var(--green)' : 'var(--t3)',
          }}>
            <span className={bayesOnline ? 'dot dot-green' : 'dot dot-yellow'} />
            {bayesOnline ? 'pgmpy LIVE' : 'Inference Offline'}
          </div>
        </div>
      </div>

      {/* ── Section 1: Live Bayesian Scenarios ─────────────────────────────── */}
      <div className="glass-panel">
        <div className="glass-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Activity size={13} color="var(--blue)" />
            Live Bayesian Risk Scenarios — pgmpy Exact Inference (Variable Elimination)
          </div>
          <button
            onClick={fetchScenarios}
            disabled={scenariosLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--card)', border: '1px solid var(--border-b)',
              color: 'var(--t2)', borderRadius: 6, padding: '3px 10px',
              fontSize: '0.68rem', cursor: 'pointer',
              opacity: scenariosLoading ? 0.5 : 1,
            }}
          >
            <RefreshCw size={10} style={{ animation: scenariosLoading ? 'spin 1s linear infinite' : 'none' }} />
            {scenariosLoading ? 'Running inference…' : 'Re-run'}
          </button>
        </div>
        <div className="glass-content">
          {scenariosLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, height: 120, color: 'var(--t3)' }}>
              <div style={{ width: 22, height: 22, border: '2px solid var(--blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '0.8rem' }}>Running Variable Elimination inference across 4 canonical scenarios…</span>
            </div>
          ) : baysScenes.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '0.8rem', padding: 20 }}>
              pgmpy inference unavailable — ensure pgmpy is installed and CausalDAGBuilder loads correctly.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {baysScenes.slice(0, 4).map((s, i) => (
                <ScenarioCard key={i} scenario={s} index={i} />
              ))}
            </div>
          )}

          {/* DAG structure reminder */}
          <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, fontSize: '0.67rem', color: 'var(--t3)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: 'var(--blue)', fontWeight: 700 }}>Causal chain: </span>
            {['maintenance_skip', '→', 'signal_failure', '→', 'track_mismatch', '→', 'train_bunching', '→', 'accident'].map((n, i) => (
              <span key={i} style={{ color: n === '→' ? 'var(--t4)' : 'var(--t2)', fontFamily: n !== '→' ? 'var(--mono)' : undefined }}>{n}</span>
            ))}
            <span style={{ marginLeft: 'auto', color: 'var(--t4)' }}>
              8 nodes · 10 edges · cpd=TabularCPD
            </span>
          </div>
        </div>
      </div>

      {/* ── Section 2: Model Tabs ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {models.map(m => (
          <button key={m.key} onClick={() => setActiveModel(m.key)} style={{
            padding: '12px 14px', borderRadius: 10, textAlign: 'left',
            background: activeModel === m.key ? `${m.color}22` : 'var(--card)',
            border: `1px solid ${activeModel === m.key ? m.color + '55' : 'var(--border)'}`,
            cursor: 'pointer', transition: 'all 0.18s'
          }}>
            <div style={{ color: m.color, marginBottom: 6 }}>{m.icon}</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: activeModel === m.key ? 'var(--t1)' : 'var(--t2)', marginBottom: 2 }}>{m.label}</div>
            {m.stats.map(([k, v]) => (
              <div key={k} style={{ fontSize: '0.62rem', color: 'var(--t3)' }}>{k}: <span style={{ color: m.color }}>{v}</span></div>
            ))}
          </button>
        ))}
      </div>

      {/* ── Active Model Detail ─────────────────────────────────────────────── */}
      {(() => {
        const m = models.find(x => x.key === activeModel)
        return (
          <div className="glass-panel anim-fade" key={activeModel}>
            <div className="glass-header">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{m.icon} {m.label}</div>
              <span className="badge badge-blue">Active in Ensemble</span>
            </div>
            <div className="glass-content">
              <p style={{ color: 'var(--t2)', fontSize: '0.82rem', marginBottom: 12, lineHeight: 1.6 }}>{m.desc}</p>

              {activeModel === 'isolation' && (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={isoData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gNormal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gAnom" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="x" stroke="var(--border)" tick={{ fill: 'var(--t3)', fontSize: 9 }} />
                    <YAxis stroke="var(--border)" tick={{ fill: 'var(--t3)', fontSize: 9 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="normal" name="Normal" stroke="#3b82f6" fill="url(#gNormal)" strokeWidth={1.5} />
                    <Area type="monotone" dataKey="anomaly" name="Anomaly" stroke="#ef4444" fill="url(#gAnom)" strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}

              {activeModel === 'bayesian' && baysScenes.length > 0 && (
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {baysScenes.map((s, i) => (
                    <div key={i} style={{
                      flexShrink: 0, width: 140,
                      background: 'var(--bg3)', border: `1px solid ${riskBdr(s.risk_level)}`,
                      borderRadius: 8, padding: '10px 12px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.6rem', color: 'var(--t3)', marginBottom: 4 }}>{s.scenario?.split('·')[0]}</div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 900, color: riskColor(s.risk_level), fontFamily: 'var(--mono)' }}>
                        {Math.round((s.p_accident || 0) * 100)}%
                      </div>
                      <div style={{ fontSize: '0.6rem', color: riskColor(s.risk_level), marginTop: 2 }}>{s.risk_level}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeModel === 'causal' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, overflowX: 'auto', padding: '12px 0' }}>
                  {['maintenance_skip', 'signal_failure', 'track_mismatch', 'train_bunching', 'ACCIDENT'].map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                      {i > 0 && <div style={{ color: 'var(--orange)', fontSize: '1rem' }}>➔</div>}
                      <div style={{
                        background: i === 4 ? 'var(--red-g)' : 'var(--bg3)',
                        border: `1px solid ${i === 4 ? 'var(--red-b)' : 'var(--border)'}`,
                        padding: '10px 14px', borderRadius: 8, fontSize: '0.78rem',
                        whiteSpace: 'nowrap', fontFamily: 'var(--mono)',
                        color: i === 4 ? 'var(--red)' : 'var(--t2)', fontWeight: i === 4 ? 800 : 500,
                      }}>{step}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeModel === 'dbscan' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 8 }}>
                  {[['Cluster 1 (Normal)','9,044 trains','var(--green)'],['Cluster 2 (Edge)','108 trains','var(--yellow)'],['Cluster -1 (Outlier)','30 trains','var(--red)']].map(([k,v,c]) => (
                    <div key={k} style={{ background: 'var(--bg3)', border: `1px solid ${c}33`, borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--t3)', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontWeight: 800, color: c, fontSize: '1.1rem', fontFamily: 'JetBrains Mono, monospace' }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Section 3: Explainability static data ──────────────────────────── */}
      {explainData?.bayesian_network?.variables && (
        <ExpandableCard title="Bayesian Network — Variable List" icon={<Network size={15} />} defaultOpen={false}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {explainData.bayesian_network.variables.map(v => (
              <span key={v} style={{ fontSize: '0.72rem', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', padding: '3px 9px', borderRadius: 5, fontFamily: 'var(--mono)' }}>{v}</span>
            ))}
          </div>
        </ExpandableCard>
      )}

      {/* ── Ensemble voting guide ───────────────────────────────────────────── */}
      <ExpandableCard title="Ensemble Voting — How Alerts Are Fired" icon={<Info size={15} />} defaultOpen={false}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { votes: '0/4', label: 'No alert — network nominal', col: 'var(--green)' },
            { votes: '1/4', label: 'LOW signal — logged only', col: 'var(--cyan)' },
            { votes: '2/4', label: 'MEDIUM alert — notify stationmaster', col: 'var(--yellow)' },
            { votes: '3/4', label: 'HIGH alert — activate HUD, section controller', col: 'var(--orange)' },
            { votes: '4/4', label: 'CRITICAL — halt adjacent lines, immutable audit', col: 'var(--red)' },
          ].map(({ votes, label, col }) => (
            <div key={votes} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 52, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: '0.78rem', fontWeight: 800, color: col }}>{votes}</div>
              <div style={{ flex: 1, height: 24, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(parseInt(votes)) * 25}%`, height: '100%', background: col, transition: 'width 0.8s', display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                  {parseInt(votes) > 1 && <span style={{ fontSize: '0.64rem', color: 'white', fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>}
                </div>
              </div>
              {parseInt(votes) <= 1 && <span style={{ fontSize: '0.64rem', color: 'var(--t3)', minWidth: 200 }}>{label}</span>}
            </div>
          ))}
        </div>
      </ExpandableCard>

    </div>
  )
}
