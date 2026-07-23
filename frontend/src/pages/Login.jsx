import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login, setToken } from '../api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const data = await login(email, password)
      setToken(data.access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card size="sm" className="w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>Welcome back! Sign in to your account.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full">
              Login
            </Button>
            <p className="text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="underline underline-offset-2 hover:text-primary">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
