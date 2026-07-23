import { useClerk, useUser } from '@clerk/clerk-react'
import { CheckCircle, LogOut } from 'lucide-react'

export default function Navbar() {
  const { signOut } = useClerk()
  const { user } = useUser()

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
          <CheckCircle className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold text-slate-900">Mini Jira</span>
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <span className="text-sm text-slate-500 hidden sm:block">
            {user.fullName || user.primaryEmailAddress?.emailAddress || user.id}
          </span>
        )}
        <button
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </nav>
  )
}
