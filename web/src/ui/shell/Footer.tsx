import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer
      style={{
        marginTop: 'auto',
        borderTop: '1px solid #d4d1c2',
        background: '#f3f0dd',
        padding: '1.25rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      <span className="muted">© 2026 Ballot</span>
      <Link to="/about" style={{ color: '#1a1a1a', textDecoration: 'none', fontWeight: 500 }}>
        About us
      </Link>
    </footer>
  )
}
