export function InitiativeTitle(props: { title: string }) {
  return (
    <h3
      className="serif"
      style={{
        margin: 0,
        fontSize: 21,
        lineHeight: 1.3,
        fontWeight: 700,
        color: 'var(--text-primary)',
      }}
    >
      {props.title}
    </h3>
  )
}
