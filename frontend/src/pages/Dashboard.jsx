import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  getTasks, createTask, deleteTask,
  getProjects, createProject, getMembers, addMember,
  getUsers, getTags, createTag,
  PRIORITY_CONFIG,
} from '../api'
import Navbar from '../components/Navbar'
import TaskCard from '../components/TaskCard'
import KanbanBoard from '../components/KanbanBoard'
import ToastContainer, { toast } from '../components/Toast'
import useRealtime from '../hooks/useRealtime'
import { UserPlus, X, Plus, List, Columns3 } from 'lucide-react'

const FILTERS = ['all', 'todo', 'in_progress', 'done']

export default function Dashboard() {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [members, setMembers] = useState([])
  const [tags, setTags] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('p2')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState('kanban')
  const [commentsByTask, setCommentsByTask] = useState({})
  const [expandedComments, setExpandedComments] = useState({})

  // Create-project form
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')

  // Add-member form
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberEmail, setMemberEmail] = useState('')

  // Create-tag form
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#3B82F6')

  const navigate = useNavigate()
  const initialLoad = useRef(true)

  // ── Auth guard ──────────────────────────────────────────────────
  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/login')
  }, [isLoaded, isSignedIn, navigate])

  // ── Data loaders ────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    try {
      const data = await getTasks(activeProjectId)
      setTasks(data)
    } catch { /* */ }
  }, [activeProjectId])

  const loadProjects = useCallback(async () => {
    try { setProjects(await getProjects()) } catch { /* */ }
  }, [])

  const loadUsers = useCallback(async () => {
    try { setUsers(await getUsers()) } catch { /* */ }
  }, [])

  const loadMembers = useCallback(async (pid) => {
    if (!pid) return
    try { setMembers(await getMembers(pid)) } catch { /* */ }
  }, [])

  const loadTags = useCallback(async (pid) => {
    if (!pid) return
    try { setTags(await getTags(pid)) } catch { /* */ }
  }, [])

  // ── Initial loads ───────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    loadProjects()
    loadUsers()
  }, [isLoaded, isSignedIn, loadProjects, loadUsers])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    if (initialLoad.current && projects.length > 0) {
      setActiveProjectId(projects[0].id)
      initialLoad.current = false
    }
  }, [projects])

  useEffect(() => {
    loadMembers(activeProjectId)
    loadTags(activeProjectId)
  }, [activeProjectId, loadMembers, loadTags])

  // ── Real-time SSE ───────────────────────────────────────────────
  const handleRealtimeEvent = useCallback((eventType, data) => {
    if (eventType === 'task.created' || eventType === 'task.updated') {
      loadTasks()
    } else if (eventType === 'task.deleted') {
      setTasks((prev) => prev.filter((t) => t.id !== data.id))
    } else if (eventType === 'comment.created') {
      // Refresh comments for that task
      if (expandedComments[data.task_id]) {
        import('../api').then((mod) => mod.getComments(data.task_id).then(setCommentsForTask(data.task_id)))
      }
    }
  }, [loadTasks, expandedComments])

  useRealtime(getToken, handleRealtimeEvent)

  const setCommentsForTask = (taskId) => (comments) => {
    setCommentsByTask((prev) => ({ ...prev, [taskId]: comments }))
  }

  // ── Task actions ────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setError('')
    try {
      const task = await createTask(title, null, priority, activeProjectId, assigneeId || null, dueDate || null, selectedTagIds)
      setTasks((prev) => [task, ...prev])
      setTitle(''); setDueDate(''); setSelectedTagIds([])
      toast('Task created!')
    } catch (err) { setError(err.message) }
  }

  const handleDelete = async (id) => {
    try {
      await deleteTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      toast('Task deleted', 'info')
    } catch (err) { setError(err.message) }
  }

  const handleUpdate = (updated) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  // ── Project actions ─────────────────────────────────────────────
  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!projectName.trim()) return
    try {
      const proj = await createProject(projectName, projectDesc || null)
      setProjects((prev) => [...prev, proj])
      setActiveProjectId(proj.id)
      setProjectName(''); setProjectDesc('')
      setShowCreateProject(false)
      toast('Project created!')
    } catch (err) { setError(err.message) }
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    if (!memberEmail.trim() || !activeProjectId) return
    try {
      await addMember(activeProjectId, memberEmail)
      setMemberEmail(''); setShowAddMember(false)
      loadMembers(activeProjectId)
      toast('Member added!')
    } catch (err) { setError(err.message) }
  }

  const handleCreateTag = async (e) => {
    e.preventDefault()
    if (!tagName.trim() || !activeProjectId) return
    try {
      await createTag(activeProjectId, tagName, tagColor)
      setTagName(''); setShowCreateTag(false)
      loadTags(activeProjectId)
      toast('Tag created!')
    } catch (err) { setError(err.message) }
  }

  // ── Comment toggle for kanban ───────────────────────────────────
  const handleToggleComments = async (taskId) => {
    if (!expandedComments[taskId]) {
      const { getComments } = await import('../api')
      try {
        const data = await getComments(taskId)
        setCommentsByTask((prev) => ({ ...prev, [taskId]: data }))
      } catch { /* */ }
    }
    setExpandedComments((prev) => ({ ...prev, [taskId]: !prev[taskId] }))
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter)

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Navbar viewMode={viewMode} onViewModeChange={setViewMode} />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* Project bar */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {projects.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveProjectId(null)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  !activeProjectId
                    ? 'bg-blue-600 text-white dark:bg-blue-500'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                All Tasks
              </button>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveProjectId(p.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeProjectId === p.id
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {!showCreateProject ? (
            <button onClick={() => setShowCreateProject(true)}
              className="rounded-md px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
              + Project
            </button>
          ) : (
            <form onSubmit={handleCreateProject} className="flex items-center gap-1.5 flex-wrap">
              <input type="text" placeholder="Name" required value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-7 w-28 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <input type="text" placeholder="Desc" value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                className="h-7 w-32 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <button type="submit"
                className="h-7 rounded-md bg-blue-600 text-white px-2.5 text-xs font-medium hover:bg-blue-700 transition-colors">Create</button>
              <button type="button" onClick={() => setShowCreateProject(false)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Create task form */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {activeProject ? `New Task in ${activeProject.name}` : 'New Task'}
          </h2>
          {error && (
            <div className="mb-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
            <input type="text" placeholder="What needs to be done?" required value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />

            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {Object.entries(PRIORITY_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>

            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Assign to...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
              ))}
            </select>

            <input type="date" value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />

            {/* Tag select */}
            {tags.length > 0 && (
              <select multiple value={selectedTagIds}
                onChange={(e) => setSelectedTagIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-w-[120px]">
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}

            <button type="submit"
              className="h-9 rounded-lg bg-blue-600 text-white px-4 text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">Add</button>
          </form>
        </div>

        {/* Members + Tags bar */}
        {activeProject && (
          <div className="mb-4 space-y-2">
            {/* Members */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Members:</span>
              {members.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {users.find((u) => u.id === m.user_id)?.display_name || m.user_id.slice(0, 8)}
                </span>
              ))}
              {!showAddMember ? (
                <button onClick={() => setShowAddMember(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                  <UserPlus className="w-3 h-3" /> Invite
                </button>
              ) : (
                <form onSubmit={handleAddMember} className="flex items-center gap-1">
                  <input type="email" placeholder="Email" required value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                    className="h-7 w-36 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <button type="submit"
                    className="h-7 rounded-md bg-blue-600 text-white px-2 text-xs font-medium hover:bg-blue-700 transition-colors">Send</button>
                  <button type="button" onClick={() => setShowAddMember(false)}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Tags:</span>
              {tags.map((t) => (
                <span key={t.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: t.color }}>
                  {t.name}
                </span>
              ))}
              {!showCreateTag ? (
                <button onClick={() => setShowCreateTag(true)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                  <Plus className="w-3 h-3" /> Tag
                </button>
              ) : (
                <form onSubmit={handleCreateTag} className="flex items-center gap-1">
                  <input type="text" placeholder="Tag name" required value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    className="h-7 w-24 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <input type="color" value={tagColor}
                    onChange={(e) => setTagColor(e.target.value)}
                    className="h-7 w-8 rounded border border-slate-200 dark:border-slate-700 cursor-pointer" />
                  <button type="submit"
                    className="h-7 rounded-md bg-blue-600 text-white px-2 text-xs font-medium hover:bg-blue-700 transition-colors">Add</button>
                  <button type="button" onClick={() => setShowCreateTag(false)}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="mb-4 flex gap-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}>
              {f === 'in_progress' ? 'In Progress' : f}
              {f !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({tasks.filter((t) => t.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Task display */}
        {viewMode === 'kanban' ? (
          <KanbanBoard
            tasks={tasks}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            users={users}
            commentsByTask={commentsByTask}
            onToggleComments={handleToggleComments}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filteredTasks.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                {tasks.length === 0 ? 'No tasks yet. Create one above!' : `No ${filter === 'all' ? '' : filter + ' '}tasks.`}
              </p>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard key={task.id} task={task}
                  onDelete={handleDelete} onUpdate={handleUpdate} users={users} />
              ))
            )}
          </div>
        )}
      </main>

      <ToastContainer />
    </div>
  )
}
