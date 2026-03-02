export type AlignmentMode = 'global' | 'local'

export interface AlignmentParams {
  seq1: string
  seq2: string
  mode: AlignmentMode
  matchScore: number
  mismatchScore: number
  gapOpen: number
  gapExtend: number
}

export interface AlignmentResult {
  alignedSeq1: string
  alignedSeq2: string
  score: number
  identity: number      // percentage 0-100
  gaps: number          // count of gap characters
  length: number        // alignment length
  elapsedMs: number
}

export type WorkerMessage =
  | { type: 'align'; params: AlignmentParams }

export type WorkerResponse =
  | { type: 'result'; result: AlignmentResult }
  | { type: 'error'; message: string }
