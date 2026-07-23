import { useState, useEffect } from 'react'
import {
  updateTask, getComments, createComment,
  STATUS_CONFIG, PRIORITY_CONFIG, ISSUE_TYPE_CONFIG, STATUS_ORDER,
} from '../api'
import { toast } from './Toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'

export default function TaskCard({ task, onDelete, onUpdate, users }) {
  const [comments, setComments] = useState([])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [loading, setLoading] = useState(false)

  const userMap = {}
  if (users) {
    for (const u of users) userMap[u.id] = u
  }

  const assignee = task.assignee_id ? userMap[task.assignee_id] : null

  const toggleComments = async () => {
    if (!showComments) {
      try {
        const data = await getComments(task.id)
        setComments(data)
      } catch { /* ignore */ }
    }
    setShowComments((v) => !v)
  }

  const handleAddComment = async (e) => {
    e.preventDefault()
    if (!commentText.trim()) return
    setLoading(true)
    try {
      const c = await createComment(task.id, commentText)
      setComments((prev) => [...prev, c])
      setCommentText('')
    } catch (err) {
      toast(err.message || 'Failed to post comment', 'error')
    }
    setLoading(false)
  }

  const changeAssignee = async (e) => {
    const val = e.target.value
    const updated = await updateTask(task.id, { assignee_id: val || null })
    if (onUpdate) onUpdate(updated)
  }

  return (
    <Card className={task.status === 'done' ? 'opacity-55' : ''}>
      <CardContent className="pt-4">
        {/* Main row */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs leading-none shrink-0" title={(ISSUE_TYPE_CONFIG[task.issue_type] || ISSUE_TYPE_CONFIG.task).label}>
                {(ISSUE_TYPE_CONFIG[task.issue_type] || ISSUE_TYPE_CONFIG.task).icon}
              </span>
              <p className={`truncate text-sm font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </p>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${(PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.p2).color}`}>
                {(PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.p2).label}
              </span>
            </div>
            {task.description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{task.description}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/60">
              <span>{new Date(task.created_at).toLocaleDateString()}</span>

              {/* Assignee selector */}
              <select
                value={task.assignee_id || ''}
                onChange={changeAssignee}
                className="rounded border-0 bg-transparent text-[10px] font-medium text-muted-foreground/80 hover:text-foreground cursor-pointer"
                title="Assign to"
              >
                <option value="">Unassigned</option>
                {users && users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.email}
                  </option>
                ))}
              </select>

              {/* Comment toggle */}
              <button
                onClick={toggleComments}
                className="hover:text-foreground cursor-pointer"
              >
                💬 {comments.length || (showComments ? '' : '')}
                {showComments ? 'Hide' : 'Comment'}
              </button>
            </div>
          </div>

          {/* Status + Delete */}
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex overflow-hidden rounded-md border border-border">
              {STATUS_ORDER.map((s) => {
                const active = s === task.status
                return (
                  <button
                    key={s}
                    onClick={() => {
                      if (!active) {
                        updateTask(task.id, { status: s }).then((updated) => {
                          if (onUpdate) onUpdate(updated)
                        })
                      }
                    }}
                    className={`px-2 py-1 text-[11px] font-medium leading-none transition-colors ${
                      active
                        ? (STATUS_CONFIG[s] || STATUS_CONFIG.todo).color
                        : 'bg-transparent text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {(STATUS_CONFIG[s] || STATUS_CONFIG.todo).label}
                  </button>
                )
              })}
            </div>
            <Button variant="destructive" size="xs" onClick={() => onDelete(task.id)}>✕</Button>
          </div>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 flex flex-col gap-1.5">
              {comments.length === 0 && (
                <p className="text-[11px] text-muted-foreground">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="rounded-md bg-muted/50 px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium">
                      {userMap[c.author_id]?.display_name || userMap[c.author_id]?.email || c.author_id.slice(0, 8)}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs">{c.content}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddComment} className="flex gap-1.5">
              <Input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="h-7 text-xs flex-1"
              />
              <Button type="submit" size="xs" disabled={loading || !commentText.trim()}>
                Post
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
