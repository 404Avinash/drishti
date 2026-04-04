import { useState, useEffect, useCallback } from 'react'
import LiveIndicator from '../components/LiveIndicator'

// ── Palette ──────────────────────────────────────────────────────────────────
const SEVERITY_COLOR = {
  CRITICAL: 'var(--red)',
  HIGH: 'var(--orange)',
  MEDIUM: 'var(--yellow)',
  LOW: 'var(--green)',
}

const MODEL_ICONS = {
  'Bayesian Network (pgmpy)':     '🧠',
  'Isolation Forest (sklearn)':   '🌲',
  'Causal DAG (doWhy/networkx)':  '🔗',
  'DBSCAN Trajectory Clustering': '🛰️',
}

// ── Sub‑components ────────────────────────────────────────────────────────────

function ModelChip({ model, triggered, score, threshold }) {
  const active = triggered
  const color = active ? 'var(--green)' : 'var(--t3)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 20,
      background: active ? 'rgba(34,197,94,0.12)' : 'var(--raised)',
      border: `1px solid ${active ? 'rgba(34,197,94,0.35)' : 'var(--b1)'}`,
      fontSize: 10, fontWeight: 700, color,
      fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '0.05em',
    }}>
      {active ? '✓' : '✗'} {model.split(' ')[0]}
    </span>
  )
}

function ScoreBar({ score, threshold, color }) {
  const pct = Math.min(score * 100, 100)
  const thPct = Math.min(threshold * 100, 100)
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--raised)', borderRadius: 6, overflow: 'visible' }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 6, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: score >= threshold
            ? `linear-gradient(90deg, ${color}, ${color}cc)`
            : `linear-gradient(90deg, var(--t3), var(--t3)88)`,
          transition: 'width 600ms ease',
          boxShadow: score >= threshold ? `0 0 10px ${color}66` : 'none',
        }} />
      </div>
      {/* threshold tick */}
      <div style={{
        position: 'absolute', top: -4, left: `${thPct}%`,
        width: 2, height: 16, background: 'var(--yellow)', borderRadius: 1,
        transform: 'translateX(-50%)',
      }} title={`Threshold: ${threshold}`} />
    </div>
  )
}

function ModelContrib({ contrib }) {
  const triggered = contrib.triggered
  const color = triggered ? 'var(--green)' : 'var(--t3)'
  const icon = MODEL_ICONS[contrib.model] ?? '⚙️'

  return (
    <div style={{
      padding: '14px 16px',
      background: triggered ? 'rgba(34,197,94,0.04)' : 'var(--raised)',
      border: `1px solid ${triggered ? 'rgba(34,197,94,0.2)' : 'var(--b1)'}`,
      borderRadius: 'var(--r-sm)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{contrib.model}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 1 }}>
              Weight: {contrib.weight} · Threshold: {(contrib.threshold * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <div style={{
          padding: '3px 10px', borderRadius: 20,
          background: triggered ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.12)',
          color, fontSize: 10, fontWeight: 800,
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
        }}>
          {triggered ? '● TRIGGERED' : '○ PASS'}
        </div>
      </div>

      <ScoreBar score={contrib.score} threshold={contrib.threshold} color="var(--cyan)" />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--t3)', marginTop: 4, marginBottom: 10, fontFamily: 'JetBrains Mono, monospace' }}>
        <span>Score: {(contrib.score * 100).toFixed(1)}%</span>
        <span>Threshold: {(contrib.threshold * 100).toFixed(0)}%</span>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.65, marginBottom: 8 }}>
        {contrib.description}
      </p>

      {contrib.factors.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {contrib.factors.map((f, i) => (
            <span key={i} style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 10,
              background: 'var(--glass)', border: '1px solid var(--b1)',
              color: 'var(--t2)', fontFamily: 'JetBrains Mono, monospace',
            }}>{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function DecisionCard({ decision, expanded, onToggle }) {
  const sev = decision.severity
  const sevColor = SEVERITY_COLOR[sev] || 'var(--t3)'
  const ts = decision.timestamp ? new Date(decision.timestamp) : null
  const timeStr = ts ? ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
  const dateStr = ts ? ts.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''

  return (
    <div style={{
      border: `1px solid ${expanded ? sevColor + '50' : 'var(--b1)'}`,
      borderLeft: `3px solid ${sevColor}`,
      borderRadius: 'var(--r-md)',
      background: 'var(--glass)',
      backdropFilter: 'var(--blur)',
      WebkitBackdropFilter: 'var(--blur)',
      marginBottom: 12,
      overflow: 'hidden',
      transition: 'border-color 200ms ease',
    }}>
      {/* Header row */}
      <div
        onClick={onToggle}
        style={{
          padding: '14px 20px', display: 'flex', alignItems: 'center',
          gap: 14, cursor: 'pointer',
        }}
      >
        {/* Severity badge */}
        <div style={{
          width: 70, flexShrink: 0, padding: '4px 8px', borderRadius: 8,
          background: `${sevColor}15`, border: `1px solid ${sevColor}40`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: sevColor, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>{sev}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: sevColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {(decision.final_risk_score * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)' }}>risk</div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>
            {decision.train_name} · {decision.station_name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>🚂 {decision.train_id}</span>
            <span>📍 {decision.zone}</span>
            <span>⚖️ {decision.verdict}</span>
          </div>
        </div>

        {/* ML chips row */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
          {decision.model_contributions?.map((m, i) => (
            <ModelChip key={i} model={m.model} triggered={m.triggered} score={m.score} threshold={m.threshold} />
          ))}
        </div>

        {/* Time */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>{timeStr}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>{dateStr}</div>
        </div>

        {/* Expand caret */}
        <div style={{ color: 'var(--t3)', fontSize: 14, transition: 'transform 200ms', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--b1)' }}>
          {/* Explanation */}
          <p style={{ fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.7, margin: '14px 0' }}>
            {decision.explanation}
          </p>

          {/* Risk formula bar */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--raised)', borderRadius: 'var(--r-sm)', border: '1px solid var(--b1)' }}>
            <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>Risk Score Formula</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--t1)' }}>
              <span style={{ color: 'var(--purple)' }}>0.40</span>×Bayesian
              {' + '}
              <span style={{ color: 'var(--orange)' }}>0.35</span>×IsoForest
              {' + '}
              <span style={{ color: 'var(--cyan)' }}>0.25</span>×CausalDAG
              {' = '}
              <span style={{ color: sevColor, fontWeight: 800 }}>{(decision.final_risk_score * 100).toFixed(1)}%</span>
            </div>
            <div style={{ marginTop: 8 }}>
              <ScoreBar score={decision.final_risk_score} threshold={0.5} color={sevColor} />
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
              {decision.model_contributions?.slice(0, 3).map((m, i) => (
                <div key={i} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--t3)' }}>
                  {['B', 'I', 'C'][i]}: {(m.score * 100).toFixed(1)}%
                </div>
              ))}
            </div>
          </div>

          {/* Model contributions */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Model Contributions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            {decision.model_contributions?.map((m, i) => (
              <ModelContrib key={i} contrib={m} />
            ))}
          </div>

          {/* Actions */}
          {decision.actions?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Automated Actions</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {decision.actions.map((a, i) => (
                  <span key={i} style={{
                    padding: '4px 12px', borderRadius: 20,
                    background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
                    color: 'var(--yellow)', fontSize: 11, fontWeight: 700,
                    fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.05em',
                  }}>{a.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          )}

          {/* CRS Signature */}
          {decision.crs_signature && (
            <div style={{
              padding: '12px 14px', borderRadius: 'var(--r-sm)',
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                ⚠️ CRS Historical Signature Match
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Accident</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{decision.crs_signature.name}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</div>
                  <div style={{ fontSize: 13, fontFamily: 'JetBrains Mono, monospace', color: 'var(--t1)' }}>{decision.crs_signature.date}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Deaths</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace' }}>{decision.crs_signature.deaths}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pattern Match</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {decision.crs_signature.match_pct}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Methodology panel ─────────────────────────────────────────────────────────

function MethodologyPanel({ methodology }) {
  if (!methodology) return null
  return (
    <div style={{
      padding: '20px 22px',
      background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)',
      border: '1px solid var(--b1)', borderRadius: 'var(--r-md)',
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--t1)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
        🔬 How DRISHTI Makes Decisions
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {[
          { label: 'Ensemble Voting', value: methodology.voting, icon: '🗳️', color: 'var(--purple)' },
          { label: 'Severity Rule',   value: methodology.severity_rule, icon: '⚠️', color: 'var(--orange)' },
          { label: 'Risk Formula',    value: methodology.risk_formula, icon: '∑', color: 'var(--cyan)' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: `${color}06`, border: `1px solid ${color}20` }}>
            <div style={{ fontSize: 10, color, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              {icon} {label}
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, fontFamily: 'JetBrains Mono, monospace' }}>
              {value}
            </div>
          </div>
        ))}

        <div style={{ padding: '12px 14px', borderRadius: 'var(--r-sm)', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)' }}>
          <div style={{ fontSize: 10, color: 'var(--cyan)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            📡 Data Sources
          </div>
          {methodology.data_sources?.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 3, fontFamily: 'JetBrains Mono, monospace' }}>• {s}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AIDecisions() {
  const [data,      setData]     = useState({ decisions: [], methodology: null, total: 0 })
  const [loading,   setLoading]  = useState(true)
  const [live,      setLive]     = useState(false)
  const [expanded,  setExpanded] = useState(null)
  const [filter,    setFilter]   = useState('ALL')
  const [waiting,   setWaiting]  = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/decisions?limit=30')
      if (!res.ok) throw new Error('offline')
      const json = await res.json()
      setData(json)
      setLive(true)
    } catch {
      setLive(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [load])

  const decisions = data.decisions ?? []
  const methodology = data.methodology

  const filtered = filter === 'ALL'
    ? decisions
    : decisions.filter(d => d.severity === filter)

  const counts = ['CRITICAL','HIGH','MEDIUM','LOW'].reduce((acc, s) => {
    acc[s] = decisions.filter(d => d.severity === s).length
    return acc
  }, {})

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1440, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em' }}>AI Decision Transparency</h1>
          <LiveIndicator label={live ? 'LIVE INFERENCE' : 'OFFLINE'} color="var(--purple)" offline={!live} />
        </div>
        <p style={{ color: 'var(--t2)', fontSize: 13 }}>
          Full ML reasoning chain for every alert — see exactly <em>why</em> each model fired and how the ensemble voted.
        </p>
      </div>

      {/* Methodology */}
      <MethodologyPanel methodology={methodology} />

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Decisions',  value: data.total,          color: 'var(--t2)' },
          { label: 'Critical',   value: counts.CRITICAL ?? 0, color: 'var(--red)' },
          { label: 'High',       value: counts.HIGH ?? 0,     color: 'var(--orange)' },
          { label: 'Medium',     value: counts.MEDIUM ?? 0,   color: 'var(--yellow)' },
          { label: 'Low',        value: counts.LOW ?? 0,      color: 'var(--green)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            padding: '8px 20px', borderRadius: 'var(--r-sm)',
            background: `${color}08`, border: `1px solid ${color}20`,
            display: 'flex', flexDirection: 'column', gap: 2, flex: '1 0 auto',
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
            <span style={{ fontSize: 9.5, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Severity filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {['ALL','CRITICAL','HIGH','MEDIUM','LOW'].map(s => {
          const colMap = { ALL: 'var(--cyan)', CRITICAL: 'var(--red)', HIGH: 'var(--orange)', MEDIUM: 'var(--yellow)', LOW: 'var(--green)' }
          const c = colMap[s]
          const active = filter === s
          return (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
              border: `1px solid ${active ? c : 'var(--b1)'}`,
              background: active ? `${c}15` : 'transparent',
              color: active ? c : 'var(--t2)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
              fontFamily: 'JetBrains Mono, monospace',
            }}>{s} {s !== 'ALL' && counts[s] != null ? `(${counts[s]})` : ''}</button>
          )
        })}
      </div>

      {/* Decision list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--t3)' }}>
          <div style={{ fontSize: 32, marginBottom: 12, animation: 'pulse 1.2s ease-in-out infinite' }}>🧠</div>
          Loading AI decisions…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--t3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', marginBottom: 6 }}>No Decisions Yet</div>
          <div style={{ fontSize: 13 }}>
            {live ? 'Backend is live but no alerts accumulated yet — wait a few seconds.' : 'Backend API is offline. Start the backend server first.'}
          </div>
        </div>
      ) : (
        <div>
          {filtered.map((d, i) => (
            <DecisionCard
              key={d.id ?? i}
              decision={d}
              expanded={expanded === i}
              onToggle={() => setExpanded(expanded === i ? null : i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
