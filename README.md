# BioAlign

Pairwise sequence alignment app built with **Vite + React + TypeScript**.  
Alignment runs in a **Web Worker** — the UI never freezes.

## Features

- **Global alignment** — Needleman-Wunsch algorithm
- **Local alignment** — Smith-Waterman algorithm
- **UniProt fetch** — enter an accession ID (e.g. `P68871`) to fetch the sequence automatically
- **Parametrizable** — match score, mismatch penalty, gap open/extend
- **Color-coded display** — amino acids colored by biochemical property
- **Web Worker** — heavy computation off the main thread

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Project Structure

```
src/
  types/
    alignment.ts          # Shared TypeScript types
  workers/
    alignmentAlgorithms.ts  # Needleman-Wunsch & Smith-Waterman
    alignmentWorker.ts      # Web Worker entry point
  components/
    SequenceInput.tsx     # Sequence input + UniProt fetch
    ParamsPanel.tsx       # Scoring parameter controls
    ResultPanel.tsx       # Colored alignment display
  utils/
    uniprot.ts            # UniProt REST API client
  App.tsx                 # Main component + Worker lifecycle
  App.css                 # Styles
```

## Amino Acid Color Scheme

| Color  | Group       | Residues              |
|--------|-------------|-----------------------|
| Amber  | Hydrophobic | A V I L M F W P       |
| Teal   | Polar       | S T C Y N Q           |
| Blue   | Basic (+)   | K R H                 |
| Red    | Acidic (−)  | D E                   |
| Grey   | Special     | G                     |

## Example sequences

- Human hemoglobin β: `P68871`
- Human myoglobin: `P02144`
- Human neuroglobin: `Q9NPG2`
