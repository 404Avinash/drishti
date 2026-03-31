import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TrainDetail() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  
  useEffect(() => {
    const host = import.meta.env.DEV ? 'http://localhost:8000' : ''
    fetch(`${host}/api/train/${id}/risk`)
      .then(res => res.json())
      .then(d => setData(d))
  }, [id])

  if (!data) return <div style={{ padding: '40px', textAlign: 'center' }}>Locating Train...</div>

  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--blue)', marginBottom: '20px', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Network
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '2rem', margin: 0 }}>🚆 {id}</h2>
        <span style={{ 
          padding: '4px 12px', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.8rem',
          background: `var(--${data.risk_level.toLowerCase()}-g)`,
          color: `var(--${data.risk_level.toLowerCase()})`,
          border: `1px solid var(--${data.risk_level.toLowerCase()}-b)`
        }}>
          {data.risk_level} RISK
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="glass-panel">
          <div className="glass-header">Risk Score</div>
          <div className="glass-content" style={{ fontSize: '2rem', fontWeight: 800 }}>{data.risk_score}%</div>
        </div>
        <div className="glass-panel">
          <div className="glass-header">Alert History Count</div>
          <div className="glass-content" style={{ fontSize: '2rem', fontWeight: 800 }}>{data.alert_count}</div>
        </div>
      </div>

      {data.last_alert && (
        <div className="glass-panel">
          <div className="glass-header">Latest Incident Report</div>
          <div className="glass-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
              <span style={{ color: 'var(--t3)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Location</span>
              <span>{data.last_alert.station_name} ({data.last_alert.station_code})</span>
              
              <span style={{ color: 'var(--t3)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Zone</span>
              <span>{data.last_alert.zone}</span>

              <span style={{ color: 'var(--t3)', textTransform: 'uppercase', fontSize: '0.75rem' }}>Timestamp</span>
              <span>{new Date(data.last_alert.timestamp).toLocaleString()}</span>
              
              <span style={{ color: 'var(--t3)', textTransform: 'uppercase', fontSize: '0.75rem' }}>AI Logic</span>
              <span style={{ color: 'var(--orange)' }}>{data.last_alert.explanation}</span>
            </div>
            
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <h4 style={{ color: 'var(--t2)', marginBottom: '8px', fontSize: '0.8rem', textTransform: 'uppercase' }}>Recommended Actions</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {data.last_alert.actions.map(act => (
                  <span key={act} style={{ background: 'var(--bg2)', padding: '6px 12px', borderRadius: '4px', fontSize: '0.7rem', border: '1px solid var(--border-b)' }}>
                    {act}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
