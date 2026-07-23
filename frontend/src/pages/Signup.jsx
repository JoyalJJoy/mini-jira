import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SignUp, useAuth } from '@clerk/clerk-react'
import { CheckCircle } from 'lucide-react'

export default function Signup() {
  const { isLoaded, isSignedIn } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate('/dashboard', { replace: true })
  }, [isLoaded, isSignedIn, navigate])

  if (!isLoaded || isSignedIn) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">Mini Jira</span>
        </div>

        <SignUp
          afterSignUpUrl="/dashboard"
          appearance={{
            elements: {
              card: "shadow-none border border-slate-200 rounded-2xl",
              headerTitle: "text-xl font-semibold text-slate-900",
              headerSubtitle: "text-sm text-slate-500",
              formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-sm",
              formFieldInput: "bg-slate-50 border-slate-200 rounded-lg text-sm",
              footerActionLink: "text-blue-600 hover:text-blue-700",
            },
          }}
        />
      </div>
    </div>
  )
}
