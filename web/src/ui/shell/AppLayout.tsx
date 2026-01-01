import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Header />
      <main style={{ padding: '40px 24px' }}>
        <div className="container">
        <Outlet />
        </div>
      </main>
    </div>
  )
}
