function formatInt(n: number) {
  return n.toLocaleString()
}

export function SignatureProgress(props: { current: number; goal: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((props.current / props.goal) * 100)))
  return (
    <div>
      <div className="sans" style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 8 }}>
        Signatures: {formatInt(props.current)} / {formatInt(props.goal)}
      </div>
      <div
        style={{
          height: 6,
          width: '100%',
          background: '#e8e6dc',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: 'var(--btn-primary-bg)',
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </div>
    </div>
  )
}
