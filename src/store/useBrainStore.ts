import { create } from 'zustand'
import { api, type ApiFileRecord, type SourceCitation } from '@/services/api'

export interface FileRecord {
  id: string
  name: string
  status: 'uploading' | 'processing' | 'indexed' | 'error'
  addedAt: string
  size: string
  ext: 'pdf' | 'txt' | 'md' | 'docx' | 'csv' | 'other'
  error?: string | null
}

export interface ReasoningResult {
  summary: string
  sources: SourceCitation[]
  recommendedAction: string
  confidence: number
  missingInfo: string | null
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  reasoning?: ReasoningResult
}

export interface BrainState {
  files: FileRecord[]
  messages: Message[]
  isAiResponding: boolean
  backendOnline: boolean
  lastError: string | null

  init: () => Promise<void>
  uploadFile: (file: File) => Promise<void>
  deleteFile: (id: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  resetChat: () => Promise<void>
  resetAll: () => Promise<void>
  refreshFiles: () => Promise<void>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtAgo(iso: string): string {
  if (!iso) return 'Just now'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return 'Just now'
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return new Date(ts).toLocaleDateString()
}

function toRecord(api: ApiFileRecord): FileRecord {
  return {
    id: api.id,
    name: api.name,
    status: api.status,
    addedAt: fmtAgo(api.addedAt),
    size: api.size,
    ext: api.ext,
    error: api.error ?? null,
  }
}

// Polling for "processing" files
let pollTimer: ReturnType<typeof setInterval> | null = null

function ensurePolling(getState: () => BrainState, refresh: () => Promise<void>) {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    const { files } = getState()
    if (!files.some((f) => f.status === 'processing' || f.status === 'uploading')) {
      if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      return
    }
    try {
      await refresh()
    } catch {
      /* ignore transient errors */
    }
  }, 2000)
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useBrainStore = create<BrainState>((set, get) => ({
  files: [],
  messages: [],
  isAiResponding: false,
  backendOnline: false,
  lastError: null,

  init: async () => {
    const ok = await api.health()
    set({ backendOnline: ok })
    if (ok) {
      await get().refreshFiles()
    }
  },

  refreshFiles: async () => {
    try {
      const list = await api.getFiles()
      set({ files: list.map(toRecord), backendOnline: true })
    } catch (err) {
      set({ backendOnline: false, lastError: (err as Error).message })
    }
  },

  uploadFile: async (file: File) => {
    // Optimistic placeholder
    const tempId = `tmp-${Date.now()}`
    const placeholder: FileRecord = {
      id: tempId,
      name: file.name,
      status: 'uploading',
      addedAt: 'Just now',
      size: `${Math.round(file.size / 1024)} KB`,
      ext: (file.name.split('.').pop()?.toLowerCase() ?? 'other') as FileRecord['ext'],
    }
    // Remove any existing record with the same name (backend will auto-replace)
    set((s) => ({
      files: [placeholder, ...s.files.filter((f) => f.name !== file.name)],
      // Clear chat so users aren't confused by responses from the old file
      messages: [],
    }))

    try {
      const created = await api.uploadFile(file)
      set((s) => ({
        files: [toRecord(created), ...s.files.filter((f) => f.id !== tempId)],
        lastError: null,
      }))
      ensurePolling(get, get().refreshFiles)
    } catch (err) {
      set((s) => ({
        files: s.files.map((f) =>
          f.id === tempId ? { ...f, status: 'error', error: (err as Error).message } : f,
        ),
        lastError: (err as Error).message,
      }))
    }
  },

  deleteFile: async (id: string) => {
    const prev = get().files
    set({ files: prev.filter((f) => f.id !== id), messages: [] })
    try {
      if (!id.startsWith('tmp-')) {
        await api.deleteFile(id)
      }
    } catch (err) {
      set({ files: prev, lastError: (err as Error).message })
    }
  },

  sendMessage: async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    }
    set((s) => ({ messages: [...s.messages, userMsg], isAiResponding: true }))

    const history = get()
      .messages.filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const resp = await api.sendChat(trimmed, history)
      const assistant: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: resp.answer,
        timestamp: Date.now(),
        reasoning: {
          summary: resp.summary,
          sources: resp.sources,
          recommendedAction: resp.recommended_action,
          confidence: resp.confidence,
          missingInfo: resp.missing_info,
        },
      }
      set((s) => ({ messages: [...s.messages, assistant], isAiResponding: false }))
    } catch (err) {
      const errorMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: `I could not reach the backend. ${(err as Error).message}`,
        timestamp: Date.now(),
      }
      set((s) => ({
        messages: [...s.messages, errorMsg],
        isAiResponding: false,
        lastError: (err as Error).message,
      }))
    }
  },

  resetChat: async () => {
    set({ messages: [] })
    try {
      await api.resetChat()
    } catch {
      /* ignore */
    }
  },

  resetAll: async () => {
    set({ files: [], messages: [], isAiResponding: false })
    try {
      await api.resetAll()
    } catch (err) {
      set({ lastError: (err as Error).message })
    }
  },
}))
