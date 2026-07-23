import { useState, useEffect } from 'react'
import {
  getWorkspaces, updateWorkspace, deleteWorkspace,
  getWorkspaceMembers, addWorkspaceMember, removeWorkspaceMember,
  getUsers
} from '../api'
import { X, UserPlus, Trash2 } from 'lucide-react'
import { toast } from './Toast'

export default function WorkspaceSettings({ workspaceId, onClose, onUpdate, onWorkspaceDeleted }) {
  const [workspace, setWorkspace] = useState(null)
  const [members, setMembers] = useState([])
  const [users, setUsers] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [memberEmail, setMemberEmail] = useState('')

  const load = async () => {
    try {
      const wss = await getWorkspaces()
      const ws = wss.find((w) => w.id === workspaceId)
      setWorkspace(ws)
      if (ws) {
        setName(ws.name)
        setDescription(ws.description || '')
      }
    } catch { /* */ }
    try {
      setMembers(await getWorkspaceMembers(workspaceId))
    } catch { /* */ }
    try {
      setUsers(await getUsers())
    } catch { /* */ }
  }

  useEffect(() => { load() }, [workspaceId])

  const handleUpdate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const updated = await updateWorkspace(workspaceId, { name, description: description || null })
      setWorkspace(updated)
      if (onUpdate) onUpdate(updated)
      toast('Workspace updated!')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this workspace and all its projects? This cannot be undone.')) return
    try {
      await deleteWorkspace(workspaceId)
      toast('Workspace deleted')
      onWorkspaceDeleted()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    if (!memberEmail.trim()) return
    try {
      await addWorkspaceMember(workspaceId, memberEmail)
      setMemberEmail('')
      load()
      toast('Member added!')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleRemoveMember = async (userId) => {
    try {
      await removeWorkspaceMember(workspaceId, userId)
      load()
      toast('Member removed')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/40">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Workspace Settings
          </h2>
          <button onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* General */}
          <form onSubmit={handleUpdate} className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">General</h3>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
              <input type="text" required value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
              <textarea value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit"
                className="rounded-lg bg-blue-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors">
                Save
              </button>
              <button type="button" onClick={handleDelete}
                className="rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-1.5 text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ml-auto">
                Delete Workspace
              </button>
            </div>
          </form>

          {/* Members */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Members</h3>
            <form onSubmit={handleAddMember} className="flex gap-1.5">
              <input type="email" placeholder="Email to invite" required value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <button type="submit"
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors">
                <UserPlus className="w-4 h-4" /> Invite
              </button>
            </form>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {members.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 py-2">No members yet</p>
              ) : (
                members.map((m) => {
                  const user = users.find((u) => u.id === m.user_id)
                  return (
                    <div key={m.id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-900/50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                          {user?.display_name || m.user_id.slice(0, 8)}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{m.role}</span>
                      </div>
                      {m.role !== 'admin' && (
                        <button onClick={() => handleRemoveMember(m.user_id)}
                          className="rounded p-1 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
