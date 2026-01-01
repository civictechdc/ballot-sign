export function Hero(props: { cityState: string; name: string; topics: string[] }) {
  return (
    <section style={{ textAlign: 'center', marginTop: 48, marginBottom: 48 }}>
      <h1
        className="serif"
        style={{
          margin: 0,
          fontSize: 52,
          lineHeight: 1.05,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 16,
        }}
      >
        Your Voice for {props.cityState}.
      </h1>
      <p
        className="sans"
        style={{
          margin: '0 auto',
          fontSize: 17,
          lineHeight: 1.5,
          maxWidth: 700,
          color: 'var(--text-primary)',
        }}
      >
        Welcome back, {props.name}. We've curated initiatives for you based on your recent activity in {props.cityState} and
        your interest in {props.topics.join(' and ')}.
      </p>
    </section>
  )
}
