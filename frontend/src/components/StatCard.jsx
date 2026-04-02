import { useState, useEffect, useRef } from 'react'

export default function StatCard({ label, value, unit = '', color = 'var(--cyan)', icon, sub, animate = true }) {
  const [displayed, setDisplayed] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const target = Number(value) || 0
    const prev   = prevRef.current
    if (!animate || target === prev) { setDisplayed(target); return }
    const delta    = target - prev
    const duration = 600
    const steps    = 30
    const stepTime = duration / steps
    let current = prev
    let step    = 0
    const timer = setInterval(() => {
      step++
      current = prev + (delta * (step / steps))
      setDisplayed(Math.round(current))
      if (step >= steps) { setDisplayed(target); prevRef.current = target; clearInterval(timer) }
    }, stepTime)
    return () => clearInterval(timer)
  }, [value, animate])

  return (
    <div style={{ ...S.card, borderColor: `${color}22` }}>
      {/* Top glow strip */}
      <div style={{ ...S.strip, background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />

      <div style={S.top}>
        <span style={S.label}>{label}</span>
        {icon && <span style={{ color, fontSize: 14 }}>{icon}</span>}
      </div>

      <div style={S.valueRow}>
        <span style={{ ...S.value, color }} className="mono">
          {displayed.toLocaleString()}
        </span>
        {unit && <span style={S.unit}>{unit}</span>}
      </div>

      {sub && <div style={S.sub}>{sub}</div>}
    </div>
  )
}

const S = {
  card: {
    background: 'var(--glass)',
    backdropFilter: 'var(--blur-sm)',
    WebkitBackdropFilter: 'var(--blur-sm)',
    border: '1px solid',
    borderRadius: 'var(--r-md)',
    padding: '20px 22px 18px',
    position: 'relative',
    overflow: 'hidden',
    flex: 1,
    minWidth: 0,
    transition: 'border-color 300ms ease',
  },
  strip: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 1, opacity: 0.6,
  },
  top: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  label: {
    fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'var(--t3)',
  },
  valueRow: {
    display: 'flex', alignItems: 'baseline', gap: 6,
  },
  value: {
    fontSize: 32, fontWeight: 700, lineHeight: 1,
    animation: 'count-up 300ms ease-out',
  },
  unit: {
    fontSize: 13, color: 'var(--t2)', fontWeight: 500,
  },
  sub: {
    marginTop: 6, fontSize: 11, color: 'var(--t3)',
  },
}
