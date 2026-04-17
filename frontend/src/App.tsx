// Project code — root layout: sidebar + page routes
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom'
import Sidebar from '@/components/Sidebar'
import DashboardPage from '@/pages/DashboardPage'
import DeploymentDetailPage from '@/pages/DeploymentDetailPage'

import { AuthProvider } from './context/AuthProvider'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './components/ProtectedRoute'
import NotFoundPage from './pages/NotFoundPage'

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="page-content">
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Home Page (Landing page with stats) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            {/* These children will render inside the <main> or <Outlet /> of Layout */}
            <Route index element={<DashboardPage />} />
            <Route path="/deployments/:name" element={<DeploymentDetailPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
