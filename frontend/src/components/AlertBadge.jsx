export default function AlertBadge({ severity, size = 'sm' }) {
  const cfg = {
    CRITICAL: { label: 'CRITICAL', color: 'var(--red)',    bg: 'var(--red-10)',    border: 'var(--red-30)' },
    HIGH:     { label: 'HIGH',     color: 'var(--orange)', bg: 'var(--orange-10)', border: 'var(--orange-30)' },
    MEDIUM:   { label: 'MEDIUM',   color: 'var(--yellow)', bg: 'var(--yellow-10)', border: 'var(--yellow-30)' },
    LOW:      { label: 'LOW',      color: 'var(--green)',  bg: 'var(--green-10)',  border: 'var(--green-30)' },
    STABLE:   { label: 'STABLE',   color: 'var(--cyan)',   bg: 'var(--cyan-10)',   border: 'var(--cyan-30)' },
  }
  const c = cfg[severity?.toUpperCase()] || cfg.STABLE
  const fontSize = size === 'lg' ? 11 : 9.5
  const padding  = size === 'lg' ? '5px 12px' : '3px 8px'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding, borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, fontSize, fontWeight: 700,
      letterSpacing: '0.10em', textTransform: 'uppercase',
      fontFamily: 'JetBrains Mono, monospace',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: size === 'lg' ? 6 : 5,
        height: size === 'lg' ? 6 : 5,
        borderRadius: '50%',
        background: c.color,
        boxShadow: `0 0 6px ${c.color}`,
        flexShrink: 0,
      }} />
      {c.label}
    </span>
  )
}
