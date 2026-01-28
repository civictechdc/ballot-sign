import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../app/AppProviders'

export function ConstituentLoginPage() {
  const navigate = useNavigate()
  const { loginWithPassword, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'ballot-sign • Constituent login'
  }, [])

  useEffect(() => {
    if (!isLoading && isSubmitting) {
      setIsSubmitting(false)
      navigate('/')
    }
  }, [isLoading, isSubmitting, navigate])

  const handleSubmit = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await loginWithPassword(email, password)
    } catch (err) {
      setIsSubmitting(false)
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  return (
    <section className="panel">
      <h1 style={{ marginTop: 0 }}>Login (constituent)</h1>
      <div
        style={{ display: 'grid', gap: '0.6rem' }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          if (isSubmitting || isLoading) return
          const target = event.target as HTMLElement | null
          if (target && (target.tagName === 'TEXTAREA' || target.isContentEditable)) return
          event.preventDefault()
          handleSubmit()
        }}
      >
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <a
            href="/pidp/auth/google/login"
            style={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              border: '1px solid var(--border-input)',
              borderRadius: 8,
              padding: '0.6rem 1rem',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
              <svg viewBox="0 0 533.5 544.3" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path fill="#4285f4" d="M533.5 278.4c0-17.4-1.5-34.2-4.3-50.6H272.1v95.7h146.9c-6.3 34.1-25.1 63-53.5 82.4v68.3h86.5c50.6-46.6 81.5-115.3 81.5-195.8z"/>
                <path fill="#34a853" d="M272.1 544.3c72.9 0 134-24.1 178.6-65.4l-86.5-68.3c-24 16.1-54.8 25.6-92.1 25.6-70.8 0-130.8-47.7-152.3-112.1H32.6v70.5c44.4 88 135.5 149.7 239.5 149.7z"/>
                <path fill="#fbbc04" d="M119.8 324.1c-10.3-30.9-10.3-64.2 0-95.1v-70.5H32.6c-38.6 77-38.6 159.1 0 236.1l87.2-70.5z"/>
                <path fill="#ea4335" d="M272.1 107.7c39.6-.6 77.8 14.6 107 42.6l79.6-79.6C414.3 24.3 343.1-1 272.1 0 168.1 0 77 61.7 32.6 149.7l87.2 70.5c21.4-64.4 81.4-112.5 152.3-112.5z"/>
              </svg>
            </span>
            Continue with Google
          </a>
          <a
            href="/pidp/auth/github/login"
            style={{
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              border: '1px solid var(--border-input)',
              borderRadius: 8,
              padding: '0.6rem 1rem',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <span style={{ display: 'inline-flex', width: 18, height: 18 }}>
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 0.5C5.65 0.5.5 5.8.5 12.35c0 5.25 3.44 9.7 8.21 11.27.6.12.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.75-4.04-1.65-4.04-1.65-.55-1.46-1.34-1.84-1.34-1.84-1.1-.77.08-.76.08-.76 1.21.09 1.84 1.28 1.84 1.28 1.08 1.9 2.83 1.35 3.52 1.03.11-.8.42-1.35.76-1.66-2.67-.32-5.48-1.38-5.48-6.13 0-1.35.46-2.45 1.21-3.31-.12-.32-.52-1.62.11-3.38 0 0 1-.33 3.3 1.27a11.2 11.2 0 0 1 3-.42c1.02 0 2.05.14 3 .42 2.3-1.6 3.3-1.27 3.3-1.27.63 1.76.23 3.06.11 3.38.75.86 1.21 1.96 1.21 3.31 0 4.76-2.82 5.8-5.5 6.12.43.39.81 1.15.81 2.33 0 1.68-.02 3.03-.02 3.45 0 .32.22.71.83.58 4.77-1.57 8.2-6.02 8.2-11.27C23.5 5.8 18.35.5 12 .5z"
                />
              </svg>
            </span>
            Continue with GitHub
          </a>
        </div>
        <div className="muted" style={{ textAlign: 'center' }}>
          or
        </div>
        <div>
          <label className="muted" htmlFor="email">
            Email
          </label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="muted" htmlFor="pw">
            Password
          </label>
          <input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%' }} />
        </div>
        {error ? (
          <p className="muted" role="alert" style={{ color: 'var(--text-danger)', marginBottom: 0 }}>
            {error}
          </p>
        ) : null}
        <button
          type="button"
          disabled={isSubmitting || isLoading}
          onClick={handleSubmit}
        >
          {isSubmitting || isLoading ? 'Signing in...' : 'Login'}
        </button>
        <p className="muted" style={{ marginBottom: 0 }}>
          New here? <Link to="/constituent/register">Register</Link>
        </p>
      </div>
    </section>
  )
}
