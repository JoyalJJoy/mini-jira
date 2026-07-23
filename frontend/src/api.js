// In dev (Vite proxy) this resolves to /api/v1 → localhost:8000
// In production set VITE_API_URL to your Render backend URL
const API = import.meta.env.VITE_API_URL || '/api/v1'

// Token provider — defaults to localStorage, overridable for Clerk etc.
let _getToken = () => localStorage.getItem('access_token')

export function setTokenProvider(fn) {
  _getToken = fn
}

export function setToken(token) {
  localStorage.setItem('access_token', token)
}

export function clearToken() {
  localStorage.removeItem('access_token')
}

async function request(path, options = {}) {
  const token = await _getToken()
  const headers = { ...options.headers }
  if (options.body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${API}${path}`, { ...options, headers })
  } catch (err) {
    throw new Error(`Network error: ${err.message}`)
  }

  let text
  try {
    text = await res.text()
  } catch {
    throw new Error(`Failed to read response body (status ${res.status})`)
  }

  if (!text) {
    throw new Error(`Empty response from server (status ${res.status})`)
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(
      `Invalid JSON response (status ${res.status}): ${text.slice(0, 200)}`,
    )
  }

  if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
  return data
}

// Auth
export const signup = (email, password, display_name) =>
  request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, display_name }) })

export const login = (email, password) =>
  request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })

export const getMe = () => request('/auth/me')

// Users (for assignee picker)
export const getUsers = () => request('/users/')

// Tasks
export const getTasks = (projectId) =>
  request(`/tasks/${projectId ? `?project_id=${projectId}` : ''}`)

export const createTask = (title, description, priority, projectId, assigneeId) =>
  request('/tasks/', { method: 'POST', body: JSON.stringify({ title, description, priority, project_id: projectId, assignee_id: assigneeId }) })

export const updateTask = (taskId, data) =>
  request(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) })

export const deleteTask = (taskId) =>
  request(`/tasks/${taskId}`, { method: 'DELETE' })

// Projects
export const getProjects = () => request('/projects/')

export const createProject = (name, description) =>
  request('/projects/', { method: 'POST', body: JSON.stringify({ name, description }) })

export const deleteProject = (projectId) =>
  request(`/projects/${projectId}`, { method: 'DELETE' })

// Project Members
export const getMembers = (projectId) =>
  request(`/projects/${projectId}/members`)

export const addMember = (projectId, email) =>
  request(`/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify({ email }) })

export const removeMember = (projectId, userId) =>
  request(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' })

// Comments
export const getComments = (taskId) => request(`/tasks/${taskId}/comments/`)

export const createComment = (taskId, content) =>
  request(`/tasks/${taskId}/comments/`, { method: 'POST', body: JSON.stringify({ content }) })

export const deleteComment = (taskId, commentId) =>
  request(`/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' })

// Display helpers
export const STATUS_CONFIG = {
  todo:        { label: 'Todo',        color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  done:        { label: 'Done',        color: 'bg-green-100 text-green-700' },
}

export const PRIORITY_CONFIG = {
  p0: { label: 'P0', color: 'bg-red-100 text-red-700' },
  p1: { label: 'P1', color: 'bg-orange-100 text-orange-700' },
  p2: { label: 'P2', color: 'bg-blue-100 text-blue-700' },
  p3: { label: 'P3', color: 'bg-gray-100 text-gray-500' },
}

export const STATUS_ORDER = ['todo', 'in_progress', 'done']
