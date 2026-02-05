export function NewsItem(props: { title: string; showDivider?: boolean }) {
  return (
    <div
      className="sans"
      style={{
        fontSize: 15,
        color: 'var(--text-primary)',
        lineHeight: 1.5,
        padding: '8px 0',
        borderBottom: props.showDivider ? '1px solid #e8e6dc' : 'none',
      }}
    >
      {props.title}
    </div>
  )
}
