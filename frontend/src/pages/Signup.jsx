import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signup } from '../api'
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

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await signup(email, password, displayName || null)
      navigate('/login')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card size="sm" className="w-full max-w-sm">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Sign Up</CardTitle>
            <CardDescription>Create your account to get started.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display name (optional)</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
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
              Sign Up
            </Button>
            <p className="text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="underline underline-offset-2 hover:text-primary">
                Login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
