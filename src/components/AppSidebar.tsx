import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Users,
  Settings,
  Bell,
  FileText,
  ChevronDown,
  ChevronUp,
  Database,
  RotateCcw,
  AlertCircle,
  Loader2,
  Activity,
} from 'lucide-react'
import logo from '@/assets/logo.png'
import { useBrainStore, type FileRecord } from '@/store/useBrainStore'
import { api, type UsageMetric } from '@/services/api'

// --- Collapsible Section ---

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen,
  badge,
}: {
  title: string
  icon?: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: number
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2 px-3 rounded-xl hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-gray-700">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="text-[10px] font-bold bg-[#66B2B2]/15 text-[#4f9999] px-1.5 py-0.5 rounded-full ml-1">
              {badge}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// --- File status indicator ---

function FileStatusDot({ status }: { status: FileRecord['status'] }) {
  if (status === 'indexed')
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
  if (status === 'processing' || status === 'uploading')
    return <Loader2 className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
  return <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
}

// --- Reset confirmation ---

function ResetConfirmDialog({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 6 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-[76px] left-3 right-3 bg-white border border-gray-200 rounded-xl shadow-lg p-4 z-50"
        >
          <p className="text-sm font-semibold text-gray-800 mb-1">Reset all data?</p>
          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
            This will delete all uploaded files and the entire conversation. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Reset
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// --- Usage Panel ---

/** Bar fills as usage grows. Green = low, amber = moderate, red = near limit. */
function usageBarColor(pct: number): string {
  if (pct >= 85) return 'bg-red-400'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-[#66B2B2]'
}

function usageTextColor(pct: number): string {
  if (pct >= 85) return 'text-red-500'
  if (pct >= 60) return 'text-amber-500'
  return 'text-[#4f9999]'
}

function UsagePanel() {
  const [metrics, setMetrics] = useState<UsageMetric[]>([])
  const [resetAt, setResetAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const snap = await api.getUsage()
        if (!active) return
        setMetrics(snap.metrics)
        setResetAt(snap.reset_at)
      } catch {
        // backend not ready — silently ignore
      }
    }
    load()
    const id = setInterval(load, 30_000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const resetTime = resetAt
    ? new Date(resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  if (metrics.length === 0) return null

  return (
    <div className="px-3 pb-3">
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 pt-2.5 pb-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Activity className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase">
            API Usage Today
          </span>
        </div>
        <div className="space-y-2.5">
          {metrics.map((m) => {
            const pct = m.limit > 0 ? Math.min(100, Math.round((m.used / m.limit) * 100)) : 0
            return (
              <div key={m.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-600 font-medium">{m.label}</span>
                  <span className={`text-[10px] font-semibold tabular-nums ${usageTextColor(pct)}`}>
                    {m.used.toLocaleString()}
                    <span className="text-gray-400 font-normal"> / {m.limit.toLocaleString()}</span>
                  </span>
                </div>
                {/* Bar fills from left as usage grows */}
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${usageBarColor(pct)}`}
                  />
                </div>
              </div>
            )
          })}
        </div>
        {resetTime && (
          <p className="text-[10px] text-gray-400 mt-2.5 text-right">
            Resets at {resetTime}
          </p>
        )}
      </div>
    </div>
  )
}

// --- Sidebar ---

export default function AppSidebar() {
  const files = useBrainStore((s) => s.files)
  const resetAll = useBrainStore((s) => s.resetAll)
  const lastError = useBrainStore((s) => s.lastError)
  const [showReset, setShowReset] = useState(false)
  const [dismissedError, setDismissedError] = useState<string | null>(null)

  const indexedCount = files.filter((f) => f.status === 'indexed').length
  const visibleError = lastError && lastError !== dismissedError ? lastError : null

  function handleReset() {
    resetAll()
    setShowReset(false)
  }

  return (
    <div className="relative flex flex-col w-60 shrink-0 h-screen bg-white border-r border-gray-100 overflow-y-auto">

      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <img src={logo} alt="NexVision" className="h-7 w-auto object-contain" />
      </div>

      {/* User row */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#66B2B2]/15 flex items-center justify-center shrink-0">
            <span className="text-[#4f9999] text-xs font-bold">AD</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">Admin User</p>
            <p className="text-[11px] text-gray-400 truncate">nexvision.ai</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {/* Main nav items */}
        <ul className="space-y-0.5 mb-5">
          {([
            { icon: Home, label: 'Home', active: true },
            { icon: Bell, label: 'Notifications' },
          ] as { icon: React.ElementType; label: string; active?: boolean }[]).map(({ icon: Icon, label, active }) => (
            <li key={label}>
              <button
                className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#66B2B2]/10 text-[#4f9999]'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            </li>
          ))}
        </ul>

        {/* Knowledge Base section */}
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-gray-400 px-3 mb-2 uppercase">
            Knowledge Base
          </p>

          {/* Duplicate / upload error banner */}
          <AnimatePresence>
            {visibleError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mx-1 mb-2 overflow-hidden"
              >
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-600 leading-snug flex-1">{visibleError}</p>
                  <button
                    onClick={() => setDismissedError(lastError)}
                    className="text-red-300 hover:text-red-500 text-xs leading-none shrink-0"
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <CollapsibleSection
            title="Documents"
            icon={Database}
            defaultOpen
            badge={indexedCount}
          >
            {files.length === 0 ? (
              <div className="flex flex-col items-center py-5 px-3 text-center">
                <FileText className="w-6 h-6 text-gray-300 mb-1.5" />
                <p className="text-xs text-gray-400 leading-snug">
                  No files yet.
                  <br />
                  Upload documents to start.
                </p>
              </div>
            ) : (
              <ul className="space-y-0.5 px-1 py-1">
                {files.map((file) => (
                  <li key={file.id}>
                    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <FileStatusDot status={file.status} />
                      <span
                        className="text-xs text-gray-600 truncate flex-1"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CollapsibleSection>

          {/* Indexing progress */}
          {files.length > 0 && (
            <div className="mt-2 px-1">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>Indexed</span>
                  <span className="font-semibold text-gray-700">
                    {indexedCount}/{files.length}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    animate={{
                      width: files.length > 0 ? `${(indexedCount / files.length) * 100}%` : '0%',
                    }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="h-full bg-[#66B2B2] rounded-full"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Daily API usage progress bars */}
      <UsagePanel />

      {/* Bottom: Settings + Reset */}
      <div className="px-3 pb-4 pt-2 border-t border-gray-100 space-y-0.5">
        <button className="w-full flex items-center gap-2.5 py-2 px-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors">
          <Users className="w-4 h-4 shrink-0 text-gray-400" />
          Team
        </button>
        <button className="w-full flex items-center gap-2.5 py-2 px-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors">
          <Settings className="w-4 h-4 shrink-0 text-gray-400" />
          Settings
        </button>
        <button
          onClick={() => setShowReset((s) => !s)}
          className="w-full flex items-center gap-2.5 py-2 px-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <RotateCcw className="w-4 h-4 shrink-0" />
          Reset all data
        </button>
      </div>

      {/* Reset confirm dialog */}
      <ResetConfirmDialog
        open={showReset}
        onConfirm={handleReset}
        onCancel={() => setShowReset(false)}
      />
    </div>
  )
}
