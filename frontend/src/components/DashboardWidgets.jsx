import { useState, useEffect, useCallback } from 'react'
import { getDashboard, PRIORITY_CONFIG, STATUS_CONFIG, ISSUE_TYPE_CONFIG } from '../api'
import {
  ListTodo, AlertCircle, Activity, Target, TrendingDown,
  PieChart, Users, Calendar, Clock, ArrowRight,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) } catch { return '' }
}

function actionLabel(action, fieldName, newValue) {
  if (action === 'created') return 'created this task'
  if (action === 'deleted') return 'deleted task'
  if (action === 'updated_title') return 'renamed'
  if (action === 'updated_status') return `changed status to ${newValue || 'done'}`
  if (action === 'updated_priority') return `changed priority to ${newValue || ''}`
  if (action === 'updated_assignee_id') return 'reassigned'
  if (action === 'updated_issue_type') return `changed type to ${newValue || ''}`
  if (action === 'updated_due_date') return 'changed due date'
  if (action === 'updated_estimated_time') return 'changed estimate'
  if (action === 'added_comment') return 'commented'
  if (fieldName) return `updated ${fieldName}`
  return action
}

// ── Bar chart helper ──────────────────────────────────────────────

function SimpleBar({ data, colorFn, max, height = 24 }) {
  const m = max || Math.max(...Object.values(data), 1)
  return (
    <div className="space-y-1">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-slate-500 dark:text-slate-400 truncate">{k}</span>
          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${colorFn ? colorFn(k) : 'bg-blue-500'}`}
              style={{ width: `${(v / m) * 100}%` }} />
          </div>
          <span className="w-6 text-right text-slate-600 dark:text-slate-300 font-medium">{v}</span>
        </div>
      ))}
    </div>
  )
}

// ── Widget shell ──────────────────────────────────────────────────

function Widget({ icon: Icon, title, subtitle, children, accent, className = '' }) {
  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden ${className}`}>
      <div className={`px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between ${accent || ''}`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
        {subtitle && <span className="text-[10px] text-slate-400">{subtitle}</span>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

// ── Task list (shared by My Tasks + Overdue) ──────────────────────

function TaskList({ tasks, emptyMsg, overdue = false }) {
  if (!tasks || tasks.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-6">{emptyMsg || 'No tasks'}</p>
  }
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto">
      {tasks.map((t) => (
        <div key={t.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 border text-xs group transition-colors ${
          overdue
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            t.status === 'done' ? 'bg-green-500' :
            t.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
          }`} />
          <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{t.title}</span>
          <span className={`text-[10px] font-semibold px-1 py-0.5 rounded ${
            (PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.p2).color
          }`}>
            {(PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.p2).label}
          </span>
          {t.due_date && (
            <span className={`text-[10px] ${overdue ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
              {formatDate(t.due_date)}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Burndown SVG chart ────────────────────────────────────────────

function BurndownChart({ burndown }) {
  if (!burndown || !burndown.points || burndown.points.length < 2) {
    return <p className="text-xs text-slate-400 text-center py-6">Not enough data for burndown chart</p>
  }

  const w = 400, h = 160, pad = { top: 16, right: 16, bottom: 24, left: 28 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom
  const maxTasks = burndown.total_tasks || 1

  const toX = (i) => pad.left + (i / (burndown.points.length - 1)) * cw
  const toY = (v) => pad.top + (1 - v / maxTasks) * ch

  const idealPath = burndown.points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.ideal).toFixed(1)}`
  ).join(' ')

  const actualPoints = burndown.points.filter(p => p.actual !== null && p.actual !== undefined)
  const actualPath = actualPoints.length > 0
    ? actualPoints.map((p, i) =>
        `${i === 0 ? 'M' : 'L'}${toX(burndown.points.indexOf(p)).toFixed(1)},${toY(p.actual).toFixed(1)}`
      ).join(' ')
    : ''

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto max-h-40">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
          <line key={frac}
            x1={pad.left} y1={toY(frac * maxTasks)}
            x2={w - pad.right} y2={toY(frac * maxTasks)}
            stroke="#e2e8f0" strokeWidth="0.5" className="dark:stroke-slate-700" />
        ))}

        {/* Ideal line */}
        <path d={idealPath} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />

        {/* Actual line */}
        {actualPath && (
          <path d={actualPath} fill="none" stroke="#3b82f6" strokeWidth="2" />
        )}

        {/* End dot */}
        {actualPoints.length > 0 && (() => {
          const last = actualPoints[actualPoints.length - 1]
          const idx = burndown.points.indexOf(last)
          return (
            <circle cx={toX(idx)} cy={toY(last.actual)} r="3" fill="#3b82f6" />
          )
        })()}

        {/* Labels */}
        <text x={pad.left} y={pad.top - 4} fill="#94a3b8" fontSize="8">
          {burndown.total_tasks}
        </text>
        <text x={w - pad.right - 20} y={h - 4} fill="#94a3b8" fontSize="8">
          {burndown.total_days}d
        </text>
        <text x={pad.left} y={h - 4} fill="#94a3b8" fontSize="8">0</text>
      </svg>
      <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 mt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-400 inline-block" /> Ideal</span>
        <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block" /> Actual</span>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function DashboardWidgets({ projectId, onTaskClick }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getDashboard()
      setData(d)
    } catch { /* */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-slate-400 text-center py-20">Failed to load dashboard</p>
  }

  const { my_tasks, overdue_tasks, recent_activity, active_sprints, burndown, task_distribution, team_workload } = data

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* ── Row 1 ───────────────────────────────────────────── */}

      {/* My Tasks */}
      <Widget icon={ListTodo} title="Assigned to Me" subtitle={`${my_tasks?.length || 0} tasks`}>
        <TaskList tasks={my_tasks} emptyMsg="No uncompleted tasks assigned to you" />
      </Widget>

      {/* Overdue Tasks */}
      <Widget icon={AlertCircle} title="Overdue" subtitle={`${overdue_tasks?.length || 0} tasks`}
        accent="bg-red-50 dark:bg-red-900/10 border-b-red-200 dark:border-b-red-800">
        <TaskList tasks={overdue_tasks} emptyMsg="Nothing overdue 🎉" overdue />
      </Widget>

      {/* Sprint Progress */}
      <Widget icon={Target} title="Active Sprints" subtitle={active_sprints?.length > 0 ? `${active_sprints.length} active` : ''}>
        {!active_sprints || active_sprints.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No active sprints</p>
        ) : (
          <div className="space-y-3">
            {active_sprints.map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{s.name}</span>
                  <span className="text-slate-400">{s.completed}/{s.total} done</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${s.total > 0 ? (s.completed / s.total) * 100 : 0}%` }} />
                </div>
                {s.goal && <p className="text-[10px] text-slate-400 italic mt-1 truncate">{s.goal}</p>}
                {s.end_date && <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Ends {formatDate(s.end_date)}
                </p>}
              </div>
            ))}
          </div>
        )}
      </Widget>

      {/* ── Row 2 ───────────────────────────────────────────── */}

      {/* Burndown Chart */}
      <Widget icon={TrendingDown} title="Burndown" subtitle={burndown ? `${burndown.total_tasks} tasks` : ''}>
        <BurndownChart burndown={burndown} />
      </Widget>

      {/* Task Distribution */}
      <Widget icon={PieChart} title="Task Distribution">
        <div className="space-y-3">
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">By Status</h4>
            <SimpleBar data={task_distribution?.by_status || {}}
              colorFn={(k) => (STATUS_CONFIG[k] || STATUS_CONFIG.todo).color.replace('bg-', 'bg-').replace('text-', '')}
              max={Math.max(...Object.values(task_distribution?.by_status || {}), 1)} />
          </div>
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">By Priority</h4>
            <SimpleBar data={task_distribution?.by_priority || {}}
              colorFn={(k) => (PRIORITY_CONFIG[k] || PRIORITY_CONFIG.p2).color.replace('bg-', 'bg-').replace('text-', '')} />
          </div>
          <div>
            <h4 className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">By Type</h4>
            <SimpleBar data={task_distribution?.by_type || {}}
              colorFn={(k) => (ISSUE_TYPE_CONFIG[k] || ISSUE_TYPE_CONFIG.task).color} />
          </div>
        </div>
      </Widget>

      {/* Team Workload */}
      <Widget icon={Users} title="Team Workload" subtitle={`${team_workload?.length || 0} members`}>
        {!team_workload || team_workload.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No assigned tasks</p>
        ) : (
          <div className="space-y-2">
            {team_workload.slice(0, 10).map((m) => {
              const maxTasks = team_workload[0]?.task_count || 1
              return (
                <div key={m.user_id} className="flex items-center gap-2 text-xs">
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                    {m.display_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{m.display_name}</span>
                  <div className="w-20 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${(m.task_count / maxTasks) * 100}%` }} />
                  </div>
                  <span className="w-5 text-right text-slate-600 dark:text-slate-300 font-medium">{m.task_count}</span>
                </div>
              )
            })}
          </div>
        )}
      </Widget>

      {/* ── Row 3: Recent Activity (full width) ─────────────── */}

      <div className="md:col-span-2 lg:col-span-3">
        <Widget icon={Activity} title="Recent Activity" subtitle={`${recent_activity?.length || 0} events`}>
          {!recent_activity || recent_activity.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No recent activity</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {recent_activity.map((a, i) => (
                <div key={a.id || i} className="flex items-start gap-3 py-1.5 text-xs border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 mt-0.5">
                    {a.user_name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{a.user_name}</span>{' '}
                    <span className="text-slate-500 dark:text-slate-400">{actionLabel(a.action, a.field_name, a.new_value)}</span>
                    {a.new_value && a.action !== 'updated_status' && a.action !== 'updated_priority' && (
                      <span className="text-slate-600 dark:text-slate-300 ml-0.5">"{a.new_value}"</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Widget>
      </div>
    </div>
  )
}
