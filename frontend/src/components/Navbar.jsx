import { useClerk, useUser } from '@clerk/clerk-react'
import { CheckCircle, LogOut, Layout, Columns3, LayoutDashboard } from 'lucide-react'
import DarkModeToggle from './DarkModeToggle'
import WorkspaceSwitcher from './WorkspaceSwitcher'

export default function Navbar({
  viewMode,
  onViewModeChange,
  activeWorkspaceId,
  onWorkspaceChange,
  onOpenWorkspaceSettings,
}) {
  const { signOut } = useClerk()
  const { user } = useUser()

  return (
    <nav className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
          <CheckCircle className="w-4 h-4 text-white" />
        </div>
        <span className="text-base font-semibold text-slate-900 dark:text-slate-100 hidden sm:block shrink-0">
          Mini Jira
        </span>
        <WorkspaceSwitcher
          activeWorkspaceId={activeWorkspaceId}
          onWorkspaceChange={onWorkspaceChange}
          onOpenSettings={onOpenWorkspaceSettings}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* View toggle — cycles kanban → list → dashboard */}
        {onViewModeChange && (
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button onClick={() => onViewModeChange('kanban')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Board view">
              <Columns3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onViewModeChange('list')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors border-x border-slate-200 dark:border-slate-700 ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="List view">
              <Layout className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onViewModeChange('dashboard')}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Dashboard view">
              <LayoutDashboard className="w-3.5 h-3.5" />
            </button>
          </div>
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
