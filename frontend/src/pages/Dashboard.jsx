import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import {
  getTasks, createTask, deleteTask,
  getProjects, createProject, getMembers, addMember,
  getUsers,
  PRIORITY_CONFIG,
} from '../api'
import Navbar from '../components/Navbar'
import TaskCard from '../components/TaskCard'
import { UserPlus, X } from 'lucide-react'

const FILTERS = ['all', 'todo', 'in_progress', 'done']

export default function Dashboard() {
  const { isLoaded, isSignedIn } = useAuth()
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
  const [members, setMembers] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('p2')
  const [assigneeId, setAssigneeId] = useState('')
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  // Create-project form
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')

  // Add-member form
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberEmail, setMemberEmail] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/login')
  }, [isLoaded, isSignedIn, navigate])

  const loadTasks = useCallback(async () => {
    try {
      const data = await getTasks(activeProjectId)
      setTasks(data)
    } catch { /* handled by caller */ }
  }, [activeProjectId])

  const loadProjects = useCallback(async () => {
    try {
      const data = await getProjects()
      setProjects(data)
    } catch { /* not critical */ }
  }, [])

  const loadUsers = useCallback(async () => {
    try {
      const data = await getUsers()
      setUsers(data)
    } catch { /* not critical */ }
  }, [])

  const loadMembers = useCallback(async (projectId) => {
    if (!projectId) return
    try {
      const data = await getMembers(projectId)
      setMembers(data)
    } catch { /* not critical */ }
  }, [])

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    loadProjects()
    loadUsers()
  }, [isLoaded, isSignedIn, loadProjects, loadUsers])

  useEffect(() => { loadTasks() }, [loadTasks])

  // Auto-select first project only on initial load (not when user clicks "All Tasks")
  const initialLoad = useRef(true)
  useEffect(() => {
    if (initialLoad.current && projects.length > 0) {
      setActiveProjectId(projects[0].id)
      initialLoad.current = false
    }
  }, [projects])

  useEffect(() => {
    loadMembers(activeProjectId)
  }, [activeProjectId, loadMembers])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    setError('')
    try {
      const task = await createTask(title, null, priority, activeProjectId, assigneeId || null)
      setTasks((prev) => [task, ...prev])
      setTitle('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteTask(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleUpdate = (updated) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!projectName.trim()) return
    try {
      const proj = await createProject(projectName, projectDesc || null)
      setProjects((prev) => [...prev, proj])
      setActiveProjectId(proj.id)
      setProjectName('')
      setProjectDesc('')
      setShowCreateProject(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAddMember = async (e) => {
    e.preventDefault()
    if (!memberEmail.trim() || !activeProjectId) return
    try {
      await addMember(activeProjectId, memberEmail)
      setMemberEmail('')
      setShowAddMember(false)
      loadMembers(activeProjectId)
    } catch (err) {
      setError(err.message)
    }
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter)

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* Project bar */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {projects.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveProjectId(null)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  !activeProjectId
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {!showCreateProject ? (
            <button
              onClick={() => setShowCreateProject(true)}
              className="rounded-md px-3 py-1.5 text-xs font-medium bg-white text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
            >
              + Project
            </button>
          ) : (
            <form onSubmit={handleCreateProject} className="flex items-center gap-1.5">
              <input type="text" placeholder="Project name" required value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="h-7 w-36 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <input type="text" placeholder="Description" value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                className="h-7 w-40 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <button type="submit"
                className="h-7 rounded-md bg-blue-600 text-white px-2.5 text-xs font-medium hover:bg-blue-700 transition-colors">Create</button>
              <button type="button" onClick={() => setShowCreateProject(false)}
                className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Create task form */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">
            {activeProject ? `New Task in ${activeProject.name}` : 'New Task'}
          </h2>
          {error && (
            <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
          <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
            <input type="text" placeholder="What needs to be done?" required value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            <select value={priority} onChange={(e) => setPriority(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {Object.entries(PRIORITY_CONFIG).map(([k, c]) => (
                <option key={k} value={k}>{c.label}</option>
              ))}
            </select>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="">Assign to...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
              ))}
            </select>
            <button type="submit"
              className="h-9 rounded-lg bg-blue-600 text-white px-4 text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">Add</button>
          </form>
        </div>

        {/* Members bar for active project */}
        {activeProject && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Members:</span>
            <div className="flex flex-wrap gap-1">
              {members.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {users.find((u) => u.id === m.user_id)?.display_name || m.user_id.slice(0, 8)}
                </span>
              ))}
            </div>
            {!showAddMember ? (
              <button
                onClick={() => setShowAddMember(true)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <UserPlus className="w-3 h-3" /> Invite
              </button>
            ) : (
              <form onSubmit={handleAddMember} className="flex items-center gap-1">
                <input type="email" placeholder="Email" required value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  className="h-7 w-40 rounded-md border border-slate-200 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                <button type="submit"
                  className="h-7 rounded-md bg-blue-600 text-white px-2 text-xs font-medium hover:bg-blue-700 transition-colors">Send</button>
                <button type="button" onClick={() => setShowAddMember(false)}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </form>
            )}
          </div>
        )}

        {/* Status filter tabs */}
        <div className="mb-4 flex gap-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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

        {/* Task list */}
        <div className="flex flex-col gap-2">
          {filteredTasks.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">
              {tasks.length === 0 ? 'No tasks yet. Create one above!' : `No ${filter === 'all' ? '' : filter + ' '}tasks.`}
            </p>
          ) : (
            filteredTasks.map((task) => (
              <TaskCard key={task.id} task={task}
                onDelete={handleDelete} onUpdate={handleUpdate} users={users} />
            ))
          )}
        </div>
      </main>
    </div>
  )
}
