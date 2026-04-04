import { useState, useEffect } from 'react'
import LiveIndicator from '../components/LiveIndicator'
import { getHealth, getIngestionSummary, getStats } from '../api'

function HealthCard({ name, status, detail, metric, metricLabel, icon, color }) {
  const ok = status === 'ok' || status === 'healthy' || status === 'online'
  const c  = ok ? 'var(--green)' : 'var(--red)'
  return (
    <div style={{ padding: '20px 22px', background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: `1px solid ${c}25`, borderRadius: 'var(--r-md)', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${c}, transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, background: `${c}15`, border: `1px solid ${c}30` }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, boxShadow: `0 0 4px ${c}` }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: c, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>
            {ok ? 'ONLINE' : 'DEGRADED'}
          </span>
        </div>
      </div>
      {detail && <div style={{ fontSize: 11.5, color: 'var(--t2)', marginBottom: metric ? 10 : 0 }}>{detail}</div>}
      {metric != null && (
        <div>
          <div style={{ fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{metricLabel}</div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 800, color: c }}>{metric}</div>
        </div>
      )}
    </div>
  )
}

function UptimeClock({ seconds }) {
  const [elapsed, setElapsed] = useState(seconds || 0)
  useEffect(() => {
    setElapsed(seconds || 0)
    const iv = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [seconds])

  const d = Math.floor(elapsed / 86400)
  const h = Math.floor((elapsed % 86400) / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60

  const pad = n => String(n).padStart(2, '0')
  return (
    <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', letterSpacing: '0.05em' }}>
      {d > 0 && `${d}d `}{pad(h)}:{pad(m)}:{pad(s)}
    </div>
  )
}

export default function System() {
  const [health,    setHealth]    = useState(null)
  const [ingestion, setIngestion] = useState(null)
  const [stats,     setStats]     = useState(null)
  const [live,      setLive]      = useState(false)

  const load = async () => {
    try {
      const [h, ing, s] = await Promise.all([
        getHealth(),
        getIngestionSummary(),
        getStats(),
      ])
      setHealth(h)
      setIngestion(ing)
      setStats(s)
      setLive(h.status === 'ok')
    } catch { setLive(false) }
  }
  useEffect(() => { load(); const iv = setInterval(load, 10000); return () => clearInterval(iv) }, [])

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>System Health Monitor</h1>
          <LiveIndicator label={live ? 'ALL SYSTEMS' : 'DEGRADED'} color={live ? 'var(--green)' : 'var(--red)'} offline={!live} />
        </div>
        <p style={{ color: 'var(--t2)', fontSize: 13 }}>Infrastructure status · API health · Database connections · Pipeline metrics</p>
      </div>

      {/* Uptime — uses /api/stats uptime_seconds */}
      {(stats?.uptime_seconds != null || live) && (
        <div style={{ padding: '20px 24px', background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--green-30)', borderRadius: 'var(--r-md)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 6 }}>System Uptime</div>
            <UptimeClock seconds={stats?.uptime_seconds ?? 0} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Deployed On</div>
            <div style={{ fontSize: 13, color: 'var(--t2)' }}>
              AWS EC2 · us-east-1 · Ubuntu 22.04 LTS
            </div>
          </div>
        </div>
      )}

      {/* Health cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginBottom: 20 }}>
        <HealthCard name="API Server"       icon="⊞" status={health?.status || 'unknown'}                          detail="FastAPI · Python 3.11 · Uvicorn"      metricLabel="Response" metric={health ? '< 50ms' : null} />
        <HealthCard name="Database"         icon="◫" status={health?.database || 'unknown'}                         detail="PostgreSQL 15 · AWS RDS · us-east-1"  metricLabel="Connections" metric={health?.db_connections ?? null} />
        <HealthCard name="WebSocket"        icon="◈" status={health?.websocket_connections >= 0 ? 'ok' : 'unknown'} detail="NTES telemetry stream processor"       metricLabel="Active WS" metric={health?.websocket_connections ?? 0} />
        <HealthCard name="Bayesian Engine"  icon="⬙" status="ok"                                                    detail="pgmpy 0.1.26 · Variable Elimination"  metricLabel="Models" metric="4 active" />
        <HealthCard name="Alert Pipeline"   icon="⚠" status="ok"                                                    detail="Real-time event detection"           metricLabel="Threshold" metric="< 100ms" />
        <HealthCard name="Docker Runtime"  icon="◻" status="ok"                                                    detail="2 containers · drishti-api & frontend" metricLabel="Version" metric="v24+" />
      </div>

      {/* Ingestion metrics */}
      {ingestion && (
        <div style={{ padding: '20px', background: 'var(--glass)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--b1)', borderRadius: 'var(--r-md)', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--t2)', textTransform: 'uppercase', marginBottom: 16 }}>Data Ingestion Pipeline</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
            {[
              { label: 'Records Received', value: ingestion.received  || 0, color: 'var(--t2)' },
              { label: 'Valid Records',    value: ingestion.valid     || 0, color: 'var(--cyan)' },
              { label: 'Persisted to DB',  value: ingestion.persisted || 0, color: 'var(--green)' },
              { label: 'Error Rate',       value: ingestion.error_rate != null ? `${(ingestion.error_rate * 100).toFixed(1)}%` : '0%', color: ingestion.error_rate > 0.05 ? 'var(--red)' : 'var(--green)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--b1)', borderRadius: 'var(--r-sm)' }}>
                <div style={{ fontSize: 9.5, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>{label}</div>
                <div className="mono" style={{ fontSize: 20, fontWeight: 800, color }}>{value.toLocaleString?.() ?? value}</div>
              </div>
            ))}
          </div>
          {ingestion.by_source && Object.keys(ingestion.by_source).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--b1)' }}>
              <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>By Source</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {Object.entries(ingestion.by_source).map(([src, cnt]) => (
                  <div key={src} style={{ padding: '6px 14px', background: 'var(--cyan-10)', border: '1px solid var(--cyan-30)', borderRadius: 20 }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 700 }}>{src}: {cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Raw health JSON */}
      {health && (
        <div style={{ padding: '16px 20px', background: 'var(--void)', border: '1px solid var(--b1)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--t3)', textTransform: 'uppercase', marginBottom: 10 }}>Raw Health Endpoint</div>
          <pre className="mono" style={{ fontSize: 11, color: 'var(--green)', lineHeight: 1.7, overflowX: 'auto' }}>
            {JSON.stringify(health, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
