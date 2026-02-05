import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../app/AppProviders'

export function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { completeOAuthLogin } = useAuth()

  useEffect(() => {
    const hash = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash
    const params = new URLSearchParams(hash || location.search)
    const token = params.get('token')
    if (token) {
      completeOAuthLogin(token)
      navigate('/', { replace: true })
      return
    }
    navigate('/constituent/login', { replace: true })
  }, [completeOAuthLogin, location.hash, location.search, navigate])

  return null
}
