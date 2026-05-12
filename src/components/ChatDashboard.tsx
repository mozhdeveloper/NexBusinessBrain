import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Mic, Plus, User, FileText, ChevronDown } from 'lucide-react'
import { useBrainStore, type Message } from '@/store/useBrainStore'

function formatTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Renders plain text preserving line breaks. Strips any stray markdown markers. */
function MessageContent({ content }: { content: string }) {
  const clean = content
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
  return (
    <>
      {clean.split('\n').map((line, j, arr) => (
        <span key={j}>
          {line}
          {j < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  )
}

function ReasoningDropdown({ message }: { message: Message }) {
  const [open, setOpen] = useState(false)
  const r = message.reasoning
  if (!r || r.sources.length === 0) return null

  return (
    <div className="mt-2.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-xs text-nexvision-teal hover:underline"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        {open ? 'Hide' : 'View'} reasoning &amp; sources
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2.5 border-l-2 border-nexvision-teal/25 pl-3">
              {/* Sources */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Sources
                </p>
                {r.sources.map((src, i) => (
                  <div key={i} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-nexvision-teal shrink-0" />
                      <span className="text-nexvision-teal truncate font-medium">{src.filename}</span>
                      {src.score > 0 && (
                        <span className="text-[9px] text-muted-foreground">
                          {Math.round(src.score * 100)}%
                        </span>
                      )}
                    </div>
                    {src.chunk_preview && (
                      <p className="text-[10px] text-muted-foreground/80 ml-4 mt-0.5 leading-snug line-clamp-2">
                        {src.chunk_preview}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Recommended Action */}
              {r.recommendedAction && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Recommended Action
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {r.recommendedAction}
                  </p>
                </div>
              )}

              {/* Missing info */}
              {r.missingInfo && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Missing Information
                  </p>
                  <p className="text-xs text-amber-600 leading-relaxed">{r.missingInfo}</p>
                </div>
              )}

              {/* Confidence bar */}
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                  Confidence
                </p>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${r.confidence * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-nexvision-teal rounded-full"
                  />
                </div>
                <span className="text-[10px] font-bold text-nexvision-teal whitespace-nowrap">
                  {Math.round(r.confidence * 100)}%
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-end gap-1"
      >
        <div className="flex items-end gap-2">
          <div className="max-w-[270px] bg-nexvision-darkgrey text-white text-sm leading-relaxed rounded-2xl rounded-br-sm px-4 py-2.5">
            {message.content}
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-slate-500" />
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground pr-10">
          {formatTime(message.timestamp)}
        </span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-start gap-1"
    >
      <div className="flex items-end gap-2">
        <div className="w-8 h-8 rounded-full bg-nexvision-off-white border border-border flex items-center justify-center shrink-0">
          <Mic className="w-4 h-4 text-nexvision-darkgrey" />
        </div>
        <div className="max-w-[270px] bg-white border border-border text-nexvision-darkgrey text-sm leading-relaxed rounded-2xl rounded-bl-sm px-4 py-2.5 shadow-xs">
          <MessageContent content={message.content} />
          <ReasoningDropdown message={message} />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground pl-10">
        {formatTime(message.timestamp)}
      </span>
    </motion.div>
  )
}

export default function ChatDashboard() {
  const messages = useBrainStore((s) => s.messages)
  const isAiResponding = useBrainStore((s) => s.isAiResponding)
  const files = useBrainStore((s) => s.files)
  const sendMessage = useBrainStore((s) => s.sendMessage)
  const resetChat = useBrainStore((s) => s.resetChat)

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const hasIndexedFiles = files.some((f) => f.status === 'indexed')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isAiResponding])

  function handleSend() {
    if (!input.trim() || isAiResponding || !hasIndexedFiles) return
    sendMessage(input.trim())
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col w-[380px] shrink-0 h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-nexvision-off-white border border-border flex items-center justify-center shrink-0">
            <Mic className="w-4 h-4 text-nexvision-darkgrey" />
          </div>
          <div>
            <p className="text-sm font-semibold text-nexvision-darkgrey leading-tight">
              AI Assistant
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  hasIndexedFiles ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
              />
              <span className="text-[11px] text-muted-foreground">
                {hasIndexedFiles ? 'RAG Active' : 'No documents indexed'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={resetChat}
          title="New conversation"
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isAiResponding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-center px-6 py-12"
          >
            <div className="w-12 h-12 rounded-full bg-nexvision-off-white border border-border flex items-center justify-center mb-3">
              <Mic className="w-6 h-6 text-nexvision-darkgrey" />
            </div>
            <p className="text-sm font-semibold text-nexvision-darkgrey mb-1">AI Assistant</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
              {hasIndexedFiles
                ? 'Ask a question about your indexed documents'
                : 'Upload and index documents on the left to get started'}
            </p>
          </motion.div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {isAiResponding && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2"
          >
            <div className="w-8 h-8 rounded-full bg-nexvision-off-white border border-border flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4 text-nexvision-darkgrey" />
            </div>
            <div className="bg-white border border-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-xs">
              <div className="flex items-center gap-1">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-1.5 h-1.5 rounded-full bg-nexvision-teal animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-3 border-t border-border">
        <div
          className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 transition-colors ${
            hasIndexedFiles
              ? 'border-border focus-within:border-nexvision-teal/50'
              : 'border-border/50 opacity-60'
          }`}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              hasIndexedFiles
                ? 'Ask a question about your documents...'
                : 'Upload documents first...'
            }
            disabled={!hasIndexedFiles || isAiResponding}
            className="flex-1 text-sm bg-transparent outline-none text-nexvision-darkgrey placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isAiResponding || !hasIndexedFiles}
            className="w-8 h-8 rounded-lg bg-nexvision-darkgrey text-white flex items-center justify-center hover:bg-nexvision-darkgrey/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground mt-2">
          AI can make mistakes. Verify important information.
        </p>
      </div>
    </div>
  )
}

