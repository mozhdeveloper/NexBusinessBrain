import { motion } from 'framer-motion'
import { Building2, HardHat, Database, FileText, Wifi, WifiOff } from 'lucide-react'
import { useBrainStore } from '@/store/useBrainStore'

type SectorKey = 'hospital' | 'construction'

const sectorIcons: Record<SectorKey, React.ReactNode> = {
  hospital: <Building2 className="w-8 h-8" />,
  construction: <HardHat className="w-8 h-8" />,
}

function classifySector(name: string): SectorKey {
  const lower = name.toLowerCase()
  if (
    lower.includes('hospital') ||
    lower.includes('clinic') ||
    lower.includes('health') ||
    lower.includes('patient')
  ) {
    return 'hospital'
  }
  return 'construction'
}

export default function SectorSelector() {
  const files = useBrainStore((s) => s.files)
  const backendOnline = useBrainStore((s) => s.backendOnline)

  const grouped = files.reduce(
    (acc, file) => {
      const key = classifySector(file.name)
      acc[key] += 1
      return acc
    },
    { hospital: 0, construction: 0 } as Record<SectorKey, number>,
  )

  return (
    <div className="min-h-screen bg-nexvision-off-white flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-5xl"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-nexvision-teal/10 text-nexvision-teal px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <Database className="w-4 h-4" />
            NexBusinessBrain Intelligence Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-nexvision-darkgrey mb-3 tracking-tight">
            Sector Readiness Overview
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            This view now reflects uploaded knowledge-base files from the current store model.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {([
            {
              id: 'hospital' as SectorKey,
              label: 'Healthcare / Hospital',
              description: 'Compliance, patient-care, and operations documents.',
            },
            {
              id: 'construction' as SectorKey,
              label: 'Construction',
              description: 'Safety, field operations, and project-management documents.',
            },
          ]).map((sector) => (
            <div
              key={sector.id}
              className="bg-white border border-border rounded-2xl p-7 shadow-sm"
            >
              <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-nexvision-teal/10 text-nexvision-teal mb-4">
                {sectorIcons[sector.id]}
              </div>
              <h3 className="text-xl font-bold text-nexvision-darkgrey mb-2">{sector.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">{sector.description}</p>
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                <FileText className="w-3.5 h-3.5" />
                {grouped[sector.id]} uploaded file{grouped[sector.id] === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {backendOnline ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-amber-600" />
            )}
            {backendOnline ? 'Backend connected' : 'Backend offline (simulation/local mode)'}
          </div>
          <span className="text-sm font-medium text-nexvision-darkgrey">
            Total files: {files.length}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
