import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Network, Database, AlertOctagon } from 'lucide-react'

export default function Models() {
  const [data, setData] = useState(null)

  useEffect(() => {
    const host = import.meta.env.DEV ? 'http://localhost:8000' : ''
    fetch(`${host}/api/models/explainability`)
      .then(res => res.json())
      .then(d => setData(d))
  }, [])

  if (!data) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Explainability Engine...</div>

  // Mock normal distribution for Isolation Forest visualization
  const isoData = Array.from({length: 20}).map((_, i) => ({
    x: i * 5,
    normal: Math.exp(-Math.pow(i - 10, 2) / 10) * 100,
    anomaly: i > 15 ? Math.exp(-Math.pow(i - 18, 2) / 2) * 40 : 0
  }))

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>AI Model Explainability</h2>
      <p style={{ color: 'var(--t3)', marginBottom: '24px', fontSize: '0.9rem' }}>
        Transparent breakdown of the underlying predictive mathematics driving DRISHTI.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        
        {/* Bayesian Network */}
        <div className="glass-panel" style={{ height: '350px' }}>
          <div className="glass-header">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Network size={16} /> Bayesian Belief Network</div>
          </div>
          <div className="glass-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '40px' }}>
              <div style={{ padding: '12px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px' }}>P(Signal|Delay) = 0.88</div>
              <div style={{ padding: '12px 20px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px' }}>P(Speed|Clear) = 0.72</div>
            </div>
            <div style={{ height: '40px', borderLeft: '2px dashed var(--blue)' }}></div>
            <div style={{ padding: '16px 30px', background: 'var(--red-g)', border: '1px solid var(--red)', borderRadius: '8px', color: 'var(--red)', fontWeight: 'bold' }}>
              P(Collision) = 0.82
            </div>
          </div>
        </div>

        {/* Isolation Forest */}
        <div className="glass-panel" style={{ height: '350px' }}>
          <div className="glass-header">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Database size={16} /> Isolation Forest Anomalies</div>
          </div>
          <div className="glass-content" style={{ padding: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={isoData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <XAxis dataKey="x" stroke="var(--border)" tick={{fill: 'var(--t3)'}} />
                <YAxis stroke="var(--border)" tick={{fill: 'var(--t3)'}} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px'}} />
                <Area type="monotone" dataKey="normal" stroke="var(--blue)" fill="var(--blue-g)" />
                <Area type="monotone" dataKey="anomaly" stroke="var(--red)" fill="var(--red-g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Causal DAG */}
        <div className="glass-panel" style={{ gridColumn: '1 / -1' }}>
          <div className="glass-header">
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><AlertOctagon size={16} /> Causal Impact Chain DAG</div>
          </div>
          <div className="glass-content" style={{ display: 'flex', alignItems: 'center', gap: '20px', overflowX: 'auto', padding: '30px' }}>
            <div style={{ background: 'var(--border)', padding: '12px', borderRadius: '8px' }}>{data.causal_dag.root_cause}</div>
            <div style={{ color: 'var(--blue)' }}>➔</div>
            {data.causal_dag.impact_chain.map((step, i) => (
              <React.Fragment key={i}>
                <div style={{ background: i === 2 ? 'var(--red-b)' : 'var(--bg3)', border: `1px solid ${i === 2 ? 'var(--red)' : 'var(--blue)'}`, padding: '12px', borderRadius: '8px' }}>{step}</div>
                {i < data.causal_dag.impact_chain.length - 1 && <div style={{ color: 'var(--orange)' }}>➔</div>}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
