import { useState, useEffect, useCallback } from 'react'
import { X, UserPlus, Trash2, Archive, RotateCcw } from 'lucide-react'
import { getMembers, addMember, removeMember, updateProject, deleteProject } from '../api'
import { toast } from './Toast'

const PROJECT_ICONS = [
  '📋', '🚀', '🎨', '🌐', '📊', '⚙️', '📦', '🛠️',
  '🏗️', '📝', '💻', '🎯', '📈', '🤖', '🧩', '🗂️',
  '🎮', '🏆', '🔧', '📱', '🖥️', '☁️', '🔒', '⚡',
]

const PROJECT_COLORS = [
  '#3B82F6', '#2563EB', '#1D4ED8', // blue
  '#8B5CF6', '#7C3AED', '#6D28D9', // violet
  '#EC4899', '#DB2777', '#BE185D', // pink
  '#EF4444', '#DC2626', '#B91C1C', // red
  '#F59E0B', '#D97706', '#B45309', // amber
  '#10B981', '#059669', '#047857', // emerald
  '#06B6D4', '#0891B2', '#0E7490', // cyan
  '#64748B', '#475569', '#334155', // slate
]

export default function ProjectSettings({ project, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState('general')
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description || '')
  const [icon, setIcon] = useState(project.icon || '📋')
  const [color, setColor] = useState(project.color || '#3B82F6')
  const [isArchived, setIsArchived] = useState(project.is_archived || false)
  const [saving, setSaving] = useState(false)

  // Members
  const [members, setMembers] = useState([])
  const [memberEmail, setMemberEmail] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState(false)

  const loadMembers = useCallback(async () => {
    try {
      setMembers(await getMembers(project.id))
    } catch { /* */ }
  }, [project.id])

  useEffect(() => { loadMembers() }, [loadMembers])

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateProject(project.id, { name, description, icon, color })
      onUpdate(updated)
      toast('Project updated')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleArchiveToggle = async () => {
    try {
      const updated = await updateProject(project.id, { is_archived: !isArchived })
      setIsArchived(!isArchived)
      onUpdate(updated)
      toast(isArchived ? 'Project restored' : 'Project archived')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    try {
      await deleteProject(project.id)
      toast('Project deleted')
      onDelete(project.id)
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    if (!memberEmail.trim()) return
    setAddingMember(true)
    try {
      await addMember(project.id, memberEmail)
      setMemberEmail('')
      loadMembers()
      toast('Member added')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setAddingMember(false)
    }
  }

  const handleRemoveMember = async (userId) => {
    try {
      await removeMember(project.id, userId)
      loadMembers()
      toast('Member removed')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-xl">{icon}</span>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{project.name}</h2>
              <p className="text-xs text-slate-400">Project settings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 px-5">
          {['general', 'members'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors -mb-px capitalize ${
                tab === t
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {tab === 'general' && (
            <>
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
                <input type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
                <input type="text" value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_ICONS.map((ic) => (
                    <button key={ic} onClick={() => setIcon(ic)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        icon === ic
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-110'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        color === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-800 scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving || !name.trim()}
                  className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save changes'}
                </button>
              </div>

              {/* Divider */}
              <hr className="border-slate-200 dark:border-slate-700" />

              {/* Archive / Delete */}
              <div className="space-y-2">
                <button onClick={handleArchiveToggle}
                  className="flex items-center gap-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  {isArchived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                  {isArchived ? 'Restore project' : 'Archive project'}
                </button>
                <button onClick={handleDelete}
                  className={`flex items-center gap-2 w-full rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                    confirmDelete
                      ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}>
                  <Trash2 className="w-4 h-4" />
                  {confirmDelete ? 'Click again to confirm delete' : 'Delete project'}
                </button>
              </div>
            </>
          )}

          {tab === 'members' && (
            <>
              {/* Add member */}
              <form onSubmit={handleAddMember} className="flex gap-2">
                <input type="email" placeholder="Email to invite..." required value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                <button type="submit" disabled={addingMember}
                  className="h-9 rounded-lg bg-blue-600 text-white px-3 text-sm font-medium hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50">
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </button>
              </form>

              {/* Member list */}
              <div className="space-y-1">
                {members.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">No members yet</p>
                ) : (
                  members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center text-xs font-bold text-white">
                          {m.user_id.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">{m.user_id}</span>
                          <span className="text-xs text-slate-400 ml-2">({m.role})</span>
                        </div>
                      </div>
                      {m.role !== 'owner' && (
                        <button onClick={() => handleRemoveMember(m.user_id)}
                          className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all">
                          <X className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
