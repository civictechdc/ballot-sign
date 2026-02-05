import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Page not found</h1>
      <p className="muted">The page you’re looking for doesn’t exist in this demo.</p>
      <Link to="/">Go home</Link>
    </section>
  )
}
