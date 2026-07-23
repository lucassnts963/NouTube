import { observable } from '@legendapp/state'
import { genId } from '@/lib/utils'

export type ImportStepStatus = 'active' | 'done' | 'error'

export interface ImportStep {
  id: string
  label: string
  status: ImportStepStatus
  done: number
  total: number
  resultLabel: string
}

interface Store {
  open: boolean
  finished: boolean
  steps: ImportStep[]
  reset: () => void
  close: () => void
  addStep: (label: string) => string
  updateStep: (id: string, patch: Partial<Omit<ImportStep, 'id'>>) => void
  finish: () => void
}

export const importProgress$ = observable<Store>({
  open: false,
  finished: false,
  steps: [],
  reset: () => {
    importProgress$.open.set(true)
    importProgress$.finished.set(false)
    importProgress$.steps.set([])
  },
  close: () => {
    importProgress$.open.set(false)
  },
  addStep: (label) => {
    const id = genId()
    importProgress$.steps.push({ id, label, status: 'active', done: 0, total: 0, resultLabel: '' })
    return id
  },
  updateStep: (id, patch) => {
    const index = importProgress$.steps.get().findIndex((s) => s.id === id)
    if (index === -1) return
    importProgress$.steps[index].assign(patch)
  },
  finish: () => {
    importProgress$.finished.set(true)
  },
})
