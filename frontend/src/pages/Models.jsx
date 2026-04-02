import { useState, useEffect } from 'react'
import LiveIndicator from '../components/LiveIndicator'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts'

function ModelCard({ name, status, accuracy, latency, description, color }) {
  return (
    <div style={{ padding: '20px 22px', background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: `1px solid ${color}25`, borderRadius: 'var(--r-md)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--t1)', marginBottom: 2 }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>{description}</div>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 20, background: `${color}15`, border: `1px solid ${color}30`, color, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
          {status}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        {accuracy != null && (
          <div>
            <div style={{ fontSize: 9.5, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Accuracy</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, color }}>{accuracy}%</div>
          </div>
        )}
        {latency != null && (
          <div>
            <div style={{ fontSize: 9.5, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Latency</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: 'var(--cyan)' }}>{latency}ms</div>
          </div>
        )}
      </div>
    </div>
  )
}

const FEATURE_DATA = [
  { feature: 'Speed Deviation', importance: 0.92, color: 'var(--red)' },
  { feature: 'Track Quality',   importance: 0.78, color: 'var(--orange)' },
  { feature: 'Occupancy Rate',  importance: 0.71, color: 'var(--yellow)' },
  { feature: 'Weather Factor',  importance: 0.63, color: 'var(--purple)' },
  { feature: 'Delay History',   importance: 0.58, color: 'var(--cyan)' },
  { feature: 'Zone Risk',       importance: 0.51, color: 'var(--green)' },
  { feature: 'Traffic Density', importance: 0.44, color: 'var(--t2)' },
  { feature: 'Time of Day',     importance: 0.37, color: 'var(--t3)' },
]

const RADAR_DATA = [
  { metric: 'Precision',  score: 94 },
  { metric: 'Recall',     score: 87 },
  { metric: 'F1 Score',   score: 90 },
  { metric: 'AUC-ROC',    score: 96 },
  { metric: 'Calibration',score: 82 },
  { metric: 'Coverage',   score: 88 },
]

export default function Models() {
  const [health, setHealth] = useState(null)
  const [live,   setLive]   = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/health')
        if (res.ok) { setHealth(await res.json()); setLive(true) }
      } catch { setLive(false) }
    }
    load()
    const iv = setInterval(load, 20000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '0.04em' }}>AI Intelligence Brain</h1>
          <LiveIndicator label={live ? 'INFERENCE ACTIVE' : 'OFFLINE'} color="var(--purple)" offline={!live} />
        </div>
        <p style={{ color: 'var(--t2)', fontSize: 13 }}>
          Bayesian Network probabilistic engine · pgmpy inference · SHAP explainability
        </p>
      </div>

      {/* Model cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
        <ModelCard
          name="Bayesian Safety Network"
          status="ACTIVE"
          accuracy={94}
          latency={87}
          description="pgmpy Variable Elimination · Junction tree inference"
          color="var(--purple)"
        />
        <ModelCard
          name="CRS Signature Matcher"
          status="MONITORING"
          accuracy={91}
          latency={42}
          description="Historical accident pattern recognition · 50-year CRS database"
          color="var(--orange)"
        />
        <ModelCard
          name="NTES Stream Processor"
          status="ACTIVE"
          accuracy={null}
          latency={12}
          description="Real-time telemetry parsing · 17-field feature extraction"
          color="var(--cyan)"
        />
        <ModelCard
          name="Cascade Risk Predictor"
          status="ACTIVE"
          accuracy={88}
          latency={156}
          description="Graph neural network · Betweenness centrality weighting"
          color="var(--red)"
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 24 }}>

        {/* Feature importance */}
        <div style={{ padding: '20px', background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--b1)', borderRadius: 'var(--r-md)' }}>
          <div style={{ marginBottom: 16, fontSize: 12, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            SHAP Feature Importance — Bayesian Network
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FEATURE_DATA.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                <span style={{ width: 130, color: 'var(--t2)', fontSize: 11.5, flexShrink: 0 }}>{f.feature}</span>
                <div style={{ flex: 1, height: 8, background: 'var(--raised)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    width: `${f.importance * 100}%`,
                    background: `linear-gradient(90deg, ${f.color}, ${f.color}88)`,
                    transition: 'width 800ms ease',
                    boxShadow: `0 0 8px ${f.color}60`,
                  }} />
                </div>
                <span className="mono" style={{ width: 36, textAlign: 'right', color: 'var(--t3)', fontSize: 11 }}>
                  {f.importance.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Radar */}
        <div style={{ padding: '20px', background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--b1)', borderRadius: 'var(--r-md)' }}>
          <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Model Performance Metrics</div>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={RADAR_DATA}>
              <PolarGrid stroke="var(--b1)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--t3)', fontSize: 10 }} />
              <Radar name="Score" dataKey="score" stroke="var(--purple)" fill="var(--purple)" fillOpacity={0.15} strokeWidth={2} dot={{ fill: 'var(--purple)', r: 3 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--b2)', borderRadius: 8, fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline status */}
      <div style={{ padding: '20px', background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--b1)', borderRadius: 'var(--r-md)' }}>
        <div style={{ marginBottom: 16, fontSize: 12, fontWeight: 700, color: 'var(--t2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Inference Pipeline</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 8 }}>
          {[
            { step: 'NTES Ingest',       status: 'ok',      color: 'var(--green)' },
            { step: 'Feature Extract',   status: 'ok',      color: 'var(--green)' },
            { step: 'Bayesian Inference',status: 'ok',      color: 'var(--purple)' },
            { step: 'CRS Matching',      status: 'ok',      color: 'var(--orange)' },
            { step: 'Alert Generation',  status: 'ok',      color: 'var(--red)' },
            { step: 'API Broadcast',     status: live ? 'ok' : 'err', color: live ? 'var(--cyan)' : 'var(--red)' },
          ].map((s, i, arr) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ padding: '10px 18px', background: `${s.color}10`, border: `1px solid ${s.color}30`, borderRadius: 'var(--r-sm)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 18, marginBottom: 4 }}>
                  {s.status === 'ok' ? '✓' : '✗'}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: '0.08em' }}>{s.step}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ width: 30, height: 1, background: 'var(--b2)', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
