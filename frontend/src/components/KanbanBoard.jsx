import { useState, useRef, useEffect, useCallback } from 'react'
import {
  updateTask, PRIORITY_CONFIG,
  getBoards, createBoard, updateBoard, deleteBoard,
  getColumns, createColumn, updateColumn, deleteColumn,
} from '../api'
import { Plus, X, MessageSquare, Calendar, GripVertical, ChevronDown, Trash2 } from 'lucide-react'
import { toast } from './Toast'

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString() } catch { return '' }
}

// ── Main ──────────────────────────────────────────────────────────

export default function KanbanBoard({
  projectId, tasks, onUpdate, onDelete,
  users, commentsByTask, onToggleComments,
}) {
  const [boards, setBoards] = useState([])
  const [activeBoardId, setActiveBoardId] = useState(null)
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)

  // Drag state
  const [dragOverCol, setDragOverCol] = useState(null)
  const [dragOverColIdx, setDragOverColIdx] = useState(null) // for column reorder
  const draggedTask = useRef(null)
  const draggedColIdx = useRef(null)

  // Inline editing
  const [editingColId, setEditingColId] = useState(null)
  const [editingColName, setEditingColName] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColName, setNewColName] = useState('')
  const [newColWip, setNewColWip] = useState('')

  // New board
  const [showNewBoard, setShowNewBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  // ── Load boards ──────────────────────────────────────────────────
  const loadBoards = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await getBoards(projectId)
      setBoards(data)
      if (data.length > 0 && !data.find((b) => b.id === activeBoardId)) {
        setActiveBoardId(data[0].id)
      }
    } catch { /* */ }
    setLoading(false)
  }, [projectId, activeBoardId])

  useEffect(() => { loadBoards() }, [loadBoards])

  // ── Load columns when board changes ───────────────────────────────
  const loadColumns = useCallback(async () => {
    if (!activeBoardId) { setColumns([]); return }
    try {
      setColumns(await getColumns(activeBoardId))
    } catch { /* */ }
  }, [activeBoardId])

  useEffect(() => { loadColumns() }, [loadColumns])

  // ── Ensure tasks with no column_id get assigned ──────────────────
  useEffect(() => {
    if (columns.length === 0 || !activeBoardId) return
    const colMap = {}
    for (const c of columns) colMap[c.id] = c

    // For tasks with no column_id, assign based on status using column name matching
    for (const task of tasks) {
      if (!task.column_id) {
        // Find matching column by status name
        const match = columns.find(
          (c) => c.name.toLowerCase().includes(task.status.replace('_', ' ')) ||
                 task.status.toLowerCase().includes(c.name.toLowerCase().slice(0, 3))
        )
        if (match) {
          updateTask(task.id, { column_id: match.id }).catch(() => {})
        }
      }
    }
  }, [columns, activeBoardId, tasks])

  // ── User map ──────────────────────────────────────────────────────
  const userMap = {}
  if (users) for (const u of users) userMap[u.id] = u

  // ── Get tasks for a column ────────────────────────────────────────
  const getColumnTasks = (colId) => {
    return tasks
      .filter((t) => t.column_id === colId)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
  }

  // If no columns yet, fall back to status-based grouping
  const hasColumns = columns.length > 0
  const fallbackColumns = hasColumns ? columns : [
    { id: 'todo', name: 'To Do', position: 0, wip_limit: null },
    { id: 'in_progress', name: 'In Progress', position: 1, wip_limit: null },
    { id: 'done', name: 'Done', position: 2, wip_limit: null },
  ]
  const sortedCols = [...fallbackColumns].sort((a, b) => a.position - b.position)

  // ── Task drag & drop ─────────────────────────────────────────────
  const handleTaskDragStart = (task) => {
    draggedTask.current = task
  }

  const handleTaskDrop = async (e, colId) => {
    e.preventDefault()
    setDragOverCol(null)
    const task = draggedTask.current
    if (!task || task.column_id === colId) return

    try {
      const updated = await updateTask(task.id, { column_id: colId })
      if (onUpdate) onUpdate(updated)
    } catch { /* */ }
  }

  // ── Column drag & drop ──────────────────────────────────────────
  const handleColDragStart = (idx) => {
    draggedColIdx.current = idx
  }

  const handleColDragOver = (e, idx) => {
    e.preventDefault()
    setDragOverColIdx(idx)
  }

  const handleColDrop = async (e, targetIdx) => {
    e.preventDefault()
    setDragOverColIdx(null)
    const fromIdx = draggedColIdx.current
    if (fromIdx === null || fromIdx === targetIdx) return
    if (!activeBoardId) return

    // Reorder positions
    const reordered = [...sortedCols]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    const updates = reordered.map((col, i) => ({
      ...col,
      position: i,
    }))
    setColumns(updates)

    // Persist in order
    for (const col of updates) {
      try {
        await updateColumn(activeBoardId, col.id, { position: col.position })
      } catch { /* */ }
    }
  }

  // ── Add column ───────────────────────────────────────────────────
  const handleAddColumn = async (e) => {
    e.preventDefault()
    if (!newColName.trim() || !activeBoardId) return
    try {
      const col = await createColumn(activeBoardId, newColName, newColWip ? parseInt(newColWip) : null)
      setColumns((prev) => [...prev, col])
      setNewColName(''); setNewColWip(''); setAddingColumn(false)
      toast('Column added')
    } catch (err) { toast(err.message, 'error') }
  }

  // ── Rename column ────────────────────────────────────────────────
  const handleRenameStart = (col) => {
    setEditingColId(col.id)
    setEditingColName(col.name)
  }

  const handleRenameDone = async (colId) => {
    if (!editingColName.trim() || !activeBoardId) { setEditingColId(null); return }
    try {
      const updated = await updateColumn(activeBoardId, colId, { name: editingColName })
      setColumns((prev) => prev.map((c) => (c.id === colId ? updated : c)))
      toast('Column renamed')
    } catch (err) { toast(err.message, 'error') }
    setEditingColId(null)
  }

  // ── Delete column ────────────────────────────────────────────────
  const handleDeleteColumn = async (colId) => {
    const colTasks = tasks.filter((t) => t.column_id === colId)
    if (colTasks.length > 0) {
      if (!window.confirm(`Delete "${sortedCols.find(c => c.id === colId)?.name}"? ${colTasks.length} task(s) will be moved to the first column.`)) return
      // Move tasks to first column
      const firstCol = sortedCols.find(c => c.id !== colId)
      if (firstCol) {
        for (const task of colTasks) {
          try {
            const updated = await updateTask(task.id, { column_id: firstCol.id })
            if (onUpdate) onUpdate(updated)
          } catch { /* */ }
        }
      }
    }
    try {
      await deleteColumn(activeBoardId, colId)
      setColumns((prev) => prev.filter((c) => c.id !== colId))
      toast('Column deleted')
    } catch (err) { toast(err.message, 'error') }
  }

  // ── Create board ─────────────────────────────────────────────────
  const handleCreateBoard = async (e) => {
    e.preventDefault()
    if (!newBoardName.trim() || !projectId) return
    try {
      const board = await createBoard(newBoardName, projectId)
      setBoards((prev) => [...prev, board])
      setActiveBoardId(board.id)
      setNewBoardName(''); setShowNewBoard(false)
      toast('Board created')
    } catch (err) { toast(err.message, 'error') }
  }

  // ── Delete board ─────────────────────────────────────────────────
  const handleDeleteBoard = async () => {
    if (!activeBoardId) return
    const board = boards.find(b => b.id === activeBoardId)
    if (!window.confirm(`Delete board "${board?.name}"? All columns and task positions will be removed.`)) return
    try {
      await deleteBoard(activeBoardId)
      setBoards((prev) => prev.filter((b) => b.id !== activeBoardId))
      setActiveBoardId(null)
      toast('Board deleted')
    } catch (err) { toast(err.message, 'error') }
  }

  // ── Board rename ─────────────────────────────────────────────────
  const [renamingBoardId, setRenamingBoardId] = useState(null)
  const [renamingBoardName, setRenamingBoardName] = useState('')

  const handleBoardRenameStart = () => {
    const board = boards.find(b => b.id === activeBoardId)
    if (!board) return
    setRenamingBoardId(board.id)
    setRenamingBoardName(board.name)
  }

  const handleBoardRenameDone = async () => {
    if (!renamingBoardName.trim() || !renamingBoardId) { setRenamingBoardId(null); return }
    try {
      const updated = await updateBoard(renamingBoardId, { name: renamingBoardName })
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      toast('Board renamed')
    } catch (err) { toast(err.message, 'error') }
    setRenamingBoardId(null)
  }

  if (loading) {
    return <div className="text-center py-8 text-sm text-slate-400">Loading boards...</div>
  }

  if (!projectId) {
    return <div className="text-center py-8 text-sm text-slate-400">Select a project to view the board</div>
  }

  return (
    <div>
      {/* ── Board selector ───────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {boards.map((b) => (
          <div key={b.id} className="relative group">
            <button
              onClick={() => setActiveBoardId(b.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeBoardId === b.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              {b.name}
            </button>
          </div>
        ))}
        <button onClick={() => setShowNewBoard(true)}
          className="rounded-md px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
          + Board
        </button>
      </div>

      {/* ── Board actions (when a board is active) ────────────── */}
      {activeBoardId && boards.length > 0 && (() => {
        const board = boards.find(b => b.id === activeBoardId)
        return (
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            {renamingBoardId === board?.id ? (
              <input type="text" value={renamingBoardName} autoFocus
                onChange={(e) => setRenamingBoardName(e.target.value)}
                onBlur={handleBoardRenameDone}
                onKeyDown={(e) => e.key === 'Enter' && handleBoardRenameDone()}
                className="h-7 w-40 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            ) : (
              <button onClick={handleBoardRenameStart}
                className="hover:text-blue-600 transition-colors">
                Rename
              </button>
            )}
            <span className="text-slate-300">|</span>
            <button onClick={handleDeleteBoard}
              className="hover:text-red-500 transition-colors">
              Delete
            </button>
          </div>
        )
      })()}

      {/* ── New board form ────────────────────────────────────── */}
      {showNewBoard && (
        <form onSubmit={handleCreateBoard} className="mb-4 flex items-center gap-1.5">
          <input type="text" placeholder="Board name" required value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            className="h-7 w-44 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          <button type="submit"
            className="h-7 rounded bg-blue-600 text-white px-2.5 text-xs font-medium hover:bg-blue-700 transition-colors">Create</button>
          <button type="button" onClick={() => setShowNewBoard(false)}
            className="h-7 w-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {/* ── Board columns ─────────────────────────────────────── */}
      {activeBoardId && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 200 }}>
            {sortedCols.map((col, colIdx) => {
              const colTasks = hasColumns ? getColumnTasks(col.id) : tasks.filter((t) => t.status === col.id)
              const isOverLimit = col.wip_limit != null && colTasks.length > col.wip_limit
              const isDragOver = dragOverCol === col.id

              return (
                <div
                  key={col.id}
                  className="flex-shrink-0 w-72"
                  onDragOver={(e) => { if (!hasColumns) return; e.preventDefault(); setDragOverCol(col.id) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={(e) => handleTaskDrop(e, col.id)}
                >
                  {/* Column header */}
                  <div
                    draggable={hasColumns}
                    onDragStart={() => handleColDragStart(colIdx)}
                    onDragOver={(e) => handleColDragOver(e, colIdx)}
                    onDrop={(e) => handleColDrop(e, colIdx)}
                    className={`rounded-t-xl border-2 border-b-0 px-3 py-2 flex items-center justify-between transition-colors ${
                      isDragOver
                        ? 'border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                        : dragOverColIdx === colIdx
                          ? 'border-violet-400 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/20'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'
                    } ${hasColumns ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {hasColumns && <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                      {editingColId === col.id ? (
                        <input type="text" value={editingColName} autoFocus
                          onChange={(e) => setEditingColName(e.target.value)}
                          onBlur={() => handleRenameDone(col.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRenameDone(col.id)}
                          className="h-6 w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                      ) : (
                        <button onClick={() => handleRenameStart(col)}
                          className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[120px]">
                          {col.name}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        isOverLimit
                          ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                      }`}>
                        {colTasks.length}
                        {col.wip_limit != null && <span className="opacity-60">/{col.wip_limit}</span>}
                      </span>
                      {hasColumns && (
                        <button onClick={() => handleDeleteColumn(col.id)}
                          className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task list */}
                  <div
                    className={`rounded-b-xl border-2 border-t-0 p-2 flex flex-col gap-2 min-h-[120px] transition-colors ${
                      isDragOver
                        ? 'border-blue-400 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-900/10'
                        : isOverLimit
                          ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/5'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    {colTasks.length === 0 && (
                      <div className="flex-1 flex items-center justify-center">
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">Drop tasks here</span>
                      </div>
                    )}
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleTaskDragStart(task)}
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
                          {task.assignee_id && (
                            <span className="truncate max-w-[80px]">{userMap[task.assignee_id]?.display_name || 'Assigned'}</span>
                          )}
                          {task.due_date && (
                            <span className="inline-flex items-center gap-0.5 shrink-0">
                              <Calendar className="w-3 h-3" />
                              {formatDate(task.due_date)}
                            </span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); if (onToggleComments) onToggleComments(task.id) }}
                            className="inline-flex items-center gap-0.5 hover:text-slate-600 dark:hover:text-slate-300 transition-colors ml-auto">
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

            {/* Add column button */}
            {hasColumns && !addingColumn && (
              <button onClick={() => setAddingColumn(true)}
                className="flex-shrink-0 w-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-blue-500 hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                <Plus className="w-5 h-5" />
              </button>
            )}

            {hasColumns && addingColumn && (
              <form onSubmit={handleAddColumn}
                className="flex-shrink-0 w-64 rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 p-3 space-y-2">
                <input type="text" placeholder="Column name" required value={newColName} autoFocus
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                <input type="number" placeholder="WIP limit (optional)" value={newColWip} min="0"
                  onChange={(e) => setNewColWip(e.target.value)}
                  className="w-full h-8 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                <div className="flex gap-1.5">
                  <button type="submit"
                    className="h-7 rounded bg-blue-600 text-white px-2.5 text-xs font-medium hover:bg-blue-700 transition-colors">Add</button>
                  <button type="button" onClick={() => { setAddingColumn(false); setNewColName(''); setNewColWip('') }}
                    className="h-7 rounded border border-slate-200 dark:border-slate-700 text-slate-500 px-2.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                </div>
              </form>
            )}
          </div>

          {/* Tasks outside columns (fallback for unassigned) */}
          {(() => {
            const unassigned = tasks.filter((t) => !t.column_id || !columns.find(c => c.id === t.column_id))
            if (unassigned.length === 0 || !hasColumns) return null
            return (
              <div className="mt-4 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                  {unassigned.length} task(s) without a column
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unassigned.map((t) => (
                    <span key={t.id} className="text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                      {t.title}
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}
        </>
      )}

      {/* No boards yet */}
      {!activeBoardId && boards.length === 0 && !showNewBoard && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400 mb-3">No boards yet. Create one to get started.</p>
          <button onClick={() => setShowNewBoard(true)}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
            + Create Board
          </button>
        </div>
      )}
    </div>
  )
}
