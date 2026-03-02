import type { WorkerMessage, WorkerResponse } from '../types/alignment'
import { needlemanWunsch, smithWaterman } from './alignmentAlgorithms'

// Web Worker global scope
self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  if (msg.type === 'align') {
    try {
      const { params } = msg
      const result = params.mode === 'global'
        ? needlemanWunsch(params)
        : smithWaterman(params)

      const response: WorkerResponse = { type: 'result', result }
      self.postMessage(response)
    } catch (err) {
      const response: WorkerResponse = {
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error'
      }
      self.postMessage(response)
    }
  }
}
