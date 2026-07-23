import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { setTokenProvider } from './api'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'

export default function App() {
  const { getToken } = useAuth()

  // Feed Clerk's token provider into our API module
  useEffect(() => {
    setTokenProvider(() => getToken())
  }, [getToken])

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </div>
  )
}
