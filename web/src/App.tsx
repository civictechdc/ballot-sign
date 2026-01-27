import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from './app/AppProviders'
import { Header } from './ui/shell/Header'
import { Footer } from './ui/shell/Footer'
import { useLegislativeBody } from './ui/legislativeBodies'

const fontLinks = [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
  { 
    rel: 'stylesheet',
    href:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600&display=swap',
  }, 
]

export function App() {
  const { user, token } = useAuth()
  const { body: legislativeBody } = useLegislativeBody()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [newsItems, setNewsItems] = useState<Array<{ title: string; url: string; source: string; seen: string }>>([])
  const [newsError, setNewsError] = useState<string | null>(null)
  const [localNewsItems, setLocalNewsItems] = useState<Array<{ title: string; url: string; source: string; seen: string }>>([])
  const [localNewsError, setLocalNewsError] = useState<string | null>(null)
  const [localLabel, setLocalLabel] = useState<string>('Your area')
  const [newsEnabled, setNewsEnabled] = useState(false)
  const [initiatives, setInitiatives] = useState<
    Array<{
      id: string
      title: string
      description?: string
      required_signatures: number
      current_signatures: number
      progress_percentage: number
      location?: string
      upvote_count?: number
      downvote_count?: number
    }>
  >([])
  const [initiativesError, setInitiativesError] = useState<string | null>(null)
  const [expandedInitiatives, setExpandedInitiatives] = useState<Record<string, boolean>>({})
  const [isSigning, setIsSigning] = useState(false)
  const [signingInitiative, setSigningInitiative] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const [voteState, setVoteState] = useState<Record<string, 'up' | 'down' | null>>({})
  const [voteStatus, setVoteStatus] = useState<string | null>(null)
  const query = (searchParams.get('q') ?? '').trim()
  const normalizedQuery = query.toLowerCase()

  const filteredInitiatives = useMemo(() => {
    if (!normalizedQuery) return initiatives
    return initiatives.filter((initiative) => {
      const haystack = [initiative.title, initiative.description, initiative.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [initiatives, normalizedQuery])

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
    let cancelled = false

    fetch('/api/ballot/initiatives')
      .then(async (resp) => {
        if (!resp.ok) {
          const text = await resp.text().catch(() => '')
          throw new Error(text || `Failed to load initiatives (${resp.status})`)
        }
        return resp.json()
      })
      .then((data) => {
        if (cancelled) return
        setInitiatives(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (cancelled) return
        setInitiativesError(err instanceof Error ? err.message : 'Failed to load initiatives')
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!token || !initiatives.length) {
      setVoteState({})
      return
    }
    let cancelled = false
    const controller = new AbortController()
    async function hydrateVotes() {
      try {
        const results = await Promise.all(
          initiatives.map(async (initiative) => {
            const resp = await fetch(`/api/ballot/initiatives/${initiative.id}/vote`, {
              headers: { Authorization: `Bearer ${token}` },
              signal: controller.signal,
            })
            if (!resp.ok) return [initiative.id, null] as const
            const data = await resp.json()
            return [initiative.id, data.vote ?? null] as const
          }),
        )
        if (cancelled) return
        const next: Record<string, 'up' | 'down' | null> = {}
        for (const [id, vote] of results) {
          next[id] = vote
        }
        setVoteState(next)
      } catch {
        if (!cancelled) setVoteState({})
      }
    }
    hydrateVotes()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [initiatives, token])

  useEffect(() => {
    let cancelled = false

    if (!newsEnabled) {
      setNewsItems([])
      setNewsError(null)
      return () => {
        cancelled = true
      }
    }

    async function get5RandomGdelt() {
      const url =
        'https://api.gdeltproject.org/api/v2/doc/doc' +
        '?format=json&query=the&timespan=24h&maxrecords=250&sort=datedesc'

      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`News request failed (${res.status})`)
      }
      const text = await res.text()
      let data: { articles?: unknown } = {}
      try {
        data = JSON.parse(text) as { articles?: unknown }
      } catch {
        throw new Error(`News response was not JSON: ${text.slice(0, 120)}`)
      }
      const articles = Array.isArray(data.articles) ? data.articles : []

      for (let i = articles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[articles[i], articles[j]] = [articles[j], articles[i]]
      }

      return articles.slice(0, 5).map((a: { title: string; url: string; sourceCommonName: string; seendate: string }) => ({
        title: a.title,
        url: a.url,
        source: a.sourceCommonName,
        seen: a.seendate,
      }))
    }

    get5RandomGdelt()
      .then((items) => {
        if (cancelled) return
        setNewsItems(items)
      })
      .catch((err) => {
        if (cancelled) return
        setNewsError(err instanceof Error ? err.message : 'Failed to load news')
      })

    return () => {
      cancelled = true
    }
  }, [newsEnabled])

  useEffect(() => {
    if (!isSigning || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#1a1a1a'

    function getPoint(event: MouseEvent | TouchEvent) {
      const rect = canvas.getBoundingClientRect()
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    function start(event: MouseEvent | TouchEvent) {
      if (!ctx) return
      drawing.current = true
      const point = getPoint(event)
      ctx.beginPath()
      ctx.moveTo(point.x, point.y)
    }

    function move(event: MouseEvent | TouchEvent) {
      if (!ctx) return
      if (!drawing.current) return
      const point = getPoint(event)
      ctx.lineTo(point.x, point.y)
      ctx.stroke()
    }

    function end() {
      drawing.current = false
    }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', end)
    canvas.addEventListener('mouseleave', end)
    canvas.addEventListener('touchstart', start)
    canvas.addEventListener('touchmove', move)
    canvas.addEventListener('touchend', end)

    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', end)
      canvas.removeEventListener('mouseleave', end)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', end)
    }
  }, [isSigning])

  useEffect(() => {
    let cancelled = false

    if (!newsEnabled) {
      setLocalNewsItems([])
      setLocalNewsError(null)
      setLocalLabel('Your area')
      return () => {
        cancelled = true
      }
    }

    async function getLocalNews() {
      const geoRes = await fetch('https://ipapi.co/json/')
      if (!geoRes.ok) throw new Error('Location lookup failed')
      const geo = await geoRes.json()
      const city = geo.city as string | undefined
      const region = geo.region as string | undefined
      const country = geo.country_name as string | undefined
      const label = [city, region].filter(Boolean).join(', ') || country || 'Your area'
      if (!cancelled) setLocalLabel(label)

      const url =
        'https://api.gdeltproject.org/api/v2/doc/doc' +
        '?format=json&query=the&timespan=24h&maxrecords=250&sort=datedesc'

      const res = await fetch(url)
      if (!res.ok) throw new Error(`Local news request failed (${res.status})`)
      const text = await res.text()
      let data: { articles?: unknown } = {}
      try {
        data = JSON.parse(text) as { articles?: unknown }
      } catch {
        throw new Error(`Local news response was not JSON: ${text.slice(0, 120)}`)
      }
      const articles = Array.isArray(data.articles) ? data.articles : []
      const needles = [city, region, country]
        .filter(Boolean)
        .map((value) => value!.toLowerCase())

      const localArticles = needles.length
        ? articles.filter((article: { title?: string; url?: string }) => {
            const haystack = `${article.title ?? ''} ${article.url ?? ''}`.toLowerCase()
            return needles.some((needle) => haystack.includes(needle))
          })
        : articles

      for (let i = localArticles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[localArticles[i], localArticles[j]] = [localArticles[j], localArticles[i]]
      }

      return localArticles.slice(0, 5).map((a: { title: string; url: string; sourceCommonName: string; seendate: string }) => ({
        title: a.title,
        url: a.url,
        source: a.sourceCommonName,
        seen: a.seendate,
      }))
    }

    getLocalNews()
      .then((items) => {
        if (cancelled) return
        setLocalNewsItems(items)
      })
      .catch((err) => {
        if (cancelled) return
        setLocalNewsError(err instanceof Error ? err.message : 'Failed to load local news')
      })

    return () => {
      cancelled = true
    }
  }, [newsEnabled])

  return (
    <>
      <style>{`
        :root {
          --color-sage: #4c6d74;
          --color-sage-dark: #3d5a60;
          --color-sage-light: #5a7d84;
          --color-cream: #f3f0dd;
          --color-cream-dark: #dbd8c7;
          --color-text-primary: #1a1a1a;
          --color-text-secondary: #666666;
          --color-text-muted: #8a8a8a;
          --color-white: #ffffff;
          --color-border: #d4d1c2;
          --color-progress-bg: #d9d6cc;
          --color-progress-fill: #4c6d74;
          --color-icon-tile: #b9cec7;

          --font-display: 'Cormorant Garamond', Georgia, serif;
          --font-body: 'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif;

          --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
          --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
          --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);

          --radius-sm: 4px;
          --radius-md: 8px;
          --radius-lg: 12px;
          --radius-full: 9999px;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: var(--font-body);
          background-color: var(--color-cream);
          color: var(--color-text-primary);
          line-height: 1.6;
          min-height: 100vh;
        }

        /* Header */
        .header {
          background-color: var(--color-cream);
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 100;
          border-bottom: 1px solid var(--color-border);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .logo-icon {
          width: 64px;
          height: 64px;
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 2rem;
        }

        .nav-link {
          color: var(--color-text-primary);
          text-decoration: none;
          font-size: 1rem;
          font-weight: 500;
          transition: opacity 0.2s ease;
        }

        .nav-link:hover {
          text-decoration: underline;
        }

        .user-menu {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: var(--color-white);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border);
          color: var(--color-text-primary);
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: box-shadow 0.2s ease;
        }

        .user-menu:hover {
          box-shadow: var(--shadow-md);
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          background: var(--color-cream-dark);
          border-radius: 50%;
          border: 1px solid var(--color-border);
        }

        /* Main Content */
        .main {
          background-color: var(--color-cream);
          min-height: calc(100vh - 100px);
        }

        /* Hero Section */
        .hero {
          text-align: center;
          padding: 3rem 2rem 2rem;
          max-width: 800px;
          margin: 0 auto;
        }

        .hero-title {
          font-family: var(--font-display);
          font-size: 3rem;
          font-weight: 500;
          font-style: italic;
          color: var(--color-text-primary);
          margin-bottom: 0.75rem;
          letter-spacing: -0.02em;
        }

        .hero-subtitle {
          font-size: 1rem;
          color: var(--color-text-secondary);
          margin-bottom: 2rem;
        }

        .hero-subtitle strong {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        /* Content Grid */
        .content {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 2.5rem;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem 3rem;
        }

        /* Section Headers */
        .section-header {
          font-family: var(--font-display);
          font-size: 1.75rem;
          font-weight: 700;
          color: var(--color-text-primary);
          margin-bottom: 1.25rem;
        }

        /* Initiative Cards */
        .initiatives-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .initiative-card {
          background: var(--color-white);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }

        .initiative-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .initiative-content {
          display: flex;
          gap: 1rem;
        }

        .initiative-icon {
          width: 56px;
          height: 56px;
          background: var(--color-icon-tile);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .initiative-icon svg {
          width: 32px;
          height: 32px;
          fill: var(--color-sage);
        }

        .initiative-details {
          flex: 1;
        }

        .initiative-title {
          font-family: var(--font-body);
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-text-primary);
          margin-bottom: 0.75rem;
          line-height: 1.4;
        }

        .progress-container {
          margin-bottom: 0.5rem;
        }

        .progress-bar {
          height: 8px;
          background: var(--color-progress-bg);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--color-progress-fill);
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
        }

        .progress-text {
          font-size: 0.85rem;
          color: var(--color-text-secondary);
          margin-top: 0.5rem;
        }

        .sign-button {
          width: 100%;
          background: var(--color-sage);
          color: var(--color-white);
          border: none;
          border-radius: var(--radius-md);
          padding: 0.75rem 1.5rem;
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease, transform 0.1s ease;
          margin-top: 1rem;
        }

        .sign-button:hover {
          background: var(--color-sage-dark);
        }

        .sign-button:active {
          transform: scale(0.98);
        }

        /* Sidebar */
        .sidebar {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        /* Activity Section */
        .activity-section {
          margin-bottom: 2rem;
        }

        .activity-item {
          display: flex;
          gap: 0.5rem;
          padding: 0.625rem 0;
          font-size: 0.9rem;
        }

        .activity-label {
          font-weight: 600;
          color: var(--color-text-primary);
        }

        .activity-value {
          color: var(--color-text-secondary);
        }

        /* News Section */
        .news-section {
          margin-bottom: 2rem;
        }

        .news-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .news-icon {
          width: 32px;
          height: 32px;
          fill: var(--color-text-primary);
        }

        .news-card {
          background: var(--color-white);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: 1.25rem;
        }

        .news-list {
          display: flex;
          flex-direction: column;
        }

        .news-item {
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--color-cream-dark);
          font-size: 0.9rem;
          color: var(--color-text-primary);
          cursor: pointer;
          transition: color 0.2s ease;
        }

        .news-item:hover {
          color: var(--color-sage);
        }

        .news-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .news-item:first-child {
          padding-top: 0;
        }

        /* Responsive */
        @media (max-width: 900px) {
          .content {
            grid-template-columns: 1fr;
          }

          .hero-title {
            font-size: 2.25rem;
          }

          .nav {
            gap: 1rem;
          }

          .header {
            padding: 1rem;
          }
        }

        @media (max-width: 600px) {
          .nav-link:not(:last-child) {
            display: none;
          }

          .hero-title {
            font-size: 1.875rem;
          }

          .filters {
            justify-content: flex-start;
            padding: 0 0.5rem;
          }

          .content {
            padding: 0 1rem 2rem;
          }
        }

        /* Animations */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero {
          animation: fadeInUp 0.6s ease-out;
        }

        .initiative-card {
          animation: fadeInUp 0.5s ease-out backwards;
        }

        .initiative-card:nth-child(1) { animation-delay: 0.1s; }
        .initiative-card:nth-child(2) { animation-delay: 0.2s; }
        .initiative-card:nth-child(3) { animation-delay: 0.3s; }

        .sidebar > * {
          animation: fadeInUp 0.5s ease-out backwards;
        }

        .sidebar > *:nth-child(1) { animation-delay: 0.15s; }
        .sidebar > *:nth-child(2) { animation-delay: 0.25s; }
      `}</style>

      <Header />

      <main className="main">
        <section className="hero">
          <h1 className="hero-title">Your Voice for {legislativeBody}.</h1>
          <p className="hero-subtitle">
            Welcome back, <strong>{user?.displayName ?? 'friend'}</strong>. We{"'"}ve curated initiatives for you based
            on your recent activity in {legislativeBody} and your interest in Environment and Education.
          </p>

        </section>

        <div className="content">
            <section className="initiatives">
              <h2 className="section-header">Recommended for You</h2>
              <div className="initiatives-list">
                {initiativesError ? (
                  <p className="muted">{initiativesError}</p>
                ) : filteredInitiatives.length ? (
                  filteredInitiatives.map((initiative) => (
                    <article
                      key={initiative.id}
                      className="initiative-card"
                      data-initiative-id={initiative.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/campaign/initiatives/${initiative.id}/ballot`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          navigate(`/campaign/initiatives/${initiative.id}/ballot`)
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="initiative-content">
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.35rem',
                            marginRight: '0.75rem',
                          }}
                        >
                          <button
                            type="button"
                            aria-label="Upvote and sign"
                            onClick={async () => {
                              // prevent card navigation
                              const prevVote = voteState[initiative.id] ?? null
                              if (!token) {
                                setVoteStatus('Login required to vote.')
                              } else {
                                try {
                                  const resp = await fetch(`/api/ballot/initiatives/${initiative.id}/vote`, {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      Authorization: `Bearer ${token}`,
                                    },
                                    body: JSON.stringify({ vote: 'up' }),
                                  })
                                  if (!resp.ok) {
                                    const text = await resp.text().catch(() => '')
                                    throw new Error(text || `Vote failed (${resp.status})`)
                                  }
                                  const data = await resp.json()
                                  setVoteState((prev) => ({ ...prev, [initiative.id]: data.vote }))
                                  setInitiatives((prev) =>
                                    prev.map((item) => {
                                      if (item.id !== initiative.id) return item
                                      const nextUp =
                                        (item.upvote_count ?? 0) +
                                        (data.vote === 'up' ? 1 : 0) +
                                        (prevVote === 'up' && !data.vote ? -1 : 0) +
                                        (prevVote === 'down' && data.vote === 'up' ? 1 : 0)
                                      const nextDown =
                                        (item.downvote_count ?? 0) +
                                        (prevVote === 'down' && data.vote === 'up' ? -1 : 0)
                                      return { ...item, upvote_count: nextUp, downvote_count: nextDown }
                                    }),
                                  )
                                } catch (err) {
                                  setVoteStatus(err instanceof Error ? err.message : 'Vote failed.')
                                }
                              }
                              setSigningInitiative(initiative.id)
                              setIsSigning(true)
                            }}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              border: '1px solid var(--color-border)',
                              background: voteState[initiative.id] === 'up' ? '#e7f7ec' : '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: voteState[initiative.id] === 'up' ? '#1b8a3a' : '#2f2b22',
                            }}
                            onClickCapture={(event) => event.stopPropagation()}
                          >
                            ▲
                          </button>
                          <span className="muted" style={{ fontSize: '0.8rem' }}>
                            {(initiative.upvote_count ?? 0).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            aria-label="Downvote"
                            onClick={async () => {
                              // prevent card navigation
                              const prevVote = voteState[initiative.id] ?? null
                              if (!token) {
                                setVoteStatus('Login required to vote.')
                                return
                              }
                              try {
                                const resp = await fetch(`/api/ballot/initiatives/${initiative.id}/vote`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`,
                                  },
                                  body: JSON.stringify({ vote: 'down' }),
                                })
                                if (!resp.ok) {
                                  const text = await resp.text().catch(() => '')
                                  throw new Error(text || `Vote failed (${resp.status})`)
                                }
                                const data = await resp.json()
                                setVoteState((prev) => ({ ...prev, [initiative.id]: data.vote }))
                                setInitiatives((prev) =>
                                  prev.map((item) => {
                                    if (item.id !== initiative.id) return item
                                    const nextDown =
                                      (item.downvote_count ?? 0) +
                                      (data.vote === 'down' ? 1 : 0) +
                                      (prevVote === 'down' && !data.vote ? -1 : 0) +
                                      (prevVote === 'up' && data.vote === 'down' ? 1 : 0)
                                    const nextUp =
                                      (item.upvote_count ?? 0) +
                                      (prevVote === 'up' && data.vote === 'down' ? -1 : 0)
                                    return { ...item, upvote_count: nextUp, downvote_count: nextDown }
                                  }),
                                )
                              } catch (err) {
                                setVoteStatus(err instanceof Error ? err.message : 'Vote failed.')
                              }
                            }}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 999,
                              border: '1px solid var(--color-border)',
                              background: voteState[initiative.id] === 'down' ? '#fdeceb' : '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: voteState[initiative.id] === 'down' ? '#b42318' : '#2f2b22',
                            }}
                            onClickCapture={(event) => event.stopPropagation()}
                          >
                            ▼
                          </button>
                          <span className="muted" style={{ fontSize: '0.8rem' }}>
                            {(initiative.downvote_count ?? 0).toLocaleString()}
                          </span>
                          <span className="muted" style={{ fontSize: '0.75rem' }}>
                            {initiative.current_signatures.toLocaleString()} signed
                          </span>
                          {voteStatus ? (
                            <span className="muted" style={{ fontSize: '0.75rem', textAlign: 'center' }}>
                              {voteStatus}
                            </span>
                          ) : null}
                        </div>
                        <div className="initiative-icon">
                          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L8 8h2v3H8l-3 6h4v5h6v-5h4l-3-6h-2V8h2L12 2z" />
                          </svg>
                        </div>
                        <div className="initiative-details">
                          <h3 className="initiative-title">{initiative.title}</h3>
                          {initiative.location ? (
                            <p className="muted" style={{ marginTop: 0, marginBottom: '0.6rem' }}>
                              Target:{' '}
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  const nextSearch = `?q=${encodeURIComponent(initiative.location ?? '')}`
                                  navigate({ pathname: '/', search: nextSearch }, { replace: true })
                                }}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'inherit',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                  font: 'inherit',
                                }}
                              >
                                {initiative.location}
                              </button>
                            </p>
                          ) : null}
                          <div className="progress-container">
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${initiative.progress_percentage}%` }} />
                            </div>
                            <p className="progress-text">
                              Signatures: {initiative.current_signatures.toLocaleString()} /{' '}
                              {initiative.required_signatures.toLocaleString()}
                            </p>
                          </div>
                          {expandedInitiatives[initiative.id] ? (
                            <p className="muted" style={{ marginTop: '0.75rem' }}>
                              {initiative.description || 'No additional ballot details provided.'}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedInitiatives((prev) => ({
                                ...prev,
                                [initiative.id]: !prev[initiative.id],
                              }))
                            }
                            className="sign-button"
                            style={{
                              textDecoration: 'none',
                              display: 'inline-flex',
                              justifyContent: 'center',
                              background: 'transparent',
                              color: 'var(--color-text-primary)',
                              border: '1px solid var(--color-border)',
                              width: 36,
                              height: 36,
                              padding: 0,
                              borderRadius: 999,
                            }}
                            onClickCapture={(event) => event.stopPropagation()}
                          >
                            {expandedInitiatives[initiative.id] ? '−' : '+'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
                ) : initiatives.length ? (
                  <p className="muted">
                    No initiatives match “{query}”.
                  </p>
                ) : (
                  <p className="muted">Loading initiatives…</p>
                )}
              </div>
            </section>

          <aside className="sidebar">
            <div className="activity-section">
              <h2 className="section-header">Your Activity</h2>
              <div className="activity-item">
                <span className="activity-label">Signed:</span>
                <span className="activity-value">Clean Energy for All</span>
              </div>
              <div className="activity-item">
                <span className="activity-label">Following:</span>
                <span className="activity-value">Public Education Funding</span>
              </div>
            </div>

            <div className="news-section">
              <div className="news-header">
                <h2 className="section-header">Local Impact &amp; News</h2>
                <svg className="news-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="8" y1="2" x2="8" y2="18" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="16" y1="6" x2="16" y2="22" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="news-card">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Global News</div>
                    <div className="news-list">
                      {!newsEnabled ? (
                        <div className="news-item" style={{ color: 'var(--color-text-secondary)' }}>
                          News is disabled.
                        </div>
                      ) : null}
                      {newsError ? (
                        <div className="news-item" style={{ color: 'var(--color-text-secondary)' }}>
                          {newsError}
                        </div>
                      ) : null}
                      {newsEnabled && newsItems.length
                        ? newsItems.map((item) => (
                            <a
                              key={`${item.url}-${item.seen}`}
                              className="news-item"
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'block', textDecoration: 'none' }}
                            >
                              {item.title} <span style={{ color: 'var(--color-text-muted)' }}>· {item.source}</span>
                            </a>
                          ))
                        : newsEnabled && !newsError && <div className="news-item">Loading news…</div>}
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 600 }}>Local News · {localLabel}</div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={newsEnabled}
                          onChange={(event) => setNewsEnabled(event.target.checked)}
                        />
                        Enable news
                      </label>
                    </div>
                    <div className="news-list">
                      {!newsEnabled ? (
                        <div className="news-item" style={{ color: 'var(--color-text-secondary)' }}>
                          Local news is disabled.
                        </div>
                      ) : null}
                      {localNewsError ? (
                        <div className="news-item" style={{ color: 'var(--color-text-secondary)' }}>
                          {localNewsError}
                        </div>
                      ) : null}
                      {newsEnabled && localNewsItems.length
                        ? localNewsItems.map((item) => (
                            <a
                              key={`${item.url}-${item.seen}`}
                              className="news-item"
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'block', textDecoration: 'none' }}
                            >
                              {item.title} <span style={{ color: 'var(--color-text-muted)' }}>· {item.source}</span>
                            </a>
                          ))
                        : newsEnabled && !localNewsError && <div className="news-item">Loading news…</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
      {isSigning ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              maxWidth: 560,
              width: '100%',
              background: 'var(--color-white)',
              borderRadius: 12,
              padding: '1.25rem 1.5rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ fontSize: '1.1rem' }}>Sign this initiative</strong>
              <button type="button" onClick={() => setIsSigning(false)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Draw your signature below.
            </p>
            <canvas
              ref={canvasRef}
              width={480}
              height={200}
              style={{
                width: '100%',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                background: '#fff',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => {
                  const ctx = canvasRef.current?.getContext('2d')
                  if (!ctx || !canvasRef.current) return
                  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!signingInitiative) return
                  if (!token) {
                    alert('Login required to sign.')
                    return
                  }
                  try {
                    const signatureImage = canvasRef.current?.toDataURL('image/png') ?? undefined
                    const resp = await fetch(`/api/ballot/initiatives/${signingInitiative}/sign`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ initiative_id: signingInitiative, signature_image: signatureImage }),
                    })
                    if (!resp.ok) {
                      const text = await resp.text().catch(() => '')
                      throw new Error(text || `Sign failed (${resp.status})`)
                    }
                    setIsSigning(false)
                  } catch {
                    setIsSigning(false)
                  }
                }}
              >
                Submit signature
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default App
