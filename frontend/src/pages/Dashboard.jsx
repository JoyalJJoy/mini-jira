import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getTasks, createTask, deleteTask,
  getProjects, createProject,
  getUsers,
  clearToken, PRIORITY_CONFIG,
} from '../api'
import Navbar from '../components/Navbar'
import TaskCard from '../components/TaskCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const FILTERS = ['all', 'todo', 'in_progress', 'done']

export default function Dashboard() {
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [users, setUsers] = useState([])
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

  const navigate = useNavigate()

  const loadTasks = useCallback(async () => {
    try {
      const data = await getTasks(activeProjectId)
      setTasks(data)
    } catch {
      clearToken()
      navigate('/login')
    }
  }, [activeProjectId, navigate])

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

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return navigate('/login')
    loadProjects()
    loadUsers()
  }, [loadProjects, loadUsers, navigate])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(projects[0].id)
    }
  }, [projects, activeProjectId])

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

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter)

  return (
    <div className="min-h-screen bg-background">
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
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {!showCreateProject ? (
            <Button variant="outline" size="xs" onClick={() => setShowCreateProject(true)}>
              + Project
            </Button>
          ) : (
            <form onSubmit={handleCreateProject} className="flex items-center gap-1.5">
              <Input type="text" placeholder="Project name" required value={projectName}
                onChange={(e) => setProjectName(e.target.value)} className="h-7 w-36 text-xs" />
              <Input type="text" placeholder="Description (optional)" value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)} className="h-7 w-40 text-xs" />
              <Button type="submit" size="xs">Create</Button>
              <Button type="button" variant="ghost" size="xs"
                onClick={() => setShowCreateProject(false)}>✕</Button>
            </form>
          )}
        </div>

        {/* Create task form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{activeProject ? `New Task in ${activeProject.name}` : 'New Task'}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleCreate} className="flex flex-wrap gap-2">
              <Input type="text" placeholder="What needs to be done?" required value={title}
                onChange={(e) => setTitle(e.target.value)} className="min-w-0 flex-1" />
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs font-medium">
                {Object.entries(PRIORITY_CONFIG).map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </select>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs font-medium">
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                ))}
              </select>
              <Button type="submit">Add</Button>
            </form>
          </CardContent>
        </Card>

        {/* Status filter tabs */}
        <div className="mb-4 flex gap-1">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
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
            <p className="py-12 text-center text-sm text-muted-foreground">
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
