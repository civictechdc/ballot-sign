import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Footer } from './Footer'

export function AppLayout() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ padding: '40px 24px' }}>
        <div className="container">
        <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}
