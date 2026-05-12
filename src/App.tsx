import { useEffect } from 'react'
import AppSidebar from '@/components/AppSidebar'
import KnowledgeBasePanel from '@/components/KnowledgeBasePanel'
import ChatDashboard from '@/components/ChatDashboard'
import { useBrainStore } from '@/store/useBrainStore'

export default function App() {
  const init = useBrainStore((s) => s.init)

  useEffect(() => {
    init()
  }, [init])

  return (
    <div className="h-screen flex overflow-hidden bg-white">
      <AppSidebar />
      <KnowledgeBasePanel />
      <ChatDashboard />
    </div>
  )
}

