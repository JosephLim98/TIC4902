// Project code — root layout: sidebar + page routes
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import DashboardPage from '@/pages/DashboardPage'
import DeploymentDetailPage from '@/pages/DeploymentDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="page-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/deployments/:name" element={<DeploymentDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
