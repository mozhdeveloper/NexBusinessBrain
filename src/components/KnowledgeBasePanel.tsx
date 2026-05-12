import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  Loader2,
  Plus,
  Grid3x3,
  List,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { useBrainStore, type FileRecord } from '@/store/useBrainStore'

function StatusBadge({ status }: { status: FileRecord['status'] }) {
  if (status === 'indexed') {
    return (
      <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        Indexed
      </span>
    )
  }
  if (status === 'processing' || status === 'uploading') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        <Loader2 className="w-3 h-3 animate-spin" />
        Processing
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      Error
    </span>
  )
}

function FileTypeIcon({ ext }: { ext: FileRecord['ext'] }) {
  const colors: Record<string, string> = {
    pdf: 'text-red-500',
    docx: 'text-blue-500',
    txt: 'text-slate-500',
    md: 'text-purple-500',
    csv: 'text-green-600',
    other: 'text-slate-400',
  }
  return <FileText className={`w-4 h-4 shrink-0 ${colors[ext] ?? colors.other}`} />
}

export default function KnowledgeBasePanel() {
  const files = useBrainStore((s) => s.files)
  const uploadFile = useBrainStore((s) => s.uploadFile)
  const deleteFile = useBrainStore((s) => s.deleteFile)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  function handleFiles(fileList: FileList) {
    Array.from(fileList).forEach((f) => uploadFile(f))
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 h-screen bg-white overflow-y-auto border-r border-border">
      {/* Upload zone */}
      <div className="px-6 pt-6 pb-5 border-b border-border">
        <h2 className="text-base font-semibold text-nexvision-darkgrey mb-4">
          Upload Knowledge
        </h2>
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragOver(true)
          }}
          onDragLeave={() => setIsDragOver(false)}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors select-none ${
            isDragOver
              ? 'border-nexvision-teal bg-nexvision-teal/5'
              : 'border-border hover:border-nexvision-teal/50 hover:bg-muted/30'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
            <Upload className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-nexvision-darkgrey">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, TXT, MD or DOCX (max. 10MB)
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.txt,.md,.docx,.csv"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      <div className="flex-1 px-6 py-5">
        {/* Breadcrumb + controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Home</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-medium text-nexvision-darkgrey">Knowledge Base</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode((v) => (v === 'list' ? 'grid' : 'list'))}
              className="w-8 h-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
            >
              {viewMode === 'list' ? (
                <Grid3x3 className="w-4 h-4" />
              ) : (
                <List className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-sm font-medium bg-nexvision-darkgrey text-white px-3 py-1.5 rounded-md hover:bg-nexvision-darkgrey/80 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New
            </button>
          </div>
        </div>

        {/* Empty state */}
        {files.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-nexvision-darkgrey">No files yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload your first document to start asking questions
            </p>
          </motion.div>
        ) : (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 tracking-wide">
                    FILE NAME ↕
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 tracking-wide">
                    STATUS
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 tracking-wide">
                    ADDED
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5 tracking-wide">
                    SIZE
                  </th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {files.map((file) => (
                    <motion.tr
                      key={file.id}
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <FileTypeIcon ext={file.ext} />
                          <span className="font-medium text-nexvision-darkgrey truncate max-w-[180px]">
                            {file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={file.status} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {file.addedAt}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {file.size}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          onClick={() => deleteFile(file.id)}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
