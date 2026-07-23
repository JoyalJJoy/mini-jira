import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react'
import { setTokenProvider } from './api'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'

function ProtectedRoute({ children }) {
  return <SignedIn>{children}</SignedIn>
}

function PublicRoute({ children }) {
  return <SignedOut>{children}</SignedOut>
}

export default function App() {
  const { getToken } = useAuth()

  // Feed Clerk's token provider into our API module
  useEffect(() => {
    setTokenProvider(() => getToken())
  }, [getToken])

  return (
    <div className="app">
      <Routes>
        {/* Public routes — only shown when signed out */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={
          <PublicRoute><Login /></PublicRoute>
        } />
        <Route path="/signup" element={
          <PublicRoute><Signup /></PublicRoute>
        } />

        {/* Protected routes — only shown when signed in */}
        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
