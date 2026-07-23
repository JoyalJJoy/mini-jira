import { useState, useEffect, useCallback, useRef } from 'react'
import { marked } from 'marked'
import {
  updateTask, getComments, createComment,
  getTags, getChecklists, createChecklist, updateChecklist, deleteChecklist,
  getAttachments, uploadAttachment, deleteAttachment,
  getUsers, getActivity,
  PRIORITY_CONFIG,
} from '../api'
import {
  X, Calendar, Clock, Paperclip, CheckSquare, MessageSquare,
  Activity, User, Tag, Save, Edit3, Trash2, Upload, Plus, ChevronDown,
} from 'lucide-react'
import { toast } from './Toast'

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '' }
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  try { return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}

function formatEstimate(minutes) {
  if (!minutes && minutes !== 0) return ''
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

const ACTION_LABELS = {
  created: 'created this task',
  deleted: 'deleted this task',
  updated_title: 'changed the title',
  updated_description: 'updated the description',
  updated_status: 'changed status',
  updated_priority: 'changed priority',
  updated_assignee_id: 'changed assignee',
  updated_column_id: 'moved task',
  updated_due_date: 'changed due date',
  updated_estimated_time: 'changed estimate',
  added_comment: 'added a comment',
  added_checklist: 'added checklist item',
  removed_checklist: 'removed checklist item',
  checked: 'checked off',
  unchecked: 'unchecked',
  uploaded_attachment: 'uploaded a file',
  removed_attachment: 'removed a file',
}

// ── Main Component ────────────────────────────────────────────────

export default function TaskDetails({ task, projectId, onClose, onUpdate, users }) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description || '')
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || '')
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [estimatedTime, setEstimatedTime] = useState(task.estimated_time || '')
  const [editingDesc, setEditingDesc] = useState(false)
  const [saving, setSaving] = useState(false)

  // Related data
  const [tags, setTags] = useState([])
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [checklists, setChecklists] = useState([])
  const [newChecklist, setNewChecklist] = useState('')
  const [attachments, setAttachments] = useState([])
  const [activities, setActivities] = useState([])
  const [usersMap, setUsersMap] = useState({})
  const [activeTab, setActiveTab] = useState('comments')

  const fileInputRef = useRef(null)

  // Build users map
  useEffect(() => {
    const m = {}
    if (users) for (const u of users) m[u.id] = u
    // Also try to load from API
    getUsers().then((all) => {
      for (const u of all) m[u.id] = u
      setUsersMap(m)
    }).catch(() => setUsersMap(m))
  }, [users])

  // Load related data
  const loadComments = useCallback(async () => {
    try { setComments(await getComments(task.id)) } catch { /* */ }
  }, [task.id])

  const loadTags = useCallback(async () => {
    if (!projectId) return
    try { setTags(await getTags(projectId)) } catch { /* */ }
  }, [projectId])

  const loadChecklists = useCallback(async () => {
    try { setChecklists(await getChecklists(task.id)) } catch { /* */ }
  }, [task.id])

  const loadAttachments = useCallback(async () => {
    try { setAttachments(await getAttachments(task.id)) } catch { /* */ }
  }, [task.id])

  const loadActivity = useCallback(async () => {
    try { setActivities(await getActivity(task.id)) } catch { /* */ }
  }, [task.id])

  useEffect(() => {
    loadComments()
    loadTags()
    loadChecklists()
    loadAttachments()
    loadActivity()
  }, [loadComments, loadTags, loadChecklists, loadAttachments, loadActivity])

  // Save field changes
  const saveField = async (field, value) => {
    setSaving(true)
    try {
      const updated = await updateTask(task.id, { [field]: value || null })
      if (onUpdate) onUpdate(updated)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTitleSave = async () => {
    if (!title.trim()) return
    await saveField('title', title)
  }

  const handleDescSave = async () => {
    setEditingDesc(false)
    await saveField('description', description)
  }

  // ── Comments ──────────────────────────────────────────────────
  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!newComment.trim()) return
    try {
      await createComment(task.id, newComment)
      setNewComment('')
      loadComments()
      loadActivity()
    } catch (err) { toast(err.message, 'error') }
  }

  // ── Checklists ────────────────────────────────────────────────
  const handleAddChecklist = async (e) => {
    e.preventDefault()
    if (!newChecklist.trim()) return
    try {
      await createChecklist(task.id, newChecklist)
      setNewChecklist('')
      loadChecklists()
      loadActivity()
    } catch (err) { toast(err.message, 'error') }
  }

  const handleToggleChecklist = async (item, done) => {
    try {
      await updateChecklist(task.id, item.id, { is_done: done })
      loadChecklists()
      loadActivity()
    } catch (err) { toast(err.message, 'error') }
  }

  const handleDeleteChecklist = async (itemId) => {
    try {
      await deleteChecklist(task.id, itemId)
      loadChecklists()
      loadActivity()
    } catch (err) { toast(err.message, 'error') }
  }

  // ── Attachments ───────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadAttachment(task.id, file)
      loadAttachments()
      loadActivity()
      toast('File uploaded')
    } catch (err) { toast(err.message, 'error') }
  }

  const handleDeleteAttachment = async (attId) => {
    try {
      await deleteAttachment(task.id, attId)
      loadAttachments()
      loadActivity()
    } catch (err) { toast(err.message, 'error') }
  }

  const progress = checklists.length > 0
    ? Math.round((checklists.filter((c) => c.is_done).length / checklists.length) * 100)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 h-full overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-700">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              PRIORITY_CONFIG[priority]?.color || 'bg-slate-100 text-slate-500'
            }`}>
              {PRIORITY_CONFIG[priority]?.label || priority}
            </span>
            <select value={status} onChange={(e) => { setStatus(e.target.value); saveField('status', e.target.value) }}
              className="text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-8">
          {/* ── Title ─────────────────────────────────────────── */}
          <div className="flex items-start gap-3">
            <input
              type="text" value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              className="flex-1 text-xl font-bold text-slate-900 dark:text-slate-100 bg-transparent border-none focus:outline-none focus:ring-0 p-0 placeholder-slate-300"
              placeholder="Task title"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Main content (left 2/3) ─────────────────────── */}
            <div className="lg:col-span-2 space-y-8">
              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</h3>
                  <button onClick={() => setEditingDesc(!editingDesc)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    {editingDesc ? 'Preview' : 'Edit'}
                  </button>
                </div>
                {editingDesc ? (
                  <textarea value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono resize-y"
                    placeholder="Write a description (Markdown supported)..."
                  />
                ) : (
                  <div
                    onClick={() => setEditingDesc(true)}
                    className={`prose prose-sm dark:prose-invert max-w-none min-h-[60px] rounded-lg p-3 text-sm leading-relaxed cursor-text ${
                      description ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-600'
                    }`}
                    dangerouslySetInnerHTML={{ __html: description ? marked.parse(description, { breaks: true }) : 'Click to add description...' }}
                  />
                )}
                {editingDesc && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleDescSave} disabled={saving}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                      <Save className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => setEditingDesc(false)}
                      className="rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                  </div>
                )}
              </div>

              {/* ── Activity / Comments tabs ──────────────────── */}
              <div>
                <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 mb-4">
                  {[
                    { key: 'comments', icon: MessageSquare, label: 'Comments' },
                    { key: 'activity', icon: Activity, label: 'Activity' },
                  ].map(({ key, icon: Icon, label }) => (
                    <button key={key} onClick={() => setActiveTab(key)}
                      className={`flex items-center gap-1.5 pb-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
                        activeTab === key
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}>
                      <Icon className="w-3.5 h-3.5" /> {label}
                    </button>
                  ))}
                </div>

                {/* Comments */}
                {activeTab === 'comments' && (
                  <div className="space-y-3">
                    {comments.length === 0 && (
                      <p className="text-xs text-slate-400 py-2">No comments yet</p>
                    )}
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                          {usersMap[c.author_id]?.display_name?.charAt(0)?.toUpperCase() || c.author_id.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {usersMap[c.author_id]?.display_name || c.author_id.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-slate-400">{timeAgo(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
                      <input type="text" placeholder="Write a comment..." value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                      <button type="submit" disabled={!newComment.trim()}
                        className="h-9 rounded-lg bg-blue-600 text-white px-3 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">Send</button>
                    </form>
                  </div>
                )}

                {/* Activity */}
                {activeTab === 'activity' && (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {activities.length === 0 ? (
                      <p className="text-xs text-slate-400 py-2">No activity yet</p>
                    ) : (
                      activities.map((a) => (
                        <div key={a.id} className="flex gap-2.5 text-sm">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">
                            {usersMap[a.user_id]?.display_name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{usersMap[a.user_id]?.display_name || a.user_id.slice(0, 8)}</span>{' '}
                              {ACTION_LABELS[a.action] || a.action.replace(/_/g, ' ')}{' '}
                              {a.old_value && a.new_value && a.old_value !== a.new_value && (
                                <span className="text-slate-400">
                                  from{' '}<span className="line-through">{a.old_value}</span>{' '}to{' '}<span className="font-medium">{a.new_value}</span>
                                </span>
                              )}
                              {a.new_value && !a.old_value && (
                                <span className="text-slate-400">— <span className="font-medium text-slate-600 dark:text-slate-300">{a.new_value}</span></span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400 ml-1">{timeAgo(a.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* ── Checklists ────────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" /> Checklist
                    {checklists.length > 0 && (
                      <span className="text-xs font-normal text-slate-400 ml-1">
                        ({checklists.filter(c => c.is_done).length}/{checklists.length})
                      </span>
                    )}
                  </h3>
                </div>
                {checklists.length > 0 && (
                  <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mb-3 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                )}
                <div className="space-y-1">
                  {checklists.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <input type="checkbox" checked={item.is_done}
                        onChange={(e) => handleToggleChecklist(item, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500/20 cursor-pointer" />
                      <span className={`flex-1 text-sm ${item.is_done ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {item.title}
                      </span>
                      <button onClick={() => handleDeleteChecklist(item.id)}
                        className="p-0.5 rounded text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddChecklist} className="flex gap-2 mt-2">
                  <input type="text" placeholder="Add checklist item..." value={newChecklist}
                    onChange={(e) => setNewChecklist(e.target.value)}
                    className="flex-1 h-8 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <button type="submit" disabled={!newChecklist.trim()}
                    className="h-8 rounded-md bg-blue-600 text-white px-2.5 text-xs font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">Add</button>
                </form>
              </div>

              {/* ── Attachments ───────────────────────────────── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> Attachments
                    {attachments.length > 0 && <span className="text-xs font-normal text-slate-400">({attachments.length})</span>}
                  </h3>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    <Upload className="w-3 h-3" /> Upload
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
                </div>
                {attachments.length === 0 ? (
                  <p className="text-xs text-slate-400">No attachments</p>
                ) : (
                  <div className="space-y-1.5">
                    {attachments.map((att) => (
                      <div key={att.id} className="flex items-center gap-2.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                        <div className="w-8 h-8 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-medium shrink-0">
                          {att.file_name?.split('.').pop()?.toUpperCase()?.slice(0, 4) || 'FILE'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{att.file_name}</p>
                          <p className="text-[10px] text-slate-400">
                            {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB` : ''}
                            {att.author_id && ` · ${usersMap[att.author_id]?.display_name || ''}`}
                          </p>
                        </div>
                        <button onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Sidebar (right 1/3) ─────────────────────────── */}
            <div className="space-y-5">
              {/* Assignee */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" /> Assignee
                </label>
                <select value={assigneeId} onChange={(e) => { setAssigneeId(e.target.value); saveField('assignee_id', e.target.value) }}
                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  <option value="">Unassigned</option>
                  {Object.values(usersMap).map((u) => (
                    <option key={u.id} value={u.id}>{u.display_name || u.email || u.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>

              {/* Reporter */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <User className="w-3 h-3" /> Reporter
                </label>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  {usersMap[task.owner_id]?.display_name || task.owner_id.slice(0, 8)}
                </p>
              </div>

              {/* Due date */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Due Date
                </label>
                <input type="date" value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); saveField('due_date', e.target.value || null) }}
                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>

              {/* Estimate */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Estimated Time
                </label>
                <div className="flex gap-1.5 items-center">
                  <input type="number" min="0" placeholder="Minutes" value={estimatedTime}
                    onChange={(e) => setEstimatedTime(e.target.value)}
                    className="flex-1 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                  <button onClick={() => saveField('estimated_time', estimatedTime ? parseInt(estimatedTime) : null)}
                    className="h-8 rounded-lg bg-blue-600 text-white px-2.5 text-xs font-medium hover:bg-blue-700 transition-colors">Set</button>
                </div>
                {task.estimated_time && (
                  <p className="text-[10px] text-slate-400 mt-1">{formatEstimate(task.estimated_time)}</p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Priority
                </label>
                <select value={priority} onChange={(e) => { setPriority(e.target.value); saveField('priority', e.target.value) }}
                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  {Object.entries(PRIORITY_CONFIG).map(([k, c]) => (
                    <option key={k} value={k}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Labels / Tags */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Labels
                </label>
                <div className="flex flex-wrap gap-1">
                  {tags.length === 0 ? (
                    <p className="text-xs text-slate-400">No labels</p>
                  ) : (
                    tags.map((t) => (
                      <span key={t.id} className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: t.color }}>
                        {t.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Created / Updated meta ─────────────────────────── */}
          <div className="text-[10px] text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-4 flex gap-4">
            <span>Created {formatDateTime(task.created_at)}</span>
            <span>Updated {formatDateTime(task.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
