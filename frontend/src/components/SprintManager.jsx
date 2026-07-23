import { useState, useEffect, useCallback } from 'react'
import {
  getSprints, createSprint, startSprint, completeSprint, deleteSprint,
  addTaskToSprint, removeTaskFromSprint, updateTask, PRIORITY_CONFIG,
} from '../api'
import {
  Plus, X, Play, CheckCircle2, Archive, ArrowRight, Calendar, User,
  ChevronDown,
} from 'lucide-react'
import { toast } from './Toast'

function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return '' }
}

export default function SprintManager({ projectId, tasks, onUpdate, users }) {
  const [sprints, setSprints] = useState([])
  const [activeSprint, setActiveSprint] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [creating, setCreating] = useState(false)
  const [expandedSprint, setExpandedSprint] = useState(null)

  const userMap = {}
  if (users) for (const u of users) userMap[u.id] = u

  const loadSprints = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await getSprints(projectId)
      setSprints(data)
      const active = data.find((s) => s.status === 'active')
      setActiveSprint(active || null)
    } catch { /* */ }
  }, [projectId])

  useEffect(() => { loadSprints() }, [loadSprints])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      await createSprint(projectId, name, goal || null)
      setName(''); setGoal(''); setShowCreate(false)
      loadSprints()
      toast('Sprint created')
    } catch (err) { toast(err.message, 'error') }
    finally { setCreating(false) }
  }

  const handleStart = async (sprintId) => {
    try {
      await startSprint(sprintId)
      loadSprints()
      toast('Sprint started!')
    } catch (err) { toast(err.message, 'error') }
  }

  const handleComplete = async (sprintId) => {
    try {
      await completeSprint(sprintId)
      loadSprints()
      toast('Sprint completed!')
    } catch (err) { toast(err.message, 'error') }
  }

  const handleDelete = async (sprintId) => {
    if (!window.confirm('Delete this sprint? Tasks will be moved to backlog.')) return
    try {
      await deleteSprint(sprintId)
      loadSprints()
      toast('Sprint deleted')
    } catch (err) { toast(err.message, 'error') }
  }

  const handleAddToSprint = async (taskId, sprintId) => {
    try {
      await addTaskToSprint(sprintId, taskId)
      if (onUpdate) {
        const t = tasks.find((t) => t.id === taskId)
        if (t) onUpdate({ ...t, sprint_id: sprintId })
      }
      toast('Added to sprint')
    } catch (err) { toast(err.message, 'error') }
  }

  const handleRemoveFromSprint = async (taskId, sprintId) => {
    try {
      await removeTaskFromSprint(sprintId, taskId)
      if (onUpdate) {
        const t = tasks.find((t) => t.id === taskId)
        if (t) onUpdate({ ...t, sprint_id: null })
      }
    } catch (err) { toast(err.message, 'error') }
  }

  // Backlog: tasks not assigned to any sprint
  const backlogTasks = tasks.filter((t) => !t.sprint_id)

  // Sprint task counts
  const getSprintTasks = (sprintId) => tasks.filter((t) => t.sprint_id === sprintId)
  const getDoneCount = (sprintId) => getSprintTasks(sprintId).filter((t) => t.status === 'done').length
  const getTotalCount = (sprintId) => getSprintTasks(sprintId).length

  if (!projectId) return null

  return (
    <div className="space-y-4">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Sprints</h2>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Sprint
        </button>
      </div>

      {/* ── Active sprint — always shown ────────────────────── */}
      {activeSprint && (
        <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeSprint.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {getDoneCount(activeSprint.id)}/{getTotalCount(activeSprint.id)} done
              </span>
              <button onClick={() => handleComplete(activeSprint.id)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Complete</button>
            </div>
          </div>
          {activeSprint.goal && (
            <div className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400 italic border-b border-blue-100 dark:border-blue-800">
              Goal: {activeSprint.goal}
            </div>
          )}
          <div className="px-4 py-2 space-y-1 max-h-60 overflow-y-auto">
            {getSprintTasks(activeSprint.id).length === 0 ? (
              <p className="text-xs text-slate-400 py-2 text-center">No tasks in this sprint. Drag from backlog below.</p>
            ) : (
              getSprintTasks(activeSprint.id).map((task) => (
                <div key={task.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700 group">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    task.status === 'done' ? 'bg-green-500' :
                    task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
                  }`} />
                  <span className={`flex-1 text-xs ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {task.title}
                  </span>
                  <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${
                    (PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.p2).color
                  }`}>
                    {(PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.p2).label}
                  </span>
                  <button onClick={() => handleRemoveFromSprint(task.id, activeSprint.id)}
                    className="p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Backlog ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Backlog</span>
          </div>
          <span className="text-xs text-slate-400">{backlogTasks.length} tasks</span>
        </div>
        <div className="px-4 py-2 space-y-1 max-h-96 overflow-y-auto">
          {backlogTasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-3 text-center">All tasks are assigned to sprints</p>
          ) : (
            backlogTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-800 px-3 py-2 border border-slate-200 dark:border-slate-700 group">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  task.status === 'done' ? 'bg-green-500' :
                  task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
                }`} />
                <span className="flex-1 text-xs text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                {task.assignee_id && (
                  <span className="text-[10px] text-slate-400 truncate max-w-[60px]">
                    {userMap[task.assignee_id]?.display_name || ''}
                  </span>
                )}
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value) handleAddToSprint(task.id, e.target.value)
                    e.target.value = ''
                  }}
                  className="text-[10px] rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-all focus:opacity-100 focus:outline-none"
                >
                  <option value="">Move to sprint...</option>
                  {sprints.filter(s => s.status !== 'completed').map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Other sprints ───────────────────────────────────── */}
      {sprints.filter(s => s.id !== activeSprint?.id).length > 0 && (
        <div className="space-y-1">
          {sprints.filter(s => s.id !== activeSprint?.id).map((sprint) => {
            const isExpanded = expandedSprint === sprint.id
            return (
              <div key={sprint.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <button onClick={() => setExpandedSprint(isExpanded ? null : sprint.id)}
                  className="w-full px-4 py-2 flex items-center justify-between text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      sprint.status === 'completed' ? 'bg-green-500' :
                      sprint.status === 'active' ? 'bg-blue-500' : 'bg-slate-300'
                    }`} />
                    <span className="text-slate-700 dark:text-slate-300">{sprint.name}</span>
                    <span className="text-[10px] text-slate-400 capitalize">({sprint.status})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">
                      {getDoneCount(sprint.id)}/{getTotalCount(sprint.id)}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 space-y-2">
                    {sprint.goal && (
                      <p className="text-xs text-slate-500 italic">Goal: {sprint.goal}</p>
                    )}
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {getSprintTasks(sprint.id).map((task) => (
                        <div key={task.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            task.status === 'done' ? 'bg-green-500' : 'bg-slate-300'
                          }`} />
                          <span className={`flex-1 ${task.status === 'done' ? 'line-through' : ''}`}>{task.title}</span>
                        </div>
                      ))}
                      {getSprintTasks(sprint.id).length === 0 && (
                        <p className="text-xs text-slate-400">No tasks</p>
                      )}
                    </div>
                    {sprint.status === 'planned' && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => handleStart(sprint.id)}
                          className="inline-flex items-center gap-1 rounded bg-blue-600 text-white px-2.5 py-1 text-[10px] font-medium hover:bg-blue-700 transition-colors">
                          <Play className="w-3 h-3" /> Start
                        </button>
                        <button onClick={() => handleDelete(sprint.id)}
                          className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Delete</button>
                      </div>
                    )}
                    {sprint.status === 'completed' && (
                      <button onClick={() => handleDelete(sprint.id)}
                        className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">Delete</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create form ─────────────────────────────────────── */}
      {showCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">New Sprint</h3>
          <input type="text" placeholder="Sprint name" required value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <input type="text" placeholder="Goal (optional)" value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <div className="flex gap-2">
            <button type="submit" disabled={creating || !name.trim()}
              className="rounded-lg bg-blue-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 px-4 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* ── No sprints yet ──────────────────────────────────── */}
      {sprints.length === 0 && !showCreate && (
        <div className="text-center py-8">
          <p className="text-sm text-slate-400 mb-3">No sprints yet. Create one to plan your work.</p>
        </div>
      )}
    </div>
  )
}
