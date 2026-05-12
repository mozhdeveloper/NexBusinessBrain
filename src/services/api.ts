// NexVision RAG API client
// Set VITE_USE_SIMULATION=false + VITE_API_BASE_URL=https://your-backend to use real backend

const BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'
).replace(/\/+$/, '') // strip trailing slash to avoid double-slash URLs

// true  → all calls are handled locally (no network, works on Vercel/local with no backend)
// false → all calls go to BASE_URL
const USE_SIMULATION =
  (import.meta.env.VITE_USE_SIMULATION as string | undefined)?.toLowerCase() !== 'false'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ApiFileRecord {
  id: string
  name: string
  status: 'uploading' | 'processing' | 'indexed' | 'error'
  addedAt: string
  size: string
  ext: 'pdf' | 'txt' | 'md' | 'docx' | 'csv' | 'other'
  error?: string | null
}

export interface SourceCitation {
  filename: string
  chunk_preview: string
  score: number
}

export interface ChatResponse {
  answer: string
  summary: string
  sources: SourceCitation[]
  recommended_action: string
  missing_info: string | null
  confidence: number
  model_used: string
}

export interface UsageMetric {
  key: string
  label: string
  used: number
  remaining: number
  limit: number
  unit: string
}

export interface UsageSnapshot {
  reset_at: string
  metrics: UsageMetric[]
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Real HTTP layer ──────────────────────────────────────────────────────────

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `Request failed with status ${res.status}`)
  }
  return res.json() as Promise<T>
}

function getSessionId(): string {
  const KEY = 'nexvision_session_id'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem(KEY, id)
  }
  return id
}

// ─── Simulation layer ─────────────────────────────────────────────────────────

// In-memory file store for simulation
let _simFiles: ApiFileRecord[] = []

function simExt(name: string): ApiFileRecord['ext'] {
  const e = name.split('.').pop()?.toLowerCase()
  if (e === 'pdf') return 'pdf'
  if (e === 'txt') return 'txt'
  if (e === 'md') return 'md'
  if (e === 'docx') return 'docx'
  if (e === 'csv') return 'csv'
  return 'other'
}

function simFormatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

const _catKeywords: Record<string, string[]> = {
  compliance: ['hipaa', 'regulatory', 'audit', 'policy', 'standard', 'privacy', 'regulation', 'compliance', 'osha'],
  finance: ['billing', 'revenue', 'insurance', 'cost', 'budget', 'expense', 'invoice', 'payment', 'claim'],
  quality: ['quality', 'safety', 'infection', 'incident', 'risk', 'hazard', 'inspection', 'outcome'],
  staffing: ['staff', 'nurse', 'doctor', 'employee', 'team', 'schedule', 'shift', 'overtime', 'worker'],
  operations: ['workflow', 'process', 'admission', 'discharge', 'capacity', 'operations', 'procedure', 'delay'],
  equipment: ['equipment', 'maintenance', 'inventory', 'supply', 'device', 'material', 'stock'],
}

const _catResponses: Record<string, Omit<ChatResponse, 'sources' | 'model_used'>> = {
  compliance: {
    answer: 'Compliance analysis detected potential gaps. Key policy areas require review before the next audit cycle.',
    summary: 'Compliance analysis detected potential gaps in the indexed documents. Risk exposure appears moderate.',
    recommended_action: 'Schedule a compliance review within 14 days. Update relevant procedures and ensure all team members complete required training.',
    confidence: 0.91,
    missing_info: null,
  },
  finance: {
    answer: 'Financial analysis indicates areas needing attention. Billing and revenue cycle metrics suggest room for improvement.',
    summary: 'Financial data from indexed documents indicates billing and revenue areas needing attention.',
    recommended_action: 'Review eligibility criteria in policy documents. Cross-reference with records before issuing a decision.',
    confidence: 0.87,
    missing_info: 'Customer transaction history was not found in the indexed documents.',
  },
  quality: {
    answer: 'Quality and safety analysis shows compliance with most standards. Some procedural gaps were identified.',
    summary: 'Quality and safety analysis shows compliance with most standards. Some procedural gaps increase operational risk.',
    recommended_action: 'Conduct targeted inspection of flagged processes. Implement corrective actions within 7 days.',
    confidence: 0.89,
    missing_info: null,
  },
  staffing: {
    answer: 'Staffing data indicates resource allocation challenges. Overtime metrics are elevated.',
    summary: 'Staffing data shows resource allocation challenges. Overtime metrics elevated and scheduling gaps present.',
    recommended_action: 'Review scheduling policies and identify coverage gaps. Consider temporary staffing solutions.',
    confidence: 0.85,
    missing_info: null,
  },
  operations: {
    answer: 'Operational analysis reveals bottlenecks in key workflow steps. Capacity is below optimal during peak periods.',
    summary: 'Operational analysis reveals bottlenecks in workflow. Capacity is below optimal during peak periods.',
    recommended_action: 'Implement a fast-track protocol for high-volume scenarios. Monitor throughput metrics weekly.',
    confidence: 0.88,
    missing_info: null,
  },
  equipment: {
    answer: 'Equipment records indicate upcoming maintenance windows. Supply chain data shows potential stock-outs.',
    summary: 'Equipment and inventory records indicate approaching maintenance windows for critical items.',
    recommended_action: 'Expedite preventive maintenance scheduling. Increase safety stock for critical items by 15–20%.',
    confidence: 0.84,
    missing_info: null,
  },
  general: {
    answer: 'Analysis of your indexed documents is complete. No critical issues detected, though several areas warrant attention.',
    summary: 'Analysis complete. Moderate operational complexity detected. No critical issues found.',
    recommended_action: 'Review flagged sections in source documents. Assign owners for action items and set a 30-day follow-up.',
    confidence: 0.78,
    missing_info: null,
  },
}

function simGenerateChat(question: string): ChatResponse {
  const lower = question.toLowerCase()
  let matched = 'general'
  let maxHits = 0
  for (const [cat, kws] of Object.entries(_catKeywords)) {
    const hits = kws.filter((k) => lower.includes(k)).length
    if (hits > maxHits) { maxHits = hits; matched = cat }
  }
  const base = _catResponses[matched]
  const indexed = _simFiles.filter((f) => f.status === 'indexed')
  const sources: SourceCitation[] = indexed.slice(0, 3).map((f) => ({
    filename: f.name,
    chunk_preview: `Relevant excerpt from ${f.name} relating to your query...`,
    score: parseFloat((0.75 + Math.random() * 0.2).toFixed(2)),
  }))
  return {
    ...base,
    sources,
    missing_info:
      indexed.length === 0
        ? 'No documents indexed yet. Upload files to your knowledge base first.'
        : base.missing_info,
    model_used: 'simulation',
  }
}

const _sim = {
  health: async (): Promise<boolean> => true,

  uploadFile: async (file: File): Promise<ApiFileRecord> => {
    const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const record: ApiFileRecord = {
      id,
      name: file.name,
      status: 'processing',
      addedAt: new Date().toISOString(),
      size: simFormatSize(file.size),
      ext: simExt(file.name),
    }
    _simFiles = [record, ..._simFiles]
    // Transition to indexed after 3-4.5s
    const delay = 3000 + Math.random() * 1500
    setTimeout(() => {
      _simFiles = _simFiles.map((f) =>
        f.id === id ? { ...f, status: 'indexed' } : f,
      )
    }, delay)
    return record
  },

  getFiles: async (): Promise<ApiFileRecord[]> => [..._simFiles],

  deleteFile: async (id: string): Promise<void> => {
    _simFiles = _simFiles.filter((f) => f.id !== id)
  },

  sendChat: async (question: string, _history: ConversationMessage[]): Promise<ChatResponse> => {
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1000))
    return simGenerateChat(question)
  },

  resetAll: async (): Promise<void> => {
    _simFiles = []
  },

  resetChat: async (): Promise<void> => { /* no-op in sim */ },

  getUsage: async (): Promise<UsageSnapshot> => ({
    reset_at: new Date(Date.now() + 86_400_000).toISOString(),
    metrics: [
      { key: 'queries', label: 'Queries', used: 0, remaining: 100, limit: 100, unit: 'req' },
    ],
  }),
}

// ─── Public API object ────────────────────────────────────────────────────────

export const api = {
  baseUrl: BASE_URL,
  isSimulation: USE_SIMULATION,
  sessionId: getSessionId(),

  health: async (): Promise<boolean> =>
    USE_SIMULATION ? _sim.health() : (async () => {
      try { return (await fetch(`${BASE_URL}/health`)).ok } catch { return false }
    })(),

  uploadFile: async (file: File): Promise<ApiFileRecord> =>
    USE_SIMULATION ? _sim.uploadFile(file) : request('/files/upload', {
      method: 'POST',
      body: (() => { const f = new FormData(); f.append('file', file); return f })(),
    }),

  getFiles: async (): Promise<ApiFileRecord[]> =>
    USE_SIMULATION ? _sim.getFiles() : request<ApiFileRecord[]>('/files'),

  deleteFile: async (id: string): Promise<void> =>
    USE_SIMULATION ? _sim.deleteFile(id) :
      request(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  sendChat: async (question: string, history: ConversationMessage[]): Promise<ChatResponse> =>
    USE_SIMULATION ? _sim.sendChat(question, history) :
      request<ChatResponse>('/chat', {
        method: 'POST',
        body: JSON.stringify({
          question,
          session_id: api.sessionId,
          conversation_history: history,
        }),
      }),

  resetAll: async (): Promise<void> =>
    USE_SIMULATION ? _sim.resetAll() : request('/reset', { method: 'POST' }),

  resetChat: async (): Promise<void> =>
    USE_SIMULATION ? _sim.resetChat() :
      request(`/chat/reset?session_id=${encodeURIComponent(api.sessionId)}`, { method: 'POST' }),

  getUsage: async (): Promise<UsageSnapshot> =>
    USE_SIMULATION ? _sim.getUsage() : request<UsageSnapshot>('/usage'),
}
