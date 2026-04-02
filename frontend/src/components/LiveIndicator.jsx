export default function LiveIndicator({ label = 'LIVE', color = 'var(--green)', offline = false }) {
  const c = offline ? 'var(--t3)' : color
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 10, height: 10 }}>
        <span style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: c, opacity: offline ? 0.3 : 1,
        }} />
        {!offline && (
          <span style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: c, animation: 'ping 1.5s ease-in-out infinite',
          }} />
        )}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
        color: c, fontFamily: 'JetBrains Mono, monospace',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  )
}
