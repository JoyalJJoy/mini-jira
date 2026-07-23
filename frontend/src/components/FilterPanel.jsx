import { useState } from 'react'
import {
  STATUS_CONFIG, PRIORITY_CONFIG, ISSUE_TYPE_CONFIG,
  getSprints,
} from '../api'
import {
  Search, X, SlidersHorizontal, Save, Bookmark, ChevronDown,
} from 'lucide-react'
import { toast } from './Toast'

export default function FilterPanel({
  filters,
  onFilterChange,
  onClearFilters,
  users,
  tags,
  savedFilters,
  onSaveFilter,
  onLoadFilter,
  onDeleteFilter,
  sprints,
}) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [showSaveInput, setShowSaveInput] = useState(false)

  const userMap = {}
  if (users) for (const u of users) userMap[u.id] = u

  const handleChange = (key, value) => {
    onFilterChange(key, value === '' ? null : value)
  }

  const hasActiveFilters = Object.values(filters).some((v) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0))

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'search_q') return false
    if (Array.isArray(v)) return v.length > 0
    return v !== null && v !== ''
  }).length

  const handleSave = async () => {
    if (!filterName.trim()) return
    setSaving(true)
    try {
      await onSaveFilter(filterName.trim(), filters)
      setFilterName('')
      setShowSaveInput(false)
      toast('Filter saved!')
    } catch (err) { toast(err.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
      {/* ── Search + toggle row ───────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks across title and description..."
            value={filters.search_q || ''}
            onChange={(e) => handleChange('search_q', e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-400"
          />
          {filters.search_q && (
            <button onClick={() => handleChange('search_q', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button onClick={() => setExpanded(!expanded)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            expanded || hasActiveFilters
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
          }`}>
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-0.5 bg-white/20 rounded-full px-1.5 text-[10px]">{activeFilterCount}</span>
          )}
        </button>
        {hasActiveFilters && (
          <button onClick={onClearFilters}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors px-1.5 py-1">
            Clear
          </button>
        )}
      </div>

      {/* ── Expanded filter panel ────────────────────────── */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3">
          {/* Row 1: Status, Priority, Assignee */}
          <div className="flex flex-wrap gap-2">
            {/* Status */}
            <div className="min-w-[130px]">
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Status</label>
              <select value={filters.status || ''} onChange={(e) => handleChange('status', e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">All</option>
                {Object.entries(STATUS_CONFIG).map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div className="min-w-[110px]">
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Priority</label>
              <select value={filters.priority || ''} onChange={(e) => handleChange('priority', e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">All</option>
                {Object.entries(PRIORITY_CONFIG).map(([k, c]) => (
                  <option key={k} value={k}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="min-w-[150px]">
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Assignee</label>
              <select value={filters.assignee_id || ''} onChange={(e) => handleChange('assignee_id', e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">All</option>
                {users && users.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name || u.email}</option>
                ))}
              </select>
            </div>

            {/* Sprint */}
            <div className="min-w-[140px]">
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Sprint</label>
              <select value={filters.sprint_id || ''} onChange={(e) => handleChange('sprint_id', e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">All</option>
                <option value="none">Backlog (no sprint)</option>
                {sprints && sprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: Due date, Labels */}
          <div className="flex flex-wrap gap-2 items-end">
            {/* Due date range */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Due Date From</label>
              <input type="date" value={filters.due_date_from || ''}
                onChange={(e) => handleChange('due_date_from', e.target.value)}
                className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div className="text-xs text-slate-400 pb-1.5">→</div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Due Date To</label>
              <input type="date" value={filters.due_date_to || ''}
                onChange={(e) => handleChange('due_date_to', e.target.value)}
                className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>

            {/* Labels */}
            {tags && tags.length > 0 && (
              <div className="min-w-[180px]">
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Labels</label>
                <select multiple value={filters.tag_ids || []}
                  onChange={(e) => handleChange('tag_ids', Array.from(e.target.selectedOptions, (o) => o.value))}
                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Issue type */}
            <div className="min-w-[120px]">
              <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Type</label>
              <select value={filters.issue_type || ''} onChange={(e) => handleChange('issue_type', e.target.value)}
                className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">All</option>
                {Object.entries(ISSUE_TYPE_CONFIG).map(([k, c]) => (
                  <option key={k} value={k}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Saved filters */}
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
            <Bookmark className="w-3.5 h-3.5 text-slate-400" />
            {savedFilters && savedFilters.length > 0 ? (
              <select value="" onChange={(e) => { if (e.target.value) { onLoadFilter(savedFilters.find(f => f.id === e.target.value)); e.target.value = '' } }}
                className="h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                <option value="">Load saved filter...</option>
                {savedFilters.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-400">No saved filters</span>
            )}

            {!showSaveInput ? (
              <button onClick={() => setShowSaveInput(true)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                <Save className="w-3 h-3" /> Save Current
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input type="text" placeholder="Filter name..." value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="h-7 w-36 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                <button onClick={handleSave} disabled={saving || !filterName.trim()}
                  className="h-7 rounded-md bg-blue-600 text-white px-2 text-[10px] font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? '...' : 'Save'}
                </button>
                <button onClick={() => { setShowSaveInput(false); setFilterName('') }}
                  className="h-7 w-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* ── Active filter pills ────────────────────────── */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-400 font-medium">Active:</span>
              {Object.entries(filters).map(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return null
                if (key === 'search_q') return null
                let label = ''
                if (key === 'status') label = `Status: ${STATUS_CONFIG[value]?.label || value}`
                else if (key === 'priority') label = `Priority: ${PRIORITY_CONFIG[value]?.label || value}`
                else if (key === 'assignee_id') label = `Assignee: ${userMap[value]?.display_name || userMap[value]?.email || value.slice(0, 8)}`
                else if (key === 'sprint_id') label = value === 'none' ? 'Sprint: Backlog' : `Sprint: ${sprints?.find(s => s.id === value)?.name || value.slice(0, 8)}`
                else if (key === 'tag_ids') label = `Labels: ${value.length}`
                else if (key === 'due_date_from') label = `Due after: ${value}`
                else if (key === 'due_date_to') label = `Due before: ${value}`
                else if (key === 'issue_type') label = `Type: ${ISSUE_TYPE_CONFIG[value]?.icon || ''} ${ISSUE_TYPE_CONFIG[value]?.label || value}`
                else label = `${key}: ${value}`
                return (
                  <span key={key} className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] text-blue-700 dark:text-blue-300">
                    {label}
                    <button onClick={() => handleChange(key, '')} className="p-0.5 hover:text-blue-900 dark:hover:text-blue-100">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
