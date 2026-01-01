import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './index.css'
import { AppProviders } from './app/AppProviders'
import { createServices } from './composition/createServices'
import { createAppRouter } from './ui/router/createAppRouter'

const services = createServices()
const router = createAppRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
