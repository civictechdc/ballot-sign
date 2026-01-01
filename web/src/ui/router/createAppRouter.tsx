import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from '../shell/AppLayout'
import { LandingPage } from '../views/LandingPage'
import { InitiativeDetailPage } from '../views/InitiativeDetailPage'
import { InitiativeSignPage } from '../views/InitiativeSignPage'
import { ConstituentAccountPage } from '../views/constituent/ConstituentAccountPage'
import { ConstituentProfilePage } from '../views/constituent/ConstituentProfilePage'
import { ConstituentLoginPage } from '../views/constituent/ConstituentLoginPage'
import { ConstituentRegisterPage } from '../views/constituent/ConstituentRegisterPage'
import { CampaignLoginPage } from '../views/campaign/CampaignLoginPage'
import { CampaignRegisterPage } from '../views/campaign/CampaignRegisterPage'
import { CampaignInitiativesPage } from '../views/campaign/CampaignInitiativesPage'
import { CampaignInitiativeEditorPage } from '../views/campaign/CampaignInitiativeEditorPage'
import { CampaignProfilePage } from '../views/campaign/CampaignProfilePage'
import { CampaignAccountPage } from '../views/campaign/CampaignAccountPage'
import { PublicCampaignManagerPage } from '../views/public/PublicCampaignManagerPage'
import { NotFoundPage } from '../views/NotFoundPage'
import { AboutPage } from '../views/AboutPage'
import { DashboardPage } from '../dashboard/DashboardPage'

export function createAppRouter() {
  return createBrowserRouter([
    {
      element: <AppLayout />,
      children: [
        { path: '/', element: <LandingPage /> },
        { path: '/initiatives/:slug', element: <InitiativeDetailPage /> },
        { path: '/initiatives/:slug/sign', element: <InitiativeSignPage /> },

        { path: '/about', element: <AboutPage /> },

        // Constituent
        { path: '/constituent/register', element: <ConstituentRegisterPage /> },
        { path: '/constituent/login', element: <ConstituentLoginPage /> },
        { path: '/constituent/dashboard', element: <DashboardPage /> },
        { path: '/constituent/profile', element: <ConstituentProfilePage /> },
        { path: '/constituent/account', element: <ConstituentAccountPage /> },

        // Campaign manager (demo pages: static but navigable)
        { path: '/campaign/register', element: <CampaignRegisterPage /> },
        { path: '/campaign/login', element: <CampaignLoginPage /> },
        { path: '/campaign/initiatives', element: <CampaignInitiativesPage /> },
        { path: '/campaign/initiatives/new', element: <CampaignInitiativeEditorPage /> },
        { path: '/campaign/profile', element: <CampaignProfilePage /> },
        { path: '/campaign/account', element: <CampaignAccountPage /> },

        // Public profile
        { path: '/campaign-managers/:handle', element: <PublicCampaignManagerPage /> },

        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ])
}
