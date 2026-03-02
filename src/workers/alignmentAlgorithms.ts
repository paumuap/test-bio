import type { AlignmentParams, AlignmentResult } from '../types/alignment'

// ─── Needleman-Wunsch (Global Alignment) ───────────────────────────────────

export function needlemanWunsch(params: AlignmentParams): AlignmentResult {
  const t0 = performance.now()
  const { seq1, seq2, matchScore, mismatchScore, gapOpen } = params
  const gap = gapOpen  // simple linear gap penalty for clarity

  const m = seq1.length
  const n = seq2.length

  // Allocate matrix
  const M: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  // Initialize borders
  for (let i = 0; i <= m; i++) M[i][0] = i * gap
  for (let j = 0; j <= n; j++) M[0][j] = j * gap

  // Fill
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const diag = M[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? matchScore : mismatchScore)
      const up   = M[i - 1][j] + gap
      const left = M[i][j - 1] + gap
      M[i][j] = Math.max(diag, up, left)
    }
  }

  // Traceback
  const aligned1: string[] = []
  const aligned2: string[] = []
  let i = m, j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const diag = M[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? matchScore : mismatchScore)
      if (M[i][j] === diag) {
        aligned1.push(seq1[i - 1])
        aligned2.push(seq2[j - 1])
        i--; j--
        continue
      }
    }
    if (i > 0 && M[i][j] === M[i - 1][j] + gap) {
      aligned1.push(seq1[i - 1])
      aligned2.push('-')
      i--
    } else {
      aligned1.push('-')
      aligned2.push(seq2[j - 1])
      j--
    }
  }

  const a1 = aligned1.reverse().join('')
  const a2 = aligned2.reverse().join('')

  return buildResult(a1, a2, M[m][n], performance.now() - t0)
}

// ─── Smith-Waterman (Local Alignment) ──────────────────────────────────────

export function smithWaterman(params: AlignmentParams): AlignmentResult {
  const t0 = performance.now()
  const { seq1, seq2, matchScore, mismatchScore, gapOpen } = params
  const gap = gapOpen

  const m = seq1.length
  const n = seq2.length

  const M: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))

  let maxScore = 0
  let maxI = 0, maxJ = 0

  // Fill — local alignment allows reset to 0
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const diag = M[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? matchScore : mismatchScore)
      const up   = M[i - 1][j] + gap
      const left = M[i][j - 1] + gap
      M[i][j] = Math.max(0, diag, up, left)

      if (M[i][j] > maxScore) {
        maxScore = M[i][j]
        maxI = i; maxJ = j
      }
    }
  }

  // Traceback from max cell, stop at 0
  const aligned1: string[] = []
  const aligned2: string[] = []
  let i = maxI, j = maxJ

  while (i > 0 && j > 0 && M[i][j] > 0) {
    const diag = M[i - 1][j - 1] + (seq1[i - 1] === seq2[j - 1] ? matchScore : mismatchScore)
    if (M[i][j] === diag) {
      aligned1.push(seq1[i - 1])
      aligned2.push(seq2[j - 1])
      i--; j--
    } else if (M[i][j] === M[i - 1][j] + gap) {
      aligned1.push(seq1[i - 1])
      aligned2.push('-')
      i--
    } else {
      aligned1.push('-')
      aligned2.push(seq2[j - 1])
      j--
    }
  }

  const a1 = aligned1.reverse().join('')
  const a2 = aligned2.reverse().join('')

  return buildResult(a1, a2, maxScore, performance.now() - t0)
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

function buildResult(
  alignedSeq1: string,
  alignedSeq2: string,
  score: number,
  elapsedMs: number
): AlignmentResult {
  const length = alignedSeq1.length
  let matches = 0
  let gaps = 0

  for (let k = 0; k < length; k++) {
    if (alignedSeq1[k] === '-' || alignedSeq2[k] === '-') {
      gaps++
    } else if (alignedSeq1[k] === alignedSeq2[k]) {
      matches++
    }
  }

  const identity = length > 0 ? (matches / length) * 100 : 0

  return { alignedSeq1, alignedSeq2, score, identity, gaps, length, elapsedMs }
}
