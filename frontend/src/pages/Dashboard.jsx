import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useUser } from '@clerk/clerk-react'
import {
  getTasks, createTask, deleteTask,
  getProjects, createProject, updateProject, getMembers, addMember,
  getUsers, getTags, createTag,
  getWorkspaces, createWorkspace,
  getSprints, getSavedFilters, createSavedFilter, deleteSavedFilter,
  PRIORITY_CONFIG, ISSUE_TYPE_CONFIG, ISSUE_TYPE_ORDER,
} from '../api'
import Navbar from '../components/Navbar'
import FilterPanel from '../components/FilterPanel'
import DashboardWidgets from '../components/DashboardWidgets'
import TaskCard from '../components/TaskCard'
import KanbanBoard from '../components/KanbanBoard'
import SprintManager from '../components/SprintManager'
import TaskDetails from '../components/TaskDetails'
import { toast } from '../components/Toast'
import WorkspaceSettings from '../components/WorkspaceSettings'
import ProjectSettings from '../components/ProjectSettings'
import useRealtime from '../hooks/useRealtime'
import { X, Plus, Settings, LayoutList } from 'lucide-react'

const PROJECT_ICONS = ['📋', '🚀', '🎨', '🌐', '📊', '⚙️', '📦', '🛠️', '🏗️', '📝', '💻', '🎯', '📈', '🤖', '🧩', '🗂️', '🎮', '🏆']
const PROJECT_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#64748B']

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
  const [issueType, setIssueType] = useState('task')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState([])
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const [creatingTask, setCreatingTask] = useState(false)
  const [viewMode, setViewMode] = useState('kanban')
  const [commentsByTask, setCommentsByTask] = useState({})
  const [expandedComments, setExpandedComments] = useState({})

  // Workspace
  const [workspaces, setWorkspaces] = useState([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(
    () => localStorage.getItem('activeWorkspaceId') || null
  )
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [wsName, setWsName] = useState('')

  // Create-project modal
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [projectIcon, setProjectIcon] = useState('📋')
  const [projectColor, setProjectColor] = useState('#3B82F6')
  const [creatingProject, setCreatingProject] = useState(false)

  // Project settings modal
  const [settingsProject, setSettingsProject] = useState(null)

  // Task details panel
  const [detailsTask, setDetailsTask] = useState(null)

  // Sprint panel
  const [showSprints, setShowSprints] = useState(false)

  // Search & Filters
  const [filters, setFilters] = useState({
    search_q: '',
    status: '',
    assignee_id: '',
    priority: '',
    tag_ids: [],
    sprint_id: '',
    due_date_from: '',
    due_date_to: '',
    issue_type: '',
  })
  const [sprints, setSprints] = useState([])
  const [savedFilters, setSavedFilters] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  // Create-tag form
  const [showCreateTag, setShowCreateTag] = useState(false)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('#3B82F6')

  const navigate = useNavigate()
  const initialLoad = useRef(true)
  const previousWorkspaceRef = useRef(null)

  // ── Auth guard ──────────────────────────────────────────────────
  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/login')
  }, [isLoaded, isSignedIn, navigate])

  // ── Data loaders ────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    try {
      // Build filter params — include activeProjectId, but skip empty fields
      const activeFilters = {}
      for (const [k, v] of Object.entries(filters)) {
        if (v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)) {
          activeFilters[k] = v
        }
      }
      const data = await getTasks(activeProjectId, activeFilters)
      setTasks(data)
    } catch { /* */ }
  }, [activeProjectId, filters])

  const loadWorkspaces = useCallback(async () => {
    try {
      const data = await getWorkspaces()
      console.log('Workspaces loaded:', data.length)
      setWorkspaces(data)
      // Auto-select workspace if user has one and none selected
      if (data.length > 0) {
        if (!activeWorkspaceId || !data.find((w) => w.id === activeWorkspaceId)) {
          // Persist selection
          const target = data[0].id
          setActiveWorkspaceId(target)
          localStorage.setItem('activeWorkspaceId', target)
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err)
    }
  }, [activeWorkspaceId])

  // Track workspace changes to reset project auto-select
  useEffect(() => {
    if (previousWorkspaceRef.current && previousWorkspaceRef.current !== activeWorkspaceId) {
      initialLoad.current = true
    }
    previousWorkspaceRef.current = activeWorkspaceId
  }, [activeWorkspaceId])

  const loadProjects = useCallback(async () => {
    try { setProjects(await getProjects(activeWorkspaceId, true)) } catch (err) {
      console.error('Failed to load projects:', err)
    }
  }, [activeWorkspaceId])

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

  const loadSprints = useCallback(async (pid) => {
    if (!pid) { setSprints([]); return }
    try { setSprints(await getSprints(pid)) } catch { /* */ }
  }, [])

  const loadSavedFilters = useCallback(async () => {
    try { setSavedFilters(await getSavedFilters(activeWorkspaceId, activeProjectId)) } catch { /* */ }
  }, [activeWorkspaceId, activeProjectId])

  // ── Initial loads ───────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return
    loadWorkspaces()
    loadUsers()
  }, [isLoaded, isSignedIn, loadWorkspaces, loadUsers])

  useEffect(() => { loadProjects() }, [loadProjects])
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
    loadSprints(activeProjectId)
  }, [activeProjectId, loadMembers, loadTags, loadSprints])

  useEffect(() => { loadSavedFilters() }, [loadSavedFilters])

  // ── Real-time SSE ───────────────────────────────────────────────
  const currentUserIdRef = useRef(null)
  const { user } = useUser()
  useEffect(() => {
    if (user?.id) currentUserIdRef.current = user.id
  }, [user])

  const handleRealtimeEvent = useCallback((eventType, data) => {
    // Skip events triggered by the current user — state is already updated locally
    if (data.actor_id && data.actor_id === currentUserIdRef.current) return

    if (eventType === 'task.created' || eventType === 'task.updated') {
      loadTasks()
    } else if (eventType === 'task.deleted') {
      setTasks((prev) => prev.filter((t) => t.id !== data.id))
    } else if (eventType === 'comment.created') {
      // Refresh comments for that task
      if (data.task_id && expandedComments[data.task_id]) {
        import('../api').then((mod) =>
          mod.getComments(data.task_id).then(setCommentsForTask(data.task_id))
        ).catch(() => {})
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
    if (!title.trim() || creatingTask) return
    setError('')
    setCreatingTask(true)
    try {
      const task = await createTask(title, null, priority, activeProjectId, assigneeId || null, dueDate || null, selectedTagIds, issueType)
      setTasks((prev) => [task, ...prev])
      setTitle(''); setDueDate(''); setSelectedTagIds([]); setIssueType('task')
      toast('Task created!')
    } catch (err) { setError(err.message) }
    finally { setCreatingTask(false) }
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

  // ── Workspace actions ───────────────────────────────────────────
  const [wsCreating, setWsCreating] = useState(false)
  const [wsError, setWsError] = useState('')

  const handleCreateWorkspace = async (e) => {
    e.preventDefault()
    if (!wsName.trim()) return
    setWsCreating(true)
    setWsError('')
    try {
      const ws = await createWorkspace(wsName, null)
      setWorkspaces((prev) => [...prev, ws])
      setActiveWorkspaceId(ws.id)
      localStorage.setItem('activeWorkspaceId', ws.id)
      setActiveProjectId(null)
      setProjects([])
      setTasks([])
      setWsName('')
      setShowCreateWorkspace(false)
      toast('Workspace created!')
    } catch (err) {
      setWsError(err.message)
    } finally {
      setWsCreating(false)
    }
  }

  const handleWorkspaceChange = (wsId) => {
    setActiveWorkspaceId(wsId)
    localStorage.setItem('activeWorkspaceId', wsId)
    setActiveProjectId(null)
    setTasks([])
    setProjects([])
  }

  const handleUpdateWorkspace = (updated) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
  }

  const handleWorkspaceDeleted = () => {
    localStorage.removeItem('activeWorkspaceId')
    setActiveWorkspaceId(null)
    setShowWorkspaceSettings(false)
    loadWorkspaces()
    setProjects([])
    setTasks([])
  }

  // ── Project actions ─────────────────────────────────────────────
  const handleCreateProject = async (e) => {
    e.preventDefault()
    if (!projectName.trim()) return
    setCreatingProject(true)
    try {
      const proj = await createProject(projectName, projectDesc || null, activeWorkspaceId, projectIcon, projectColor)
      setProjects((prev) => [...prev, proj])
      setActiveProjectId(proj.id)
      setProjectName(''); setProjectDesc(''); setProjectIcon('📋'); setProjectColor('#3B82F6')
      setShowCreateProject(false)
      toast('Project created!')
    } catch (err) { setError(err.message) }
    finally { setCreatingProject(false) }
  }

  const handleUpdateProject = (updated) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
    setSettingsProject((prev) => (prev?.id === updated.id ? updated : prev))
    loadTasks()
  }

  const handleDeleteProject = (projectId) => {
    setProjects((prev) => {
      const updated = prev.filter((p) => p.id !== projectId)
      if (activeProjectId === projectId) {
        setActiveProjectId(updated.length > 0 ? updated[0].id : null)
      }
      return updated
    })
    loadTasks()
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

  // ── Filter handlers ────────────────────────────────────────────
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const handleClearFilters = () => {
    setFilters({
      search_q: '',
      status: '',
      assignee_id: '',
      priority: '',
      tag_ids: [],
      sprint_id: '',
      due_date_from: '',
      due_date_to: '',
      issue_type: '',
    })
  }

  const handleSaveFilter = async (name, criteria) => {
    const sf = await createSavedFilter(name, criteria, activeWorkspaceId, activeProjectId)
    setSavedFilters((prev) => [sf, ...prev])
  }

  const handleLoadFilter = (savedFilter) => {
    if (savedFilter?.criteria) {
      setFilters({
        search_q: '',
        status: savedFilter.criteria.status || '',
        assignee_id: savedFilter.criteria.assignee_id || '',
        priority: savedFilter.criteria.priority || '',
        tag_ids: savedFilter.criteria.tag_ids || [],
        sprint_id: savedFilter.criteria.sprint_id || '',
        due_date_from: savedFilter.criteria.due_date_from || '',
        due_date_to: savedFilter.criteria.due_date_to || '',
        issue_type: savedFilter.criteria.issue_type || '',
      })
      toast('Filter applied')
    }
  }

  const handleDeleteFilter = async (filterId) => {
    await deleteSavedFilter(filterId)
    setSavedFilters((prev) => prev.filter((f) => f.id !== filterId))
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

  // No workspaces — prompt to create one
  if (workspaces.length === 0 && !showCreateWorkspace) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mx-auto">
            <Plus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Create Your First Workspace</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Workspaces organize your projects. Start by creating one.
          </p>
          <button onClick={() => setShowCreateWorkspace(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Create Workspace
          </button>
        </div>
      </div>
    )
  }

  // Show create workspace form inline
  if (showCreateWorkspace) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <form onSubmit={handleCreateWorkspace} className="w-full max-w-sm space-y-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">New Workspace</h2>
          {wsError && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              {wsError}
            </div>
          )}
          <input type="text" placeholder="Workspace name" required value={wsName}
            onChange={(e) => setWsName(e.target.value)}
            disabled={wsCreating}
            className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50" />
          <div className="flex gap-2">
            <button type="submit" disabled={wsCreating}
              className="rounded-lg bg-blue-600 text-white px-4 py-1.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {wsCreating ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : 'Create'}
            </button>
            <button type="button" onClick={() => { setShowCreateWorkspace(false); setWsError(''); }}
              className="rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 px-4 py-1.5 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <Navbar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeWorkspaceId={activeWorkspaceId}
        onWorkspaceChange={handleWorkspaceChange}
        onOpenWorkspaceSettings={() => setShowWorkspaceSettings(true)}
      />

      {showWorkspaceSettings && (
        <WorkspaceSettings
          workspaceId={activeWorkspaceId}
          onClose={() => setShowWorkspaceSettings(false)}
          onUpdate={handleUpdateWorkspace}
          onWorkspaceDeleted={handleWorkspaceDeleted}
        />
      )}

      {settingsProject && (
        <ProjectSettings
          project={settingsProject}
          onClose={() => setSettingsProject(null)}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
        />
      )}

      {detailsTask && (
        <TaskDetails
          task={detailsTask}
          projectId={activeProjectId}
          onClose={() => setDetailsTask(null)}
          onUpdate={(updated) => { handleUpdate(updated); setDetailsTask(updated) }}
          users={users}
        />
      )}

      {/* Create project modal */}
      {showCreateProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">New Project</h2>
              <button onClick={() => { setShowCreateProject(false); setProjectName(''); setProjectDesc(''); setProjectIcon('📋'); setProjectColor('#3B82F6') }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateProject} className="p-5 space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-400">{error}</div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name</label>
                <input type="text" placeholder="Project name" required value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
                <input type="text" placeholder="Brief description..." value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Icon</label>
                <div className="flex flex-wrap gap-1.5">
                  {PROJECT_ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setProjectIcon(ic)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        projectIcon === ic
                          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-110'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Color</label>
                <div className="flex flex-wrap gap-2">
                  {PROJECT_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setProjectColor(c)}
                      className={`w-7 h-7 rounded-full transition-all ${
                        projectColor === c ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-800 scale-110' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={creatingProject || !projectName.trim()}
                  className="flex-1 h-9 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {creatingProject ? 'Creating...' : 'Create Project'}
                </button>
                <button type="button" onClick={() => { setShowCreateProject(false); setProjectName(''); setProjectDesc(''); setProjectIcon('📋'); setProjectColor('#3B82F6') }}
                  className="px-4 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <div key={p.id} className="relative group">
                  <button
                    onClick={() => setActiveProjectId(p.id)}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      activeProjectId === p.id
                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    } ${p.is_archived ? 'opacity-50' : ''}`}
                  >
                    <span className="text-xs leading-none">{p.icon || '📋'}</span>
                    <span>{p.name}</span>
                    {p.is_archived && <span className="text-[10px] opacity-60">(archived)</span>}
                  </button>
                  <button
                    onClick={() => setSettingsProject(p)}
                    className={`absolute -right-1.5 -top-1.5 p-0.5 rounded-full transition-all opacity-0 group-hover:opacity-100 hover:scale-110 ${
                      activeProjectId === p.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-white dark:bg-slate-700 text-slate-400 border border-slate-200 dark:border-slate-600'
                    }`}
                    title="Project settings"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setShowCreateProject(true)}
            className="rounded-md px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
            + Project
          </button>
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

            <select value={issueType} onChange={(e) => setIssueType(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs font-medium dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              {ISSUE_TYPE_ORDER.map((k) => (
                <option key={k} value={k}>{ISSUE_TYPE_CONFIG[k].icon} {ISSUE_TYPE_CONFIG[k].label}</option>
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

            <button type="submit" disabled={creatingTask}
              className="h-9 rounded-lg bg-blue-600 text-white px-4 text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
              {creatingTask ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Adding...
                </span>
              ) : 'Add'}
            </button>
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
                  {/* Try to find user name; fall back to id prefix */}
                  {(() => {
                    const u = users.find((u) => u.id === m.user_id)
                    return u?.display_name || m.user_id.slice(0, 8)
                  })()}
                </span>
              ))}
              <button onClick={() => setSettingsProject(activeProject)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                <Settings className="w-3 h-3" /> Manage
              </button>
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

        {/* Search & Filters */}
        <div className="mb-4">
          <FilterPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            users={users}
            tags={tags}
            sprints={sprints}
            savedFilters={savedFilters}
            onSaveFilter={handleSaveFilter}
            onLoadFilter={handleLoadFilter}
            onDeleteFilter={handleDeleteFilter}
          />
        </div>

        {/* Status filter tabs + sprint toggle */}
        <div className="mb-4 flex items-center gap-2">
          <div className="flex gap-1 flex-1">
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
          {activeProjectId && (
            <button onClick={() => setShowSprints((s) => !s)}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                showSprints
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}>
              <LayoutList className="w-3.5 h-3.5" />
              Sprints
            </button>
          )}
        </div>

        {/* Task display */}
        <div className={`${showSprints && activeProjectId ? 'grid grid-cols-[320px_1fr] gap-4' : ''}`}>
          {/* Sprint side panel */}
          {showSprints && activeProjectId && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              <SprintManager
                projectId={activeProjectId}
                tasks={tasks}
                onUpdate={handleUpdate}
                users={users}
              />
            </div>
          )}

          {viewMode === 'dashboard' ? (
            <DashboardWidgets projectId={activeProjectId} onTaskClick={setDetailsTask} />
          ) : viewMode === 'kanban' ? (
            <KanbanBoard
              projectId={activeProjectId}
              tasks={tasks}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              users={users}
              commentsByTask={commentsByTask}
              onToggleComments={handleToggleComments}
              onTaskClick={setDetailsTask}
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
        </div>
      </main>
    </div>
  )
}
