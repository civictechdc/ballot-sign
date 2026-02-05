import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../app/AppProviders'

const fontLinks = [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  {
    rel: 'stylesheet',
    href:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600&display=swap',
  },
]

export function Header() {
  const { user, isLoading, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [searchValue, setSearchValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<Array<{ type: 'initiative' | 'target'; label: string; id?: string }>>([])
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isAdmin, setIsAdmin] = useState(false)
  const searchTimer = useRef<number | null>(null)

  useEffect(() => {
    const created: HTMLLinkElement[] = []
    for (const attrs of fontLinks) {
      if (document.head.querySelector(`link[rel="${attrs.rel}"][href="${attrs.href}"]`)) {
        continue
      }
      const link = document.createElement('link')
      link.rel = attrs.rel
      link.href = attrs.href
      if (attrs.crossOrigin) {
        link.crossOrigin = attrs.crossOrigin
      }
      document.head.appendChild(link)
      created.push(link)
    }

    return () => {
      for (const link of created) {
        link.remove()
      }
    }
  }, [])

  useEffect(() => {
    const nextValue = searchParams.get('q') ?? ''
    setSearchValue(nextValue)
  }, [searchParams])

  useEffect(() => {
    if (searchTimer.current) {
      window.clearTimeout(searchTimer.current)
    }
    searchTimer.current = window.setTimeout(() => {
      const trimmed = searchValue.trim()
      const current = searchParams.get('q') ?? ''
      if (trimmed === current) return
      const nextSearch = trimmed ? `?q=${encodeURIComponent(trimmed)}` : ''
      if (location.pathname !== '/') {
        navigate({ pathname: '/', search: nextSearch })
      } else {
        navigate({ pathname: '/', search: nextSearch }, { replace: true })
      }
    }, 200)
    return () => {
      if (searchTimer.current) {
        window.clearTimeout(searchTimer.current)
      }
    }
  }, [searchValue, searchParams, location.pathname, navigate])

  useEffect(() => {
    let cancelled = false
    if (!searchValue.trim()) {
      setSearchSuggestions([])
      setSearchOpen(false)
      return
    }
    fetch('/api/ballot/initiatives')
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((data) => {
        if (cancelled) return
        const items = Array.isArray(data) ? data : []
        const query = searchValue.trim().toLowerCase()
        const suggestions: Array<{ type: 'initiative' | 'target'; label: string; id?: string }> = []
        const seen = new Set<string>()
        for (const item of items) {
          if (!item || suggestions.length >= 6) break
          const title = String(item.title || '')
          const location = String(item.location || '')
          const haystack = `${title} ${location}`.toLowerCase()
          if (!haystack.includes(query)) continue
          if (title) {
            const key = `initiative:${title}`
            if (!seen.has(key)) {
              suggestions.push({ type: 'initiative', label: title, id: item.id })
              seen.add(key)
            }
          }
          if (location) {
            const key = `target:${location}`
            if (!seen.has(key)) {
              suggestions.push({ type: 'target', label: location })
              seen.add(key)
            }
          }
        }
        setSearchSuggestions(suggestions.slice(0, 6))
        setSearchOpen(suggestions.length > 0)
      })
      .catch(() => {
        if (!cancelled) {
          setSearchSuggestions([])
          setSearchOpen(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [searchValue])

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }
    const controller = new AbortController()
    fetch('/api/ballot/admin/me', {
      headers: user ? { Authorization: `Bearer ${sessionStorage.getItem('pidp.token') || ''}` } : undefined,
      signal: controller.signal,
    })
      .then((resp) => (resp.ok ? resp.json() : { is_admin: false }))
      .then((data) => setIsAdmin(Boolean(data.is_admin)))
      .catch(() => setIsAdmin(false))
    return () => controller.abort()
  }, [user])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!menuRef.current) return
      if (menuRef.current.contains(event.target as Node)) return
      setIsMenuOpen(false)
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsMenuOpen(false)
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('keydown', handleKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [isMenuOpen])

  return (
    <header
      style={{
        backgroundColor: '#f3f0dd',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid #d4d1c2',
      }}
    >
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <img src="/laurel_wreath_logo.png" alt="Ballot Sign Logo" style={{ width: 64, height: 64 }} />
      </Link>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1, justifyContent: 'flex-end' }}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
          }}
          style={{ flex: '1 1 280px', maxWidth: 520, position: 'relative' }}
        >
          <input
            type="search"
            placeholder="Search initiatives"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            aria-label="Search initiatives"
            onFocus={() => {
              if (searchSuggestions.length) setSearchOpen(true)
            }}
            onBlur={() => {
              window.setTimeout(() => setSearchOpen(false), 150)
            }}
            style={{
              width: '100%',
              padding: '0.55rem 0.9rem',
              borderRadius: 999,
              border: '1px solid #d4d1c2',
              background: '#ffffff',
              fontSize: '0.95rem',
            }}
          />
          {searchOpen && searchSuggestions.length ? (
            <div
              role="listbox"
              style={{
                position: 'absolute',
                top: 'calc(100% + 0.4rem)',
                left: 0,
                right: 0,
                background: '#fff',
                border: '1px solid #d4d1c2',
                borderRadius: 12,
                boxShadow: '0 12px 30px rgba(15, 12, 6, 0.15)',
                padding: '0.35rem',
                zIndex: 20,
              }}
            >
              {searchSuggestions.map((item) => (
                <button
                  key={`${item.type}:${item.label}`}
                  type="button"
                  role="option"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (item.type === 'initiative' && item.id) {
                      navigate(`/campaign/initiatives/${item.id}/ballot`)
                      setSearchOpen(false)
                      return
                    }
                    if (item.type === 'target') {
                      navigate(`/targets/${encodeURIComponent(item.label)}`)
                      setSearchOpen(false)
                      return
                    }
                    setSearchValue(item.label)
                    setSearchOpen(false)
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.45rem 0.65rem',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    borderRadius: 8,
                  }}
                >
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8479', marginRight: 6 }}>
                    {item.type === 'initiative' ? 'Initiative' : 'Target'}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </form>
        {isLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: '1px solid #d4d1c2',
              color: '#1a1a1a',
              fontSize: '0.95rem',
              fontWeight: 500,
            }}
          >
            <div style={{ width: 32, height: 32, background: '#dbd8c7', borderRadius: '50%', border: '1px solid #d4d1c2' }} />
            <span>Loading…</span>
          </div>
        ) : user ? (
          <div
            ref={menuRef}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: '1px solid #d4d1c2',
              color: '#1a1a1a',
              fontSize: '0.95rem',
              fontWeight: 500,
            }}
          >
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                border: 'none',
                background: 'transparent',
                font: 'inherit',
                cursor: 'pointer',
                color: 'inherit',
                padding: 0,
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #d4d1c2', overflow: 'hidden', background: '#dbd8c7' }}>
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </div>
              <span>{user.displayName}</span>
            </button>
            {isMenuOpen ? (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 0.5rem)',
                  background: '#ffffff',
                  border: '1px solid #d4d1c2',
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  minWidth: 180,
                  padding: '0.5rem',
                  zIndex: 10,
                }}
              >
                <Link
                  to="/constituent/profile"
                  role="menuitem"
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    textDecoration: 'none',
                    color: '#1a1a1a',
                    borderRadius: 6,
                  }}
                >
                  Profile
                </Link>
                {isAdmin ? (
                  <Link
                    to="/admin"
                    role="menuitem"
                    style={{
                      display: 'block',
                      padding: '0.5rem 0.75rem',
                      textDecoration: 'none',
                      color: '#1a1a1a',
                      borderRadius: 6,
                    }}
                  >
                    Admin
                  </Link>
                ) : null}
                <Link
                  to="/campaign/initiatives/new"
                  role="menuitem"
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    textDecoration: 'none',
                    color: '#1a1a1a',
                    borderRadius: 6,
                  }}
                >
                  Start a Petition
                </Link>
                <Link
                  to="/campaign/initiatives/editable"
                  role="menuitem"
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    textDecoration: 'none',
                    color: '#1a1a1a',
                    borderRadius: 6,
                  }}
                >
                  My Editable Initiatives
                </Link>
                <Link
                  to="/about"
                  role="menuitem"
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    textDecoration: 'none',
                    color: '#1a1a1a',
                    borderRadius: 6,
                  }}
                >
                  About
                </Link>
                <Link
                  to="/constituent/account"
                  role="menuitem"
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    textDecoration: 'none',
                    color: '#1a1a1a',
                    borderRadius: 6,
                  }}
                >
                  Settings
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false)
                    logout()
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.5rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    color: '#1a1a1a',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <Link
            to="/constituent/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#ffffff',
              padding: '0.5rem 1rem',
              borderRadius: 8,
              border: '1px solid #d4d1c2',
              color: '#1a1a1a',
              fontSize: '0.95rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Login
          </Link>
        )}
      </nav>
    </header>
  )
}
