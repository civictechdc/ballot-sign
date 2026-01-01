export function ActivityRow(props: { label: 'Signed' | 'Following'; value: string }) {
  return (
    <div className="sans" style={{ fontSize: 15, color: 'var(--text-primary)' }}>
      <span style={{ fontWeight: 600 }}>{props.label}:</span> <span style={{ fontWeight: 400 }}>{props.value}</span>
    </div>
  )
}
