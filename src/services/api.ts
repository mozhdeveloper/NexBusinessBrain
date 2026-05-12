// NexVision RAG API client. Set VITE_API_BASE_URL to override.

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

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

// Stable per-tab session id
function getSessionId(): string {
  const KEY = 'nexvision_session_id'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem(KEY, id)
  }
  return id
}

export const api = {
  baseUrl: BASE_URL,
  sessionId: getSessionId(),

  health: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE_URL}/health`)
      return res.ok
    } catch {
      return false
    }
  },

  uploadFile: async (file: File): Promise<ApiFileRecord> => {
    const formData = new FormData()
    formData.append('file', file)
    return request<ApiFileRecord>('/files/upload', { method: 'POST', body: formData })
  },

  getFiles: async (): Promise<ApiFileRecord[]> => {
    return request<ApiFileRecord[]>('/files')
  },

  deleteFile: async (id: string): Promise<void> => {
    await request(`/files/${encodeURIComponent(id)}`, { method: 'DELETE' })
  },

  sendChat: async (
    question: string,
    history: ConversationMessage[],
  ): Promise<ChatResponse> => {
    return request<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({
        question,
        session_id: api.sessionId,
        conversation_history: history,
      }),
    })
  },

  resetAll: async (): Promise<void> => {
    await request('/reset', { method: 'POST' })
  },

  resetChat: async (): Promise<void> => {
    await request(`/chat/reset?session_id=${encodeURIComponent(api.sessionId)}`, {
      method: 'POST',
    })
  },

  getUsage: async (): Promise<UsageSnapshot> => {
    return request<UsageSnapshot>('/usage')
  },
}
