import { Link, NavLink, useNavigate } from 'react-router-dom'

function BrandMark(props: { size?: number }) {
  const size = props.size ?? 32
  return (
    <img
      src="/laurel_wreath_logo.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}

function PrimaryNav() {
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    fontFamily: 'var(--font-sans)',
    fontSize: 16,
    fontWeight: 500,
    color: 'var(--text-primary)',
    textDecoration: isActive ? 'underline' : 'none',
  })

  return (
    <nav aria-label="Primary" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
      <NavLink to="/" style={linkStyle} end>
        Find Initiatives
      </NavLink>
      <NavLink to="/campaign/initiatives/new" style={linkStyle}>
        Start a Petition
      </NavLink>
      <NavLink to="/about" style={linkStyle}>
        About
      </NavLink>
    </nav>
  )
}

function AccountButton(props: { firstName: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="sans"
      style={{
        border: '1px solid var(--border-subtle)',
        background: 'transparent',
        borderRadius: 'var(--radius-md)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 15,
      }}
      aria-label="Account"
    >
      <span
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: 'color-mix(in oklab, var(--icon-tile-bg) 70%, white 30%)',
          border: '1px solid var(--border-subtle)',
          display: 'inline-flex',
        }}
      />
      Hi, {props.firstName}
    </button>
  )
}

export function Header() {
  const navigate = useNavigate()
  return (
    <header style={{ borderBottom: '1px solid var(--divider-header)' }}>
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <Link to="/" aria-label="Home" style={{ display: 'inline-flex' }}>
          <BrandMark size={64} />
        </Link>
        {/* Right-aligned nav group near the account button (per spec feedback) */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 24 }}>
          <PrimaryNav />
          <AccountButton firstName="Alex" onClick={() => navigate('/constituent/account')} />
        </div>
      </div>
    </header>
  )
}
