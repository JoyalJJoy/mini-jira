import { useState, useEffect, useRef } from 'react'
import { getWorkspaces, createWorkspace } from '../api'
import { CheckCircle, ChevronDown, Plus, Settings, LogOut } from 'lucide-react'
import { toast } from './Toast'

export default function WorkspaceSwitcher({ activeWorkspaceId, onWorkspaceChange, onOpenSettings }) {
  const [workspaces, setWorkspaces] = useState([])
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [wsName, setWsName] = useState('')
  const [wsDesc, setWsDesc] = useState('')
  const dropdownRef = useRef(null)

  const load = async () => {
    try {
      const data = await getWorkspaces()
      setWorkspaces(data)
    } catch { /* */ }
  }

  useEffect(() => { load() }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const active = workspaces.find((w) => w.id === activeWorkspaceId)

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!wsName.trim()) return
    try {
      const ws = await createWorkspace(wsName, wsDesc || null)
      setWorkspaces((prev) => [...prev, ws])
      onWorkspaceChange(ws.id)
      setWsName('')
      setWsDesc('')
      setShowCreate(false)
      setOpen(false)
      toast('Workspace created!')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  if (workspaces.length === 0 && !showCreate) {
    return (
      <button
        onClick={() => setShowCreate(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Create Workspace
      </button>
    )
  }

  if (showCreate) {
    return (
      <form onSubmit={handleCreate} className="flex items-center gap-1.5">
        <input
          type="text"
          placeholder="Workspace name"
          required
          value={wsName}
          onChange={(e) => setWsName(e.target.value)}
          className="h-7 w-36 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:text-slate-200"
        />
        <button
          type="submit"
          className="h-7 rounded-md bg-blue-600 text-white px-2.5 text-xs font-medium hover:bg-blue-700 transition-colors"
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => { setShowCreate(false); setWsName(''); setWsDesc('') }}
          className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          ✕
        </button>
      </form>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-w-0 max-w-[160px]"
      >
        <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="truncate">{active?.name || 'Select Workspace'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50 py-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Workspaces
          </div>
          {workspaces.map((w) => (
            <button
              key={w.id}
              onClick={() => { onWorkspaceChange(w.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                w.id === activeWorkspaceId
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{w.name}</span>
            </button>
          ))}
          <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
            <button
              onClick={() => { setShowCreate(true); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Workspace
            </button>
            {active && onOpenSettings && (
              <button
                onClick={() => { onOpenSettings(); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors"
              >
                <Settings className="w-3.5 h-3.5" />
                Workspace Settings
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
