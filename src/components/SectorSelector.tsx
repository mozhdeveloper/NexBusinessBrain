import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2,
  HardHat,
  ArrowRight,
  Database,
  FileText,
  Loader2,
} from 'lucide-react'
import { useBrainStore } from '@/store/useBrainStore'

const sectorIcons: Record<string, React.ReactNode> = {
  hospital: <Building2 className="w-8 h-8" />,
  construction: <HardHat className="w-8 h-8" />,
}

export default function SectorSelector() {
  const sectors = useBrainStore((s) => s.sectors)
  const activeSectorId = useBrainStore((s) => s.activeSectorId)
  const isIngesting = useBrainStore((s) => s.isIngesting)
  const ingestionProgress = useBrainStore((s) => s.ingestionProgress)
  const selectSector = useBrainStore((s) => s.selectSector)

  const activeSector = sectors.find((s) => s.id === activeSectorId)

  return (
    <div className="min-h-screen bg-nexvision-off-white flex flex-col items-center justify-center px-6 py-12">
      <AnimatePresence mode="wait">
        {!activeSectorId && (
          <motion.div
            key="selector"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-5xl"
          >
            <div className="text-center mb-12">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="inline-flex items-center gap-2 bg-nexvision-teal/10 text-nexvision-teal px-4 py-1.5 rounded-full text-sm font-medium mb-6"
              >
                <Database className="w-4 h-4" />
                NexBusinessBrain Intelligence Engine
              </motion.div>
              <h1 className="text-4xl md:text-5xl font-bold text-nexvision-darkgrey mb-4 tracking-tight">
                Select Your Industry Sector
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto">
                Choose a sector to simulate data ingestion and unlock AI-powered business reasoning tailored to your domain.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sectors.map((sector, idx) => (
                <motion.button
                  key={sector.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.12, duration: 0.4 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => selectSector(sector.id)}
                  className="group relative flex flex-col items-start text-left bg-white border border-border rounded-2xl p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between w-full mb-4">
                    <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-nexvision-teal/10 text-nexvision-teal">
                      {sectorIcons[sector.id]}
                    </div>
                    <div className="flex items-center gap-1 text-nexvision-teal font-medium text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      Begin Analysis
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-nexvision-darkgrey mb-2">
                    {sector.name}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                    {sector.description}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                    <FileText className="w-3.5 h-3.5" />
                    {sector.fileCount} simulated documents ready
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {activeSectorId && isIngesting && (
          <motion.div
            key="ingesting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-lg text-center"
          >
            <div className="bg-white rounded-2xl border border-border p-10 shadow-sm">
              <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-nexvision-teal/10 text-nexvision-teal mb-6 mx-auto">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-nexvision-darkgrey mb-2">
                Ingesting Sector Data
              </h2>
              <p className="text-muted-foreground mb-8">
                {activeSector?.name} — parsing {activeSector?.fileCount} documents into the knowledge graph.
              </p>

              <div className="relative h-3 bg-muted rounded-full overflow-hidden mb-3">
                <motion.div
                  className="absolute top-0 left-0 h-full bg-nexvision-teal rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${ingestionProgress}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Processing files...</span>
                <span className="font-medium text-nexvision-teal">
                  {Math.round(ingestionProgress)}%
                </span>
              </div>

              <div className="mt-6 space-y-2">
                {activeSector?.files.map((file, i) => (
                  <motion.div
                    key={file}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{
                      opacity: ingestionProgress > (i / activeSector.files.length) * 100 ? 1 : 0.25,
                      x: 0,
                    }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3 text-xs"
                  >
                    <FileText className="w-3.5 h-3.5 text-nexvision-teal shrink-0" />
                    <span className="text-nexvision-darkgrey truncate">{file}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
