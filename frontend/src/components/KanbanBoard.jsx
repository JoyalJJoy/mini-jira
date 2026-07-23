import { useState, useRef } from 'react'
import { updateTask, STATUS_CONFIG, PRIORITY_CONFIG, STATUS_ORDER } from '../api'
import { Plus, X, MessageSquare, Calendar } from 'lucide-react'

const COLUMNS = [
  { key: 'todo', label: 'To Do' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'done', label: 'Done' },
]

export default function KanbanBoard({ tasks, onUpdate, onDelete, users, commentsByTask, onToggleComments }) {
  const [dragOver, setDragOver] = useState(null)
  const draggedTask = useRef(null)

  const userMap = {}
  if (users) for (const u of users) userMap[u.id] = u

  const handleDragStart = (task) => {
    draggedTask.current = task
  }

  const handleDragOver = (e, columnKey) => {
    e.preventDefault()
    setDragOver(columnKey)
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleDrop = async (e, columnKey) => {
    e.preventDefault()
    setDragOver(null)
    const task = draggedTask.current
    if (!task || task.status === columnKey) return

    try {
      const updated = await updateTask(task.id, { status: columnKey })
      if (onUpdate) onUpdate(updated)
    } catch { /* ignore */ }
  }

  const getColumnTasks = (key) => tasks.filter((t) => t.status === key)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => {
        const colTasks = getColumnTasks(col.key)
        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
            className={`rounded-xl border-2 transition-colors min-h-[200px] ${
              dragOver === col.key
                ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                : 'border-slate-200 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/30'
            }`}
          >
            {/* Column header */}
            <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  col.key === 'todo' ? 'bg-gray-400' :
                  col.key === 'in_progress' ? 'bg-blue-500' : 'bg-green-500'
                }`} />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{col.label}</span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                {colTasks.length}
              </span>
            </div>

            {/* Tasks */}
            <div className="p-2 flex flex-col gap-2">
              {colTasks.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500">
                  Drop tasks here
                </div>
              )}
              {colTasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task)}
                  className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow group"
                >
                  {/* Title + priority */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                      {task.title}
                    </p>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      (PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.p2).color
                    }`}>
                      {(PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.p2).label}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                    {/* Assignee */}
                    {task.assignee_id && (
                      <span>{userMap[task.assignee_id]?.display_name || 'Assigned'}</span>
                    )}

                    {/* Due date */}
                    {task.due_date && (
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}

                    {/* Comments */}
                    <button
                      onClick={(e) => { e.stopPropagation(); if (onToggleComments) onToggleComments(task.id) }}
                      className="inline-flex items-center gap-0.5 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-auto"
                    >
                      <MessageSquare className="w-3 h-3" />
                      {commentsByTask[task.id]?.length || 0}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
