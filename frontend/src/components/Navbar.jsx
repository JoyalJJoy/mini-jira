import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api'
import { Button } from '@/components/ui/button'

export default function Navbar() {
  const navigate = useNavigate()

  const handleLogout = () => {
    clearToken()
    navigate('/login')
  }

  return (
    <nav className="flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <span className="font-heading text-base font-semibold">Task Manager</span>
      <Button variant="outline" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </nav>
  )
}
