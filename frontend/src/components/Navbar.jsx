import { useClerk, useUser } from '@clerk/clerk-react'
import { CheckCircle, LogOut, Layout, Columns3 } from 'lucide-react'
import DarkModeToggle from './DarkModeToggle'

export default function Navbar({ viewMode, onViewModeChange }) {
  const { signOut } = useClerk()
  const { user } = useUser()

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
          <CheckCircle className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100">Mini Jira</span>
      </div>

      <div className="flex items-center gap-2">
        {/* View toggle */}
        {onViewModeChange && (
          <button
            onClick={() => onViewModeChange(viewMode === 'kanban' ? 'list' : 'kanban')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={viewMode === 'kanban' ? 'List view' : 'Kanban view'}
          >
            {viewMode === 'kanban' ? <Layout className="w-3.5 h-3.5" /> : <Columns3 className="w-3.5 h-3.5" />}
            {viewMode === 'kanban' ? 'List' : 'Board'}
          </button>
        )}

        <DarkModeToggle />

        {user && (
          <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block mr-1">
            {user.fullName || user.primaryEmailAddress?.emailAddress || ''}
          </span>
        )}
        <button
          onClick={() => signOut()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </nav>
  )
}
